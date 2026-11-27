// Text size and fit on laptop and phone screens. For each screen it opens the landing page, the
// sign-in popup, the hall (question bar) and the answer panel, and logs:
//   min / median   the smallest and the typical rendered text size, in CSS px
//   off            visible text cut off by the screen edge
// It fails when text on a laptop is under 12 px, text on a phone is under 11 px, or text is cut off.
// SCREENS=laptop|phone limits the run. Screenshots: out/resp_<screen>_<view>.jpg. Needs the dev server.
const { chromium } = require('playwright-core')
const { BASE, T, check } = require('./lib.cjs')
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PHONE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'
const SCREENS = [
  // laptops: CSS px after Windows display scaling (1920 at 100 %, 125 %, 150 %), 1366 panels, a MacBook
  { name: '1920x1080', kind: 'laptop', viewport: { width: 1920, height: 1080 } },
  { name: '1536x864', kind: 'laptop', viewport: { width: 1536, height: 864 } },
  { name: '1440x900', kind: 'laptop', viewport: { width: 1440, height: 900 } },
  { name: '1366x768', kind: 'laptop', viewport: { width: 1366, height: 768 } },
  { name: '1280x720', kind: 'laptop', viewport: { width: 1280, height: 720 } },
  // phones held sideways
  { name: 'phone844x390', kind: 'phone', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, userAgent: PHONE_UA },
  { name: 'phone740x360', kind: 'phone', viewport: { width: 740, height: 360 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, userAgent: PHONE_UA },
  // a tablet sideways (touch, but a big screen)
  { name: 'tablet1180x820', kind: 'tablet', viewport: { width: 1180, height: 820 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: PHONE_UA },
]
const only = process.env.SCREENS
const MIN = { laptop: 12, tablet: 12, phone: 11 }

/** Rendered text sizes and cut-off text among visible elements that hold text themselves. */
const measure = page => page.evaluate(() => {
  const W = innerWidth, H = innerHeight, sizes = [], off = [], small = []
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('.turn-phone')) continue
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())
    if (!own) continue
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el)
    if (!r.width || !r.height || cs.visibility === 'hidden' || +cs.opacity === 0) continue
    let hidden = false
    for (let p = el; p; p = p.parentElement) { const s = getComputedStyle(p); if (+s.opacity === 0 || s.display === 'none') { hidden = true; break } }
    if (hidden) continue
    const fs = parseFloat(cs.fontSize)
    const label = `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} "${el.textContent.trim().slice(0, 24)}"`
    sizes.push(fs)
    small.push([fs, label])
    if (r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1) off.push(`${label} ${Math.round(r.left)},${Math.round(r.top)}-${Math.round(r.right)},${Math.round(r.bottom)}`)
  }
  sizes.sort((a, b) => a - b)
  small.sort((a, b) => a[0] - b[0])
  return { min: sizes[0] || 0, median: sizes[sizes.length >> 1] || 0, smallest: small.slice(0, 3).map(s => `${s[0].toFixed(1)} ${s[1]}`), off: [...new Set(off)].slice(0, 6) }
})

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] })
  for (const s of SCREENS) {
    if (only && s.kind !== only && s.name !== only) continue
    const { name, kind, ...opts } = s
    const page = await browser.newPage(opts)
    const errs = []
    page.on('pageerror', e => errs.push(e.message))
    const view = async v => {
      await page.waitForTimeout(700)
      await page.screenshot({ path: `${T}resp_${name}_${v}.jpg`, quality: 75 })
      const m = await measure(page)
      check(m.min >= MIN[kind] && !m.off.length, `${name.padEnd(14)} ${v.padEnd(8)} text min ${m.min.toFixed(1).padStart(5)} median ${m.median.toFixed(1).padStart(5)}  smallest ${JSON.stringify(m.smallest)}${m.off.length ? '  CUT OFF ' + JSON.stringify(m.off) : ''}`)
    }
    const tap = sel => (opts.hasTouch ? page.tap(sel) : page.click(sel))
    await page.goto(BASE + '/?nointro', { waitUntil: 'load' })
    await page.evaluate(() => localStorage.clear())
    await page.reload({ waitUntil: 'load' })
    await page.waitForSelector('.landing-curtain.is-open', { timeout: 60000 })
    await page.waitForTimeout(1500)
    await view('landing')
    await tap('.enter-bungalow-button')
    await page.waitForSelector('.acct')
    await view('signin')
    await tap('.acct-guest')
    await page.waitForSelector('.player-name')
    await view('guest')
    await tap('.enter-bungalow-button')
    await page.waitForTimeout(400)
    await page.evaluate(() => { window.__landing.enterStart -= 11.6 })
    await page.waitForFunction(() => window.__hall && window.__hall.time() > 3, null, { timeout: 60000 })
    await page.waitForFunction(() => typeof window.__skipIntro === 'function')
    await page.evaluate(() => window.__skipIntro())
    await page.waitForSelector('.question-bar', { timeout: 60000 })
    await page.waitForTimeout(1200)
    await view('hall')
    await tap('.answer-button')
    await page.waitForSelector('.lock')
    await view('answer')
    if (errs.length) console.log(errs.join('\n'))
    await page.close()
  }
  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
