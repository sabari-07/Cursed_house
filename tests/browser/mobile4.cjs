// A phone (MOBILE=landscape): the first tap on the entry screen puts the game in full screen,
// with no button anywhere; after leaving full screen, the next tap goes back. The manifest loads.
process.env.MOBILE = process.env.MOBILE || 'landscape'
const { launch, check, BASE } = require('./lib.cjs')
;(async () => {
  const { browser, page, errs } = await launch()
  await page.goto(BASE + '/', { waitUntil: 'load' })
  const man = await page.evaluate(async () => { const l = document.querySelector('link[rel=manifest]'); const r = await fetch(l.href); return { ok: r.ok, m: await r.json() } })
  check(man.ok && man.m.display === 'fullscreen' && man.m.icons.length === 2, `manifest: display ${man.m.display}, ${man.m.icons.length} icons`)
  for (const i of man.m.icons) check((await page.evaluate(async u => (await fetch(u)).ok, i.src)), `icon ${i.src} loads`)
  await page.waitForSelector('.sg-board')
  await page.tap('.sg-board')
  await page.waitForTimeout(800)
  check(await page.evaluate(() => !!document.fullscreenElement), 'the first tap put the game in full screen')
  await page.evaluate(() => document.exitFullscreen())
  await page.waitForTimeout(500)
  check(!(await page.$('.fs-button, .fs-help')), 'no full screen button or message after leaving full screen')
  await page.touchscreen.tap(420, 200)
  await page.waitForTimeout(600)
  check(await page.evaluate(() => !!document.fullscreenElement), 'the next tap goes back to full screen')
  console.log(errs.join('\n') || 'no page errors')
  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
