// The landing's jack-o'-lanterns flicker so it can be seen: over 12 s the brightness of each big
// pumpkin's carved face (mean of its pixels, read back from the canvas) must swing by at least
// 25 %, and its flame level (uPumpOn) must dip below 0.5 at least once. The face is sampled
// each 50 ms next to the uniform, so the picture is checked, not only the number.
// Out: out/pumpkins_bright.jpg and out/pumpkins_dim.jpg (the right big pumpkin at full flame and in a gutter).
const { launch, BASE, T, check } = require('./lib.cjs')
;(async () => {
  const { browser, page, errs } = await launch()
  await page.goto(BASE + '/?nointro', { waitUntil: 'load' })
  await page.waitForSelector('.landing-curtain.is-open', { timeout: 60000 })
  await page.waitForTimeout(1500)
  // no lightning during the sample: it would light the pumpkins too
  await page.evaluate(() => { const L = window.__landing; L.updateLightning = () => { L.uniforms.uFlash.value = 0 } })
  const faces = { left: [196, 830, 70, 40], right: [1361, 780, 70, 35] }   // painting px: centre, half size of the carved face
  const log = await page.evaluate(async faces => {
    const L = window.__landing, canvas = document.querySelector('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    const out = []
    const sample = () => {
      const row = { t: +performance.now().toFixed(0), on: [...L.uniforms.uPumpOn.value].map(v => +v.toFixed(3)) }
      for (const [k, [cx, cy, hw, hh]] of Object.entries(faces)) {
        const s = L.mapScale, ox = L.mapOffset.x, oy = L.mapOffset.y, dpr = canvas.width / canvas.clientWidth
        const x = Math.round((ox + (cx - hw) * s) * dpr), y = Math.round((oy + (cy + hh) * s) * dpr)
        const w = Math.round(2 * hw * s * dpr), h = Math.round(2 * hh * s * dpr)
        const px = new Uint8Array(w * h * 4)
        gl.readPixels(x, canvas.height - y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px)
        let sum = 0
        for (let i = 0; i < px.length; i += 4) sum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]
        row[k] = +(sum / (w * h)).toFixed(1)
      }
      out.push(row)
    }
    // read right after the scene draws (same frame, before the buffer is cleared)
    const orig = L.renderer.render.bind(L.renderer)
    L.renderer.render = (s, c) => { orig(s, c); if (out.length < 1e5 && (!out.last || performance.now() - out.last >= 50)) { out.last = performance.now(); sample() } }
    await new Promise(r => setTimeout(r, 12000))
    L.renderer.render = orig
    return out
  }, faces)
  for (const [k, idx] of [['left', 4], ['right', 5]]) {
    const v = log.map(r => r[k]).filter(x => x > 0)
    const on = log.map(r => r.on[idx])
    const hi = Math.max(...v), lo = Math.min(...v)
    check(v.length > 50 && (hi - lo) / hi >= 0.25 && Math.min(...on) < 0.5,
      `${k} pumpkin: face brightness ${lo.toFixed(0)}-${hi.toFixed(0)} (swing ${Math.round(100 * (hi - lo) / hi)} %), flame ${Math.min(...on).toFixed(2)}-${Math.max(...on).toFixed(2)}, ${v.length} samples`)
  }
  const small = [0, 1, 2, 3].map(i => Math.min(...log.map(r => r.on[i])))
  check(small.every(m => m < 0.5), `veranda pumpkins dip too: lowest flame ${small.map(m => m.toFixed(2)).join(', ')}`)
  // the right big pumpkin (the left one sits under the player card) at full flame and guttering
  await page.evaluate(() => { const L = window.__landing; L.updatePumpkins = () => {} })
  const clip = await page.evaluate(() => { const L = window.__landing, s = L.mapScale; return { x: L.mapOffset.x + 1220 * s, y: L.mapOffset.y + 680 * s, width: Math.min(290 * s, innerWidth - (L.mapOffset.x + 1220 * s)), height: 190 * s } })
  for (const [name, v] of [['bright', 1], ['dim', 0.2]]) {
    await page.evaluate(v => { window.__landing.uniforms.uPumpOn.value[5] = v }, v)
    await page.waitForTimeout(200)
    await page.screenshot({ path: `${T}pumpkins_${name}.jpg`, quality: 80, clip })
  }
  console.log(errs.join('\n') || 'no page errors')
  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
