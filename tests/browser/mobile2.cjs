// More phone checks (MOBILE=landscape): the sign-in popup, and a Level 2 room
// (LEVEL, STAGE) played by touch: tap an object, open the answer panel, answer.
if (!process.env.MOBILE) process.env.MOBILE = 'landscape'
const { launch, player, check, BASE, T } = require('./lib.cjs')
const LEVEL = Number(process.env.LEVEL || 2), STAGE = Number(process.env.STAGE || 1)
;(async () => {
  const { browser, page, errs } = await launch()
  const step = s => console.log('· ' + s)
  // the sign-in popup fits a short screen
  await page.goto(BASE + '/?nointro', { waitUntil: 'load' })
  await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.landing-curtain.is-open', { timeout: 60000 })
  await page.tap('.player-actions button:first-child')
  await page.waitForSelector('.acct')
  const box = await page.$eval('.acct', e => { const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom), innerHeight] })
  check(box[0] >= 0 && box[1] <= box[2] + 1, `sign-in box fits the screen: top ${box[0]}, bottom ${box[1]} of ${box[2]}`)
  await page.screenshot({ path: `${T}m2_signin.jpg`, quality: 80 })

  await player(page, { level: LEVEL, stage: STAGE, query: '?seed=7', name: 'Phone2' })
  await page.tap('.enter-bungalow-button')
  await page.waitForTimeout(400)
  await page.evaluate(() => { window.__landing.enterStart -= 11.6 })
  await page.waitForFunction(() => window.__hall && window.__hall.time() > 3, null, { timeout: 60000 })
  await page.waitForFunction(() => typeof window.__skipIntro === 'function'); await page.evaluate(() => window.__skipIntro())
  await page.waitForSelector('.question-bar, .memorise', { timeout: 60000 })
  if (await page.$('.memorise')) { await page.screenshot({ path: `${T}m2_memorise.jpg`, quality: 80 }); await page.tap('.memorise-ready'); await page.waitForSelector('.question-bar', { timeout: 60000 }) }
  await page.waitForTimeout(1200)
  const run = await page.evaluate(() => ({ id: window.__run.id, kind: window.__run.kind, answer: window.__run.answer }))
  await page.screenshot({ path: `${T}m2_${run.id}_play.jpg`, quality: 80 })
  // tap the first object of the room
  const obj = process.env.OBJ || 'diary'
  const a = await page.evaluate(id => { const r = window.__hall.anchor({ kind: 'object', id }); return { x: r.x, y: r.y + 18 } }, obj)
  await page.touchscreen.tap(a.x, a.y)
  await page.waitForTimeout(600)
  // the object may sit under the question: the first tap folds the question, the second reaches the object
  if (!(await page.$('.note-panel'))) { step('first tap folded the question: ' + !!(await page.$('.question-bar.is-folded'))); await page.touchscreen.tap(a.x, a.y) }
  await page.waitForTimeout(1300)
  check(!!(await page.$('.note-panel')), `tapping the ${obj} opens its panel`)
  await page.screenshot({ path: `${T}m2_${run.id}_${obj}.jpg`, quality: 80 })
  await page.tap('.panel-close'); await page.waitForTimeout(500)
  if (await page.$('.question-bar.is-folded')) await page.tap('.q-fold')
  await page.tap('.answer-button')
  await page.waitForSelector('.lock')
  // answer by touch only
  if (run.kind === 'number') { for (const ch of run.answer) await page.tap(`.key-btn >> text="${ch}"`) }
  else if (run.kind === 'word') {
    for (let i = 0; i < run.answer.length; i++) {
      const cur = await page.$$eval('.wheel span', s => s.map(x => x.textContent))
      const d = (run.answer.charCodeAt(i) - cur[i].charCodeAt(0) + 26) % 26
      const up = d <= 13, n = up ? d : 26 - d
      for (let k = 0; k < n; k++) await page.tap(`.wheel:nth-child(${i + 1}) button:${up ? 'first' : 'last'}-child`)
    }
  } else if (run.kind === 'sequence') { for (const id of run.answer.split('-')) await page.tap(`.seq-option[data-id="${id}"]`) }
  else await page.tap(`[data-id="${run.answer}"]`)
  await page.screenshot({ path: `${T}m2_${run.id}_answer.jpg`, quality: 80 })
  const fits = await page.$eval('.lock', e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1 })
  check(fits, 'the answer panel fits the screen (it scrolls inside if needed)')
  await page.tap('.lock-actions .lock-turn')
  await page.waitForSelector('.confirm .lock-turn:not([disabled])')
  await page.tap('.confirm .lock-turn')
  await page.waitForSelector('.stage-clear', { timeout: 15000 }).then(() => check(true, `${run.id} answered by touch: ${run.answer}`), () => check(false, `${run.id} answered by touch`))
  console.log(errs.join('\n') || 'no errors')
  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
