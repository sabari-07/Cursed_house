// Where the landing's firelight effects act. The scene is frozen, then each light is switched
// on its own and the frame is compared with the rest state:
//   lantern   the tree lantern goes out
//   pump<i>   pumpkin i's flame goes out (each one in PUMPKINS)
//   window    the dark upstairs window glows
//   figure    ... with the figure standing in it
// Prints the bounding box of each change in painting px, so it can be checked against the
// measured positions. Out: out/lights_rest.png, out/lights_<name>.png and
// out/lights_<name>_diff.png (changed pixels in red). Needs the dev server.
const fs = require('fs')
const { launch, BASE, T, check } = require('./lib.cjs')
;(async () => {
  const { browser, page, errs } = await launch()
  await page.goto(BASE + '/?nointro', { waitUntil: 'load' })
  await page.waitForSelector('.landing-curtain.is-open', { timeout: 60000 })
  await page.waitForTimeout(3000)
  // freeze: no clock, no blinkers, no lightning, no UI
  await page.evaluate(() => {
    const L = window.__landing
    L.clock = { getDelta: () => 0, elapsedTime: 10 }
    L.updateBlinker = (_s, _k, _d, _b, _sp, cur) => cur
    L.updateWindow = () => {}
    L.updatePumpkins = () => {}
    L.updateLightning = () => {}
    L.uniforms.uFlash.value = 0
    if (L.bolt) L.bolt.visible = false
    const css = document.createElement('style')
    css.textContent = 'body *:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; }'
    document.head.appendChild(css)
  })
  const pumps = await page.evaluate(() => window.__landing.uniforms.uPump.value.map(v => [v.x, v.y, v.z, v.w]))
  const set = vals => page.evaluate(v => {
    const u = window.__landing.uniforms
    u.uLampOn.value = 1; u.uWinOn.value = 0; u.uWinSil.value = 0
    u.uPumpOn.value = u.uPumpOn.value.map(() => 1)
    for (const [k, x] of Object.entries(v)) {
      if (k.startsWith('pump')) u.uPumpOn.value[+k.slice(4)] = x
      else u[k].value = x
    }
  }, vals)
  const shot = async name => { await page.waitForTimeout(250); return page.screenshot({ path: `${T}lights_${name}.png` }) }
  const map = await page.evaluate(() => ({ s: window.__landing.mapScale, ox: window.__landing.mapOffset.x, oy: window.__landing.mapOffset.y }))
  const diff = (a, b) => page.evaluate(async ([a, b, map]) => {
    const load = async b64 => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); return i }
    const A = await load(a), B = await load(b)
    const c = document.createElement('canvas'); c.width = A.width; c.height = A.height
    const g = c.getContext('2d')
    g.drawImage(A, 0, 0); const da = g.getImageData(0, 0, c.width, c.height)
    g.drawImage(B, 0, 0); const db = g.getImageData(0, 0, c.width, c.height)
    const out = g.createImageData(c.width, c.height)
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0
    for (let i = 0; i < da.data.length; i += 4) {
      const d = Math.abs(da.data[i] - db.data[i]) + Math.abs(da.data[i + 1] - db.data[i + 1]) + Math.abs(da.data[i + 2] - db.data[i + 2])
      const p = i / 4, x = p % c.width, y = (p / c.width) | 0
      const k = Math.min(1, d / 60)
      out.data[i] = da.data[i] * (1 - k) * 0.6 + 255 * k; out.data[i + 1] = da.data[i + 1] * (1 - k) * 0.6; out.data[i + 2] = da.data[i + 2] * (1 - k) * 0.6; out.data[i + 3] = 255
      if (d > 24) { n++; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y }
    }
    g.putImageData(out, 0, 0)
    // screen px (y down) -> painting px, as in the shader: px = (screenPx - offset) / scale
    const toP = (x, y) => [Math.round((x - map.ox) / map.s), Math.round((y - map.oy) / map.s)]
    return { png: c.toDataURL('image/png').split(',')[1], n, box: n ? [...toP(x0, y0), ...toP(x1, y1)] : null }
  }, [a.toString('base64'), b.toString('base64'), map])
  // the expected area of each change (painting px), with a margin for glow and rounding
  const lights = [
    ['lantern', { uLampOn: 0 }, [93 - 42, 228 - 40, 93 + 42, 228 + 40]],
    ...pumps.map(([x, y, rx, ry], i) => [`pump${i}`, { [`pump${i}`]: 0 }, [x - rx * 1.6, y - ry * 1.6, x + rx * 1.6, y + ry * 1.6]]),
    ['window', { uWinOn: 1 }, [676 - 14, 252 - 10, 701 + 14, 285 + 14]],
    ['figure', { uWinOn: 1, uWinSil: 1 }, [676 - 14, 252 - 10, 701 + 14, 285 + 14]],
  ]
  await set({})
  const rest = await shot('rest')
  let lit = null
  for (const [name, vals, want] of lights) {
    await set(vals)
    const img = await shot(name)
    // the figure is compared with the lit window, so only the figure shows
    const r = await diff(name === 'figure' ? lit : rest, img)
    if (name === 'window') lit = img
    fs.writeFileSync(`${T}lights_${name}_diff.png`, Buffer.from(r.png, 'base64'))
    const inside = r.box && r.box[0] >= want[0] && r.box[1] >= want[1] && r.box[2] <= want[2] && r.box[3] <= want[3]
    check(r.n > 20 && inside, `${name.padEnd(8)} changed ${String(r.n).padStart(6)} px, box ${JSON.stringify(r.box)} inside ${JSON.stringify(want.map(Math.round))}`)
  }
  console.log(errs.join('\n') || 'no page errors')
  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
