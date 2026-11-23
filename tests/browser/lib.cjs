// Shared helpers for the browser checks (Playwright, headless Chrome on
// Direct3D): launch, create a player through the real UI, enter the house,
// answer the current question, log slow frames.
//
// Needs the dev server (`npm run dev`, port 5178) and Chrome. Override with
// BASE_URL and CHROME_PATH. Screenshots go to tests/browser/out/.
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright-core')

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5178'
const T = path.join(__dirname, 'out') + path.sep
fs.mkdirSync(T, { recursive: true })
const CHROME = process.env.CHROME_PATH || (process.platform === 'win32'
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome')

async function launch() {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
  })
  // MOBILE=landscape|portrait: a phone (iPhone 13 size, touch, 3x pixels) instead of a 1600 x 900 desktop
  const phone = process.env.MOBILE
  const page = await browser.newPage(phone
    ? { viewport: phone === 'portrait' ? { width: 390, height: 844 } : { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3,
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' }
    : { viewport: { width: 1600, height: 900 } })
  const errs = []
  page.on('pageerror', e => errs.push('PAGE ' + e.message))
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errs.push('CONSOLE ' + m.text().slice(0, 400)) })
  return { browser, page, errs }
}

/** A fresh player at Level `level`, Stage `stage`, on the landing page. The title card is skipped unless `intro`. */
async function player(page, { level = 1, stage = 1, query = '', intro = false, name = 'Tester' } = {}) {
  if (!intro) query = query ? query + '&nointro' : '?nointro'
  await page.goto(BASE + '/' + query, { waitUntil: 'load' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.landing-curtain.is-open', { timeout: 60000 })
  await page.click('.enter-bungalow-button')
  await page.waitForSelector('.acct')
  await page.click('.acct-tabs button:nth-child(2)')
  await page.fill('.acct input[autocomplete="username"]', name)
  await page.fill('.acct input[name="password"]', 'password1')
  await page.fill('.acct input[name="confirm"]', 'password1')
  await page.click('.acct-go')
  await page.waitForSelector('.player-name')
  if (level !== 1 || stage !== 1) {
    await page.evaluate(([level, stage]) => {
      const f = JSON.parse(localStorage.getItem('ghostwriter_users_v1'))
      f.users[0].progress = { ...f.users[0].progress, level, stage }
      localStorage.setItem('ghostwriter_users_v1', JSON.stringify(f))
    }, [level, stage])
    await page.reload({ waitUntil: 'load' })
    await page.waitForSelector('.landing-curtain.is-open', { timeout: 60000 })
  }
}

/** ENTER, fast-forward the walk, wait for the room scene, optionally SKIP the intro. */
async function enter(page, { skip = true } = {}) {
  await page.click('.enter-bungalow-button')
  await page.waitForTimeout(400)
  await page.evaluate(() => { window.__landing.enterStart -= 11.6 })
  await page.waitForFunction(() => window.__hall && window.__hall.time() > 3, null, { timeout: 40000 })
  if (skip) { await page.waitForFunction(() => typeof window.__skipIntro === 'function'); await page.evaluate(() => window.__skipIntro()) }
}

/** Answer the current question through the real panel (the dev hook window.__run says what is right). */
async function answer(page, { wrong = false } = {}) {
  const run = await page.evaluate(() => ({ id: window.__run.id, kind: window.__run.kind, answer: window.__run.answer, options: window.__run.options || null }))
  await page.click('.answer-button')
  await page.waitForSelector('.lock')
  let a = run.answer
  if (run.kind === 'number') {
    if (wrong) a = String((Number(a) + 1) % 100)
    for (const ch of a) await page.keyboard.press(ch)
  } else if (run.kind === 'word') {
    if (wrong) a = a === 'GHOST' ? 'NIGHT' : 'GHOST'
    await page.locator('.wheel span').first().click(); await page.keyboard.type(a.toLowerCase())
  } else if (run.kind === 'sequence') {
    let seq = a.split('-')
    if (wrong) seq = [seq[1], seq[0], seq[2], seq[3]]
    for (const id of seq) await page.click(`.seq-option[data-id="${id}"]`)
  } else {
    if (wrong) {
      const ids = await page.$$eval('[data-id]', els => els.map(e => e.getAttribute('data-id')))
      a = ids.find(i => i !== run.answer)
    }
    await page.click(`[data-id="${a}"]`)
  }
  await page.click('.lock-actions .lock-turn')
  await page.waitForSelector('.confirm .lock-turn:not([disabled])')
  await page.click('.confirm .lock-turn')
  return run
}

/** Records frame gaps over `ms`, tagged with the scene mode and the riddle. */
async function watchGaps(page, ms = 300) {
  await page.evaluate(ms => {
    window.__gaps = []; let last = performance.now()
    const f = () => { const n = performance.now(), H = window.__hall; if (n - last > ms) window.__gaps.push([Math.round(n - last), H ? H.mode : '-', window.__run?.id || '-']); last = n; requestAnimationFrame(f) }
    requestAnimationFrame(f)
  }, ms)
}

/** Fails the run (exit 1) when a condition is false. */
function check(ok, what) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`)
  if (!ok) process.exitCode = 1
}

module.exports = { launch, player, enter, answer, watchGaps, check, BASE, T }
