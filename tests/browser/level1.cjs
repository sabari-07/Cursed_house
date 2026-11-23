// Level 1 end to end through the real UI: create an account, play the five
// stages (answering from the dev hook window.__run), the treasure, the landing
// page afterwards, Level 2 "coming soon", the leaderboard; then a death that
// resumes the same stage. Logs frame gaps during stage changes.
const { launch, T, BASE } = require('./lib.cjs')
const ORDER = ['collector', 'son', 'caretaker', 'wife']   // PORTRAITS order in the answer panel
;(async () => {
  const { browser, page, errs } = await launch()
  const step = s => console.log('·', s)
  await page.goto(BASE + '/?nointro', { waitUntil: 'load' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.landing-curtain.is-open', { timeout: 60000 })
  step('landing: ' + (await page.textContent('.enter-bungalow-button')))
  // create an account
  await page.click('.enter-bungalow-button')
  await page.waitForSelector('.acct')
  await page.click('.acct-tabs button:nth-child(2)')
  await page.fill('.acct input[autocomplete="username"]', 'Arjun Test')
  await page.fill('.acct input[name="password"]', 'lantern123')
  await page.fill('.acct input[name="confirm"]', 'lantern123')
  await page.click('.acct-go')
  await page.waitForSelector('.player-name')
  step('signed in: ' + (await page.textContent('.player-card')).replace(/\s+/g, ' '))
  await page.screenshot({ path: `${T}e2e_landing.jpg`, type: 'jpeg', quality: 75 })

  const enterAndSkip = async () => {
    await page.click('.enter-bungalow-button')
    await page.waitForTimeout(400)
    await page.evaluate(() => { window.__landing.enterStart -= 11.6 })
    await page.waitForFunction(() => window.__hall && window.__hall.time() > 3, null, { timeout: 30000 })
    await page.waitForFunction(() => typeof window.__skipIntro === 'function'); await page.evaluate(() => window.__skipIntro())
  }
  const answer = async (wrong = false) => {
    const run = await page.evaluate(() => ({ id: window.__run.id, kind: window.__run.kind, answer: window.__run.answer, q: window.__run.question }))
    let a = run.answer
    if (wrong) a = run.kind === 'number' ? String((Number(a) % 15) + 2) : run.kind === 'word' ? (a === 'GHOST' ? 'NIGHT' : 'GHOST') : (a === 'wife' ? 'son' : 'wife')
    await page.click('.answer-button')
    await page.waitForSelector('.lock')
    if (run.kind === 'number') { for (const ch of a) await page.keyboard.press(ch) }
    else if (run.kind === 'word') { await page.locator('.wheel span').first().click(); await page.keyboard.type(a.toLowerCase()) }
    else await page.locator('.lock-face').nth(ORDER.indexOf(a)).click()
    await page.click('.lock-actions .lock-turn')
    await page.waitForSelector('.confirm .lock-turn:not([disabled])')
    await page.click('.confirm .lock-turn')
    return run
  }
  await page.evaluate(() => {
    window.__gaps = []; let last = performance.now()
    const f = () => { const n = performance.now(), H = window.__hall; if (n - last > 300) window.__gaps.push([Math.round(n - last), H ? H.mode : '-', document.querySelector('.question-stage')?.textContent || (document.querySelector('.memorise') ? 'memorise' : document.querySelector('.stage-clear') ? 'clear' : '?'), H ? !!H.hallMats.death : null, window.__run?.id]); last = n; requestAnimationFrame(f) }
    requestAnimationFrame(f)
  })

  await enterAndSkip()
  for (let s = 1; s <= 5; s++) {
    // wait for the question (Who Moved? first shows the wall, then swaps in the dark)
    if (s === 4) {
      await page.waitForSelector('.memorise', { timeout: 20000 })
      step('stage 4: memorise banner shown')
      await page.screenshot({ path: `${T}e2e_s4_memorise.jpg`, type: 'jpeg', quality: 75 })
    }
    await page.waitForSelector('.question-bar', { timeout: 30000 })
    await page.waitForTimeout(600)
    const label = await page.textContent('.question-stage')
    if (s === 4) {
      const crooked = await page.evaluate(() => ({ crooked: window.__run.scene.crooked, before: window.__run.scene.wall, after: window.__hall.wallNow() }))
      step('stage 4 after the swap: ' + JSON.stringify(crooked))
      await page.screenshot({ path: `${T}e2e_s4_after.jpg`, type: 'jpeg', quality: 75 })
    }
    if (s === 5) {
      await page.keyboard.press('j'); await page.waitForSelector('.journal')
      step('stage 5 journal marks: ' + JSON.stringify(await page.$$eval('.jmark', els => els.map(e => e.className.replace('jmark is-', '') + ':' + e.textContent))))
      await page.screenshot({ path: `${T}e2e_s5_journal.jpg`, type: 'jpeg', quality: 75 })
      await page.keyboard.press('Escape'); await page.waitForTimeout(300)
    }
    const run = await answer()
    step(`stage ${s} (${label}) ${run.id}: answered ${run.answer}`)
    if (s < 5) {
      await page.waitForSelector('.stage-clear', { timeout: 10000 })
      await page.waitForFunction(n => document.querySelector('.question-stage')?.textContent?.includes(`S${n}`) || !!document.querySelector('.memorise'), s + 1, { timeout: 30000 })
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ghostwriter_users_v1')).users[0].progress)
      step(`  saved progress: level ${saved.level} stage ${saved.stage}`)
    }
  }
  await page.waitForSelector('.reward', { timeout: 20000 })
  await page.waitForTimeout(1800)
  step('treasure card: ' + (await page.textContent('.reward')).replace(/\s+/g, ' '))
  await page.screenshot({ path: `${T}e2e_treasure.jpg`, type: 'jpeg', quality: 80 })
  step('frame gaps > 300 ms during Level 1: ' + JSON.stringify(await page.evaluate(() => window.__gaps)))
  // the treasure leads straight into the next room, without leaving the house
  step('treasure button: ' + (await page.textContent('.reward .lock-turn')))
  await page.click('.reward .lock-turn')
  await page.waitForFunction(() => window.__hall && window.__hall.room && window.__hall.room.id === 'library', null, { timeout: 40000 })
  step('after the treasure, the next room: ' + (await page.evaluate(() => window.__hall.room.name)) + ' | landing shown? ' + !!(await page.$('.player-card')))
  await page.goto(BASE + '/?nointro', { waitUntil: 'load' })
  await page.waitForSelector('.player-card', { timeout: 60000 })
  await page.waitForTimeout(800)
  step('landing after the level: ' + (await page.textContent('.player-card')).replace(/\s+/g, ' '))
  step('treasure slots won: ' + (await page.$$eval('.treasure-slot.is-won', e => e.length)))
  // Level 2 is playable now: ENTER goes into the library
  await page.click('.enter-bungalow-button')
  await page.waitForTimeout(400)
  await page.evaluate(() => { window.__landing.enterStart -= 11.6 })
  await page.waitForFunction(() => window.__hall && window.__hall.room && window.__hall.room.id === 'library', null, { timeout: 40000 })
  step('Level 2 opens in: ' + (await page.evaluate(() => window.__hall.room.name)))
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.landing-curtain.is-open', { timeout: 60000 })
  await page.click('.player-actions button:first-child')
  await page.waitForSelector('.lb table')
  step('leaderboard: ' + JSON.stringify(await page.$$eval('.lb tbody tr', rs => rs.map(r => r.textContent + (r.classList.contains('is-me') ? ' <- me' : '')))))
  await page.screenshot({ path: `${T}e2e_leaderboard.jpg`, type: 'jpeg', quality: 80 })
  await page.click('.lb-actions button:last-child')

  // a death restarts the level: put the account on Level 1 Stage 3, die, check it is back at Stage 1
  await page.evaluate(() => {
    const f = JSON.parse(localStorage.getItem('ghostwriter_users_v1'))
    f.users[0].progress = { ...f.users[0].progress, level: 1, stage: 3 }
    localStorage.setItem('ghostwriter_users_v1', JSON.stringify(f))
  })
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.landing-curtain.is-open', { timeout: 60000 })
  await enterAndSkip()
  await page.waitForSelector('.question-bar', { timeout: 30000 })
  step('resumed at: ' + (await page.textContent('.question-stage')))
  await answer(true)
  await page.waitForSelector('.game-over-restart', { timeout: 20000 })
  step('game over says: ' + (await page.textContent('.game-over-restart')))
  await page.waitForSelector('.player-card', { timeout: 30000 })
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('ghostwriter_users_v1')).users[0].progress)
  step(`after the death: level ${after.level} stage ${after.stage}, deaths ${after.deaths}`)
  step('stored password? ' + (await page.evaluate(() => localStorage.getItem('ghostwriter_users_v1').includes('lantern123'))))
  console.log(errs.join('\n') || 'no errors')
  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
