// How bright each screen is: mean brightness (0-255) and the share of near-black pixels (< 20),
// for the entry screen, the title card, the landing, the hall (play) and the library (play).
// Screenshots: out/bright_<name>.jpg. TAG env names the run (before/after).
const { launch, player, enter, T } = require('./lib.cjs')
const TAG = process.env.TAG || 'now'
;(async () => {
  const { browser, page, errs } = await launch()
  const rows = []
  const measure = async name => {
    const buf = await page.screenshot({ path: `${T}bright_${TAG}_${name}.jpg`, quality: 80 })
    const r = await page.evaluate(async b64 => {
      const img = new Image(); img.src = 'data:image/jpeg;base64,' + b64; await img.decode()
      const c = document.createElement('canvas'); c.width = 400; c.height = Math.round(400 * img.height / img.width)
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height)
      const d = g.getImageData(0, 0, c.width, c.height).data
      let s = 0, dark = 0, n = 0
      for (let i = 0; i < d.length; i += 4) { const y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; s += y; if (y < 20) dark++; n++ }
      return { mean: +(s / n).toFixed(1), black: Math.round(100 * dark / n) }
    }, buf.toString('base64'))
    rows.push(`${name.padEnd(9)} mean ${String(r.mean).padStart(5)}  near-black ${String(r.black).padStart(3)}%`)
  }
  await page.goto(require('./lib.cjs').BASE + '/', { waitUntil: 'load' })
  await page.waitForSelector('.sg-board'); await page.waitForTimeout(2200); await measure('gate')
  await page.click('.sg-board'); await page.waitForSelector('.title-card'); await page.waitForTimeout(6000); await measure('title')
  await player(page, { name: 'Bright' })
  await page.waitForTimeout(2500); await measure('landing')
  await enter(page)
  await page.waitForSelector('.question-bar', { timeout: 60000 }); await page.waitForTimeout(1500)
  await page.click('.q-fold').catch(() => undefined)
  await measure('hall')
  await player(page, { level: 2, stage: 2, name: 'Bright2' })
  await enter(page)
  await page.waitForSelector('.question-bar', { timeout: 60000 }); await page.waitForTimeout(1500); await measure('library')
  await player(page, { level: 3, stage: 1, name: 'Bright3' })
  await enter(page)
  await page.waitForSelector('.question-bar', { timeout: 60000 }); await page.waitForTimeout(1500); await measure('crypt')
  console.log(`── ${TAG}\n` + rows.join('\n'))
  console.log(errs.join('\n') || 'no page errors')
  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
