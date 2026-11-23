// Guest play through the real UI: PLAY AS GUEST, win Level 1 Stage 1, check
// the progress is kept but the guest is not on the leaderboard, then SAVE MY
// PROGRESS turns it into an account that carries the progress.
const { launch, enter, answer, check, BASE, T } = require('./lib.cjs')
;(async () => {
  const { browser, page, errs } = await launch()
  await page.goto(BASE + '/?nointro', { waitUntil: 'load' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.landing-curtain.is-open', { timeout: 60000 })

  const buttons = await page.$$eval('.player-actions button', b => b.map(x => x.textContent))
  check(buttons.includes('PLAY AS GUEST'), 'the landing offers PLAY AS GUEST: ' + JSON.stringify(buttons))
  // the popup offers it too
  await page.click('.enter-bungalow-button')
  await page.waitForSelector('.acct-guest')
  check(true, 'ENTER while signed out opens the popup with a guest option')
  await page.click('.acct-guest')
  await page.waitForSelector('.player-guest')
  check((await page.textContent('.player-name')) === 'Playing as a guest', 'signed in as a guest, no account created')
  await page.screenshot({ path: `${T}guest_landing.jpg`, type: 'jpeg', quality: 80 })

  await enter(page)
  await page.waitForSelector('.question-bar', { timeout: 60000 })
  const r = await answer(page)
  await page.waitForFunction(id => window.__run.id !== id, r.id, { timeout: 30000 })
  const g = await page.evaluate(() => JSON.parse(localStorage.getItem('ghostwriter_guest_v1')))
  check(g && g.stage === 2, `a guest's win is kept (stage ${g && g.stage})`)
  check((await page.evaluate(() => localStorage.getItem('ghostwriter_users_v1'))) === null, 'no account was stored for the guest')

  // back on the landing: the leaderboard does not list the guest
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.player-guest', { timeout: 60000 })
  await page.click('.player-actions button:has-text("LEADERBOARD")')
  await page.waitForSelector('.lb table')
  const rows = await page.$$eval('.lb tbody tr', rs => rs.map(x => x.textContent))
  check(!rows.some(x => /Guest/.test(x)), 'the guest is not on the leaderboard')
  await page.click('.lb-actions button:last-child')

  // SAVE MY PROGRESS: sign up and keep the progress
  await page.click('.player-actions button:has-text("SAVE MY PROGRESS")')
  await page.waitForSelector('.acct')
  check(!(await page.$('.acct-guest')), 'no guest option while a guest signs up')
  await page.fill('.acct input[autocomplete="username"]', 'Wanderer')
  await page.fill('.acct input[name="password"]', 'lantern123')
  await page.fill('.acct input[name="confirm"]', 'lantern123')
  await page.click('.acct-go')
  await page.waitForFunction(() => document.querySelector('.player-name')?.textContent === 'Wanderer')
  const a = await page.evaluate(() => JSON.parse(localStorage.getItem('ghostwriter_users_v1')).users[0].progress)
  check(a.stage === 2, `the new account carries the guest's progress (stage ${a.stage})`)
  check((await page.evaluate(() => localStorage.getItem('ghostwriter_guest_v1'))) === null, 'the guest save is cleared')
  check(errs.length === 0, errs.join('\n') || 'no page errors')
  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
