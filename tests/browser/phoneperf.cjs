// Phone performance on the entry screen, the title card ("loading page") and the landing:
// a phone held sideways with the CPU slowed 4x (a mid-range phone). Logs frame gaps over 50 ms,
// the longest gap, average fps per screen, and long tasks with what was running. TAG names the run.
process.env.MOBILE = process.env.MOBILE || 'landscape'
const { launch, BASE } = require('./lib.cjs')
const RATE = Number(process.env.CPU || 4)
;(async () => {
  const { browser, page, errs } = await launch()
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE })
  await page.addInitScript(() => {
    window.__f = []; window.__lt = []
    let last = performance.now()
    const screen = () => document.querySelector('.sound-gate') ? 'gate' : document.querySelector('.title-card') ? 'title' : document.querySelector('.landing-curtain') ? 'landing' : 'other'
    const f = n => { window.__f.push([n - last, screen()]); last = n; requestAnimationFrame(f) }
    requestAnimationFrame(f)
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration), screen()]) }).observe({ type: 'longtask', buffered: true }) } catch {}
  })
  await page.goto(BASE + '/', { waitUntil: 'load' })
  await page.waitForSelector('.sg-board', { timeout: 60000 })
  await page.waitForTimeout(3000)
  await page.tap('.sg-board')
  await page.waitForSelector('.title-card', { timeout: 20000 })
  await page.waitForSelector('.title-card', { state: 'detached', timeout: 60000 })
  await page.waitForTimeout(5000)
  const r = await page.evaluate(() => ({ f: window.__f, lt: window.__lt }))
  const by = {}
  for (const [d, s] of r.f) { (by[s] ||= []).push(d) }
  console.log(`── ${process.env.TAG || 'now'} (CPU ${RATE}x slower)`)
  for (const [s, ds] of Object.entries(by)) {
    const tot = ds.reduce((a, b) => a + b, 0)
    console.log(`${s.padEnd(8)} fps ${(1000 * ds.length / tot).toFixed(1).padStart(5)} | frames > 50 ms: ${ds.filter(d => d > 50).length} | longest ${Math.round(Math.max(...ds))} ms`)
  }
  console.log('long tasks > 200 ms:', JSON.stringify(r.lt.filter(t => t[1] > 200)))
  console.log(errs.join('\n') || 'no page errors')
  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
