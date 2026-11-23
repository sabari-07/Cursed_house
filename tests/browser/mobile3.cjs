// A phone held upright: the "turn your phone sideways" card covers the game.
process.env.MOBILE = 'portrait'
const { launch, check, BASE, T } = require('./lib.cjs')
;(async () => {
  const { browser, page, errs } = await launch()
  await page.goto(BASE + '/?nointro', { waitUntil: 'load' })
  await page.waitForTimeout(2500)
  const card = await page.$eval('.turn-phone', e => { const r = e.getBoundingClientRect(); return { shown: getComputedStyle(e).display !== 'none', w: r.width, h: r.height, text: e.textContent } })
  check(card.shown && card.w >= 389 && card.h >= 843, `upright: the turn-sideways card covers the screen (${card.w}x${card.h}): "${card.text.slice(0, 40)}"`)
  await page.screenshot({ path: `${T}m3_portrait.jpg`, quality: 80 })
  await page.setViewportSize({ width: 844, height: 390 })
  await page.waitForTimeout(500)
  check(await page.$eval('.turn-phone', e => getComputedStyle(e).display === 'none'), 'turned sideways: the card is gone')
  console.log(errs.join('\n') || 'no errors')
  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
