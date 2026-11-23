// Sound on a phone with the browser's REAL autoplay rule (the other checks turn it off):
// one tap on the entry screen must give sound in the title card; the landing's storm must
// start by itself when the card ends (no second tap); the hall's intro must be heard after ENTER.
// Works on the dev server and on the live (production) site: it counts the sounds that start
// on a running AudioContext, instead of reading the game's dev-only hooks.
const { chromium } = require('playwright-core')
const { check, BASE } = require('./lib.cjs')
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=d3d11'] })
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' })
  const page = await ctx.newPage()
  const errs = []; page.on('pageerror', e => errs.push(e.message))
  await page.addInitScript(() => {
    window.__ctxs = []; window.__heard = 0
    const A = window.AudioContext
    window.AudioContext = class extends A { constructor(...a) { super(...a); window.__ctxs.push(this) } }
    // a sound counts as heard when it starts on a running context (the one-sample unlock does not count)
    for (const P of [AudioBufferSourceNode.prototype, OscillatorNode.prototype]) {
      const start = P.start
      P.start = function (...a) {
        if (this.context.state === 'running' && !(this.buffer && this.buffer.length <= 1)) window.__heard++
        return start.apply(this, a)
      }
    }
  })
  const info = () => page.evaluate(() => ({ states: window.__ctxs.map(c => c.state).join(','), heard: window.__heard }))
  await page.goto(BASE + '/', { waitUntil: 'load' })
  await page.waitForSelector('.sg-board')
  await page.waitForTimeout(1500)
  await page.tap('.sg-board')
  await page.waitForSelector('.title-card', { timeout: 10000 })
  await page.waitForTimeout(2000)
  const a = await info()
  check(!(await page.$('.tc-hint')) && /running/.test(a.states) && a.heard > 3, `title card heard after one tap: ${a.heard} sounds, contexts ${a.states}`)
  await page.waitForSelector('.title-card', { state: 'detached', timeout: 30000 })
  const b0 = (await info()).heard
  await page.waitForSelector('.landing-curtain', { timeout: 60000 })
  await page.waitForTimeout(5000)
  const b = await info()
  check(b.heard > b0 && /running/.test(b.states), `the landing's storm started by itself: ${b.heard - b0} new sounds, contexts ${b.states}`)
  // into the hall as a guest: the slam and the voice must be heard
  await page.tap('.player-actions .is-guest')
  await page.waitForSelector('.player-guest')
  await page.waitForTimeout(800)
  const c0 = (await info()).heard
  await page.tap('.enter-bungalow-button')
  const dev = await page.evaluate(() => !!window.__landing)
  if (dev) { await page.waitForTimeout(400); await page.evaluate(() => { window.__landing.enterStart -= 11.6 }) }
  await page.waitForSelector('.hall-stage', { timeout: 60000 })
  await page.waitForTimeout(4000)
  const c = await info()
  check(c.heard > c0 + 2 && /running/.test(c.states), `ENTER and the hall heard: ${c.heard - c0} new sounds, contexts ${c.states}`)
  console.log(errs.join('\n') || 'no page errors')
  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
