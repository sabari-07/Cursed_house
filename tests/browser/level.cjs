// Plays a whole painted-room level through the real UI: LEVEL=2|3, SEED.
// Captures each stage at the start of play and with one object inspected,
// logs subtitles, frame gaps over 300 ms and errors, then the treasure card.
const { launch, player, enter, answer, T } = require('./lib.cjs')
const LEVEL = Number(process.env.LEVEL || 2)
const STAGE = Number(process.env.STAGE || 1)
const SEED = process.env.SEED || '7'
const STOP = Number(process.env.STOP || 5)
;(async () => {
  const { browser, page, errs } = await launch()
  const step = s => console.log('· ' + s)
  await player(page, { level: LEVEL, stage: STAGE, query: `?seed=${SEED}` })
  await enter(page, { skip: false })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${T}L${LEVEL}_intro.jpg`, quality: 80 })
  await page.waitForSelector('.stage-title', { timeout: 30000 })
  step('title: ' + await page.textContent('.stage-title'))
  await page.screenshot({ path: `${T}L${LEVEL}_title.jpg`, quality: 80 })
  await page.waitForFunction(() => typeof window.__skipIntro === 'function'); await page.evaluate(() => window.__skipIntro())
  await page.evaluate(() => {
    window.__gaps = []; window.__subs = []; let last = performance.now()
    const f = () => { const n = performance.now(); if (n - last > 300) window.__gaps.push([Math.round(n - last), window.__run?.id]); last = n; requestAnimationFrame(f) }
    requestAnimationFrame(f)
    new MutationObserver(() => { const s = document.querySelector('.subtitle'); if (s && window.__subs[window.__subs.length - 1] !== s.textContent) window.__subs.push(s.textContent) }).observe(document.body, { childList: true, subtree: true, characterData: true })
  })
  for (let st = STAGE; st <= STOP; st++) {
    await page.waitForSelector('.question-bar, .memorise', { timeout: 60000 })
    const id = await page.evaluate(() => window.__run.id)
    if (await page.$('.memorise')) {
      await page.screenshot({ path: `${T}L${LEVEL}_${id}_memorise.jpg`, quality: 80 })
      await page.waitForSelector('.question-bar', { timeout: 60000 })
    }
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${T}L${LEVEL}_${id}_play.jpg`, quality: 80 })
    // inspect one object through the keyboard hotspots (Tab + Enter)
    const want = process.env['OBJ_' + id]
    if (want) {
      const r = await page.evaluate(w => { const H = window.__hall; return H.anchor({ kind: 'object', id: w }) }, want)
      await page.mouse.move(r.x, r.y + 20)
      await page.mouse.click(r.x, r.y + 20)
      await page.waitForTimeout(1600)
      await page.screenshot({ path: `${T}L${LEVEL}_${id}_${want}.jpg`, quality: 85 })
      step(`${id} ${want}: ` + (await page.$eval('.note-panel', e => e.textContent).catch(() => '(no panel)')))
      await page.keyboard.press('Escape')
      await page.waitForTimeout(800)
    }
    const waitS = Number(process.env['WAIT_' + id] || 0)
    if (waitS) await page.waitForTimeout(waitS * 1000)
    const run = await answer(page)
    step(`stage ${st} ${run.id}: answered ${run.answer}`)
    if (st < STOP) await page.waitForFunction(i => window.__run.id !== i, run.id, { timeout: 30000 })
  }
  if (STOP === 5) {
    await page.waitForSelector('.reward', { timeout: 30000 })
    step('treasure: ' + await page.textContent('.reward'))
    await page.waitForTimeout(2500)                     // after the treasure's fade-in
    await page.screenshot({ path: `${T}L${LEVEL}_treasure.jpg`, quality: 80 })
  }
  step('subtitles: ' + JSON.stringify(await page.evaluate(() => window.__subs)))
  step('gaps > 300 ms: ' + JSON.stringify(await page.evaluate(() => window.__gaps)))
  console.log(errs.length ? errs.join('\n') : 'no errors')
  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
