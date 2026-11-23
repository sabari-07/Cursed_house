// The title card: a key press at 0.2 s (sound on), then checks from marks taken
// inside the page (so a busy machine can't skew them): how long the card stays,
// when the letters are typed, that one key strike is scheduled per letter 0.3 s
// apart, and that the loading bar fills with the witch's head on its edge.
const { launch, check, BASE, T } = require('./lib.cjs')
;(async () => {
  const { browser, page, errs } = await launch()
  await page.addInitScript(() => {
    window.__keys = []; window.__marks = {}; window.__bar = []
    const orig = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (when, ...r) {
      // key strikes are short clips; the one-sample silent buffer is the audio unlock, not a key
      if (this.buffer && this.buffer.duration < 0.3 && this.buffer.length > 1) window.__keys.push(when)
      return orig.call(this, when, ...r)
    }
    const tick = () => {
      const now = performance.now(), m = window.__marks
      const c = document.querySelector('.title-card')
      const n = document.querySelectorAll('.tc-letter.is-in').length
      if (c && !m.card) m.card = now
 if (m.prev && now - m.prev > (m.stall || 0)) m.stall = now - m.prev
 m.prev = now
 if (c && c.classList.contains('is-fading') && m.fadeBar === undefined) { const f = c.querySelector('.tc-fill').getBoundingClientRect(), t = c.querySelector('.tc-track').getBoundingClientRect(); m.fadeBar = f.width / t.width }
      if (n >= 1 && !m.first) m.first = now
      if (n === document.querySelectorAll('.tc-letter').length && n > 0 && !m.last) m.last = now
      if (c) {
        const f = c.querySelector('.tc-fill')?.getBoundingClientRect(), t = c.querySelector('.tc-track')?.getBoundingClientRect(), h = c.querySelector('.tc-head')?.getBoundingClientRect()
        if (f && t && h && m.card) window.__bar.push([now - m.card, f.width / t.width, h.x + h.width / 2 - (t.x + f.width)])
      }
      if (!c && m.card && !m.gone) { m.gone = now; return }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await page.goto(BASE + '/', { waitUntil: 'commit' })
  await page.waitForSelector('.sg-board')                 // the entry screen waits for a click (it unlocks sound)
  await page.click('.sg-board')
  await page.waitForSelector('.title-card')
  await page.waitForTimeout(200)
  await page.keyboard.press('Shift')
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${T}title_typing.jpg`, quality: 85 })
  await page.waitForSelector('.tc-about.is-in', { timeout: 10000 }).catch(() => undefined)
 await page.waitForTimeout(900)
  await page.screenshot({ path: `${T}title_about.jpg`, quality: 85 })
  await page.waitForSelector('.title-card', { state: 'detached', timeout: 20000 })
  await page.waitForTimeout(300)
  const r = await page.evaluate(() => ({ m: window.__marks, keys: window.__keys, bar: window.__bar }))
  const s = v => (v / 1000).toFixed(2)
  const shown = (r.m.gone - r.m.card) / 1000
  check(shown >= 9.5 && shown <= 12, `card on screen ${shown.toFixed(2)} s (about 10 s)`)
  check(r.m.last - r.m.first >= 3000 && r.m.last - r.m.first <= 4000, `title typed in ${s(r.m.last - r.m.first)} s (16 characters, 0.22 s apart)`)
  const gaps = r.keys.slice(1).map((k, i) => k - r.keys[i])
  check(r.keys.length >= 12 && r.keys.length <= 16 && gaps.every(g => Math.abs(g - 0.22) < 0.01 || Math.abs(g - 0.44) < 0.01), `${r.keys.length} key strikes scheduled, gaps ${JSON.stringify(gaps.map(g => +g.toFixed(3)))}`)
  const at = t => r.bar.find(b => b[0] >= t)
  const mid = at(4500)
  check(mid && mid[1] > 0.1 && mid[1] < 0.85, `bar ${mid ? Math.round(mid[1] * 100) : '?'}% at 4.5 s`)
  check(r.m.fadeBar > 0.97, `bar ${Math.round(r.m.fadeBar * 100)}% when the card fades`)
 console.log(` longest page freeze: ${Math.round(r.m.stall)} ms (the landing loading behind the card)`)
  check(r.bar.every(b => Math.abs(b[2]) < 2), `the witch's head stays on the bar's edge (largest drift ${Math.max(...r.bar.map(b => Math.abs(b[2]))).toFixed(1)} px)`)
  check(errs.length === 0, errs.join('\n') || 'no page errors')
  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
