// The game on a phone (MOBILE=landscape by default, or portrait): title card,
// landing, sign up by touch, the hall, inspecting by tap, the answer panel.
// Logs anything wider than the screen, buttons smaller than 40 px, frame gaps.
if (!process.env.MOBILE) process.env.MOBILE = 'landscape'
const { launch, player, enter, check, watchGaps, BASE, T } = require('./lib.cjs')
const M = process.env.MOBILE
;(async () => {
  const { browser, page, errs } = await launch()
  const step = s => console.log('· ' + s)
  const shot = n => page.screenshot({ path: `${T}m_${M}_${n}.jpg`, quality: 80 })
  /** Elements wider than the screen, and tappable things under 40 px, among visible ones. */
  const audit = (label) => page.evaluate(label => {
    const W = innerWidth, H = innerHeight, over = [], small = []
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el)
      if (!r.width || !r.height || cs.visibility === 'hidden' || +cs.opacity === 0) continue
      const name = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '')
      if ((r.right > W + 2 || r.bottom > H + 2) && cs.position !== 'fixed' && !/canvas/.test(name) && el.closest('[class]') === el) over.push(`${name} ${Math.round(r.right)}x${Math.round(r.bottom)}`)
      if (el.matches('button, a, input, [role=button]') && (r.height < 40 || r.width < 40)) small.push(`${name} "${(el.textContent || '').trim().slice(0, 20)}" ${Math.round(r.width)}x${Math.round(r.height)}`)
    }
    return { label, over: [...new Set(over)].slice(0, 12), small: [...new Set(small)].slice(0, 12) }
  }, label)
  const report = async label => { const a = await audit(label); step(`${label}: off-screen ${JSON.stringify(a.over)} | small taps ${JSON.stringify(a.small)}`) }

  // title card
  await page.goto(BASE + '/', { waitUntil: 'commit' })
  await page.waitForSelector('.sg-board')                 // the entry screen waits for a click (it unlocks sound)
  await page.click('.sg-board')
  await page.waitForSelector('.title-card')
  await page.waitForTimeout(5000)
  await shot('title'); await report('title card')
  await page.waitForSelector('.title-card', { state: 'detached', timeout: 20000 })
  await page.waitForSelector('.landing-curtain.is-open', { timeout: 60000 })
  await page.waitForTimeout(1500)
  await shot('landing'); await report('landing')

  // sign up by touch
  await player(page, { name: 'Phone' })
  await shot('landing_signed'); await report('landing signed in')
  await page.tap('.enter-bungalow-button').catch(() => page.click('.enter-bungalow-button'))
  await page.waitForTimeout(400)
  await page.evaluate(() => { window.__landing.enterStart -= 11.6 })
  await page.waitForFunction(() => window.__hall && window.__hall.time() > 3, null, { timeout: 60000 })
  await page.waitForFunction(() => typeof window.__skipIntro === 'function'); await page.evaluate(() => window.__skipIntro())
  await page.waitForSelector('.question-bar', { timeout: 60000 })
  await watchGaps(page)
  await page.waitForTimeout(1200)
  await shot('hall'); await report('hall play')

  // tap a portrait: the inspect panel should open
  const p = await page.evaluate(() => { const a = window.__hall.anchor({ kind: 'portrait', index: 0 }); return { x: a.x, y: a.y + 40 } })
  await page.touchscreen.tap(p.x, p.y)
  await page.waitForTimeout(1200)
  const opened = !!(await page.$('.note-panel'))
  check(opened, `tapping a portrait opens its panel (tap at ${Math.round(p.x)},${Math.round(p.y)})`)
  await shot('inspect'); await report('inspect')
  if (opened) { await page.tap('.panel-close'); await page.waitForTimeout(600) }

  // touching the room folded the question to one line; SHOW QUESTION opens it again
  step('question folded after a tap on the room: ' + !!(await page.$('.question-bar.is-folded')))
  await shot('folded')
  // the candle: tap it, drag a finger across the room, the light follows
  await page.tap('.candle-tool')
  const cdp = await page.context().newCDPSession(page)
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
  await touch('touchStart', 300, 250); for (let k = 1; k <= 10; k++) await touch('touchMove', 300 + k * 20, 250)
  const torchAt = await page.$eval('.torch-cursor', e => e.style.transform).catch(() => 'no torch')
  await touch('touchEnd', 0, 0)
  step('candle after a drag to (500, 250): ' + torchAt)
  await shot('candle')
  await page.tap('.candle-tool')
  await page.tap('.q-fold'); await page.waitForTimeout(300)
  step('question shown again: ' + !(await page.$('.question-bar.is-folded')))

  // the answer panel
  await page.tap('.answer-button')
  await page.waitForSelector('.lock')
  await page.waitForTimeout(500)
  await shot('answer'); await report('answer panel')
  step('gaps > 300 ms: ' + JSON.stringify(await page.evaluate(() => window.__gaps)))
  step('pixel ratio used by the canvas: ' + await page.evaluate(() => { const c = document.querySelector('canvas'); return c ? (c.width / c.clientWidth).toFixed(2) : '-' }))
  console.log(errs.join('\n') || 'no errors')
  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
