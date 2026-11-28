// The house's voice: Grandfather's first-visit guide (the candle, then ANSWER),
// gone on the next visit, and the GAME OVER line, count remark and tip after a wrong answer.
const { launch, player, enter, answer, check, T } = require('./lib.cjs')
;(async () => {
  const { browser, page, errs } = await launch()
  await player(page)
  await enter(page)
  await page.waitForSelector('.question-bar', { timeout: 60000 })
  await page.waitForTimeout(1300)                       // the whisper's fade-in
  const candle = await page.textContent('.ghost-guide-line').catch(() => null)
  check(/candle/i.test(candle || ''), `first visit, candle whisper: "${candle}"`)
  check(!!(await page.$('.candle-tool.is-beckoned')), 'the candle glows blue while Grandfather points at it')
  await page.screenshot({ path: `${T}guide_candle.jpg`, quality: 85 })

  await page.click('.candle-tool')                     // picking it up answers the first whisper
  await page.waitForTimeout(1300)
  const ans = await page.textContent('.ghost-guide-line').catch(() => null)
  check(/ANSWER/.test(ans || ''), `after the candle, answer whisper: "${ans}"`)
  check(!!(await page.$('.answer-button.is-beckoned')), 'the ANSWER button glows blue')
  await page.screenshot({ path: `${T}guide_answer.jpg`, quality: 85 })
  await page.click('.candle-tool')                     // put it down again

  await answer(page, { wrong: true })                  // opening ANSWER ends the guide
  check(await page.evaluate(() => localStorage.getItem('ghostwriter_guide_v1') !== null), 'the guide is saved as seen')
  await page.waitForSelector('.game-over', { timeout: 20000 })
  await page.waitForTimeout(2400)                      // every line has faded in
  const over = await page.$$eval('.game-over p', ps => ps.map(p => p.className + ': ' + p.textContent))
  over.forEach(l => console.log('  ' + l))
  check(/wrong|not quite/i.test(over.find(l => l.startsWith('game-over-line')) || ''), 'GAME OVER names a wrong answer')
  check(over.some(l => l.startsWith('game-over-tip')), 'GAME OVER gives a tip')
  check(!over.some(l => l.startsWith('game-over-count')), 'no count remark after the first death')
  await page.screenshot({ path: `${T}gameover_wrong.jpg`, quality: 85 })

  // the next visit: no guide
  await page.waitForSelector('.player-card', { timeout: 30000 })
  await enter(page)
  await page.waitForSelector('.question-bar', { timeout: 60000 })
  await page.waitForTimeout(800)
  check(!(await page.$('.ghost-guide-line')), 'second visit: Grandfather stays quiet')
  console.log(errs.join('\n') || 'no errors')
  if (errs.length) process.exitCode = 1
  await browser.close()
})()
