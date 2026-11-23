// Cuts the painted hand out of the title painting (run after cutwitch.cjs; reads
// art/title-graveyard-step1.webp, its output). Writes:
//  - public/landing/title-hand.png: the hand (warm pixels connected to the palm,
//    interior gaps closed, edge feathered 2 px, base faded out over SOIL..SOIL+14)
//  - public/landing/title-graveyard.webp: the painting with the hand above the
//    soil filled in: a smooth fill from the border (16 rays, 1/d^2), plus the fine
//    grain of the fog 260 px to the left (high-pass, so its colours are not copied).
// Debug: tests/browser/out/hand_mask.png, hand_fill.png
const fs = require('fs')
const { chromium } = require('playwright-core')
const R = 'c:\\Users\\DS\\Desktop\\hack\\Kiroween_UI\\'
const BOX = { x0: 630, y0: 465, x1: 910, y1: 840 }   // painting px
const SOIL = 816                                       // the mound's top where the wrist enters it
;(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true })
  const page = await browser.newPage()
  const b64 = fs.readFileSync(R + 'art\\title-graveyard-step1.webp').toString('base64')
  const out = await page.evaluate(async ([b64, BOX, SOIL]) => {
    const img = new Image(); img.src = 'data:image/webp;base64,' + b64; await img.decode()
    const W = img.naturalWidth, H = img.naturalHeight
    const c = document.createElement('canvas'); c.width = W; c.height = H
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0)
    const id = g.getImageData(0, 0, W, H), d = id.data, orig = new Uint8ClampedArray(d)
    const at = (x, y) => (y * W + x) * 4
    const bw = BOX.x1 - BOX.x0, bh = BOX.y1 - BOX.y0
    const L = (x, y) => y * bw + x
    // warm: red clearly over blue (the fog is teal, the hand brown and red-lit)
    const warm = new Uint8Array(bw * bh)
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const i = at(BOX.x0 + x, BOX.y0 + y), r = orig[i], gg = orig[i + 1], b = orig[i + 2]
      warm[L(x, y)] = (r - b >= 7 && gg <= r) || (r >= 6 && b <= r * 0.5) ? 1 : 0
    }
    // keep what connects to the palm; below the soil only the wrist's columns
    const keep = new Uint8Array(bw * bh), st = [L(130, 190)]
    keep[st[0]] = 1
    while (st.length) {
      const p = st.pop(), px = p % bw, py = (p / bw) | 0
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = px + dx, ny = py + dy
        if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue
        if (BOX.y0 + ny > SOIL - 30 && (BOX.x0 + nx < 668 || BOX.x0 + nx > 790)) continue
        const q = L(nx, ny)
        if (!keep[q] && warm[q]) { keep[q] = 1; st.push(q) }
      }
    }
    // close: dilate 3, fill interior holes (not reachable from the box edge), erode 3
    const dil = (m, r) => { const o = new Uint8Array(bw * bh); for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { if (!m[L(x, y)]) continue; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < bw && ny < bh && dx * dx + dy * dy <= r * r) o[L(nx, ny)] = 1 } } return o }
    const ero = (m, r) => { const inv = m.map(v => 1 - v); const di = dil(inv, r); return di.map(v => 1 - v) }
    let m = dil(keep, 3)
    const out = new Uint8Array(bw * bh), q2 = []
    for (let x = 0; x < bw; x++) { q2.push(L(x, 0)); }
    for (let y = 0; y < bh; y++) { q2.push(L(0, y), L(bw - 1, y)) }
    for (const p of q2) if (!m[p]) out[p] = 1
    while (q2.length) { const p = q2.pop(); if (m[p]) continue; const px = p % bw, py = (p / bw) | 0
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = px + dx, ny = py + dy; if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue; const q = L(nx, ny); if (!out[q] && !m[q]) { out[q] = 1; q2.push(q) } } }
    m = m.map((v, k) => (v || !out[k] ? 1 : 0))
    m = ero(m, 3)
    // the sprite: original pixels, alpha = mask feathered 2 px, faded at the base
    const soft = new Float32Array(bw * bh)
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      let s = 0, n = 0
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const nx = x + dx, ny = y + dy; n++; if (nx >= 0 && ny >= 0 && nx < bw && ny < bh && m[L(nx, ny)]) s++ }
      const base = Math.min(1, Math.max(0, (SOIL + 14 - (BOX.y0 + y)) / 14))
      soft[L(x, y)] = (s / n) * base
    }
    const sc = document.createElement('canvas'); sc.width = bw; sc.height = bh
    const sg = sc.getContext('2d'), sd = sg.createImageData(bw, bh)
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const i = at(BOX.x0 + x, BOX.y0 + y), k = L(x, y)
      sd.data[k * 4] = orig[i]; sd.data[k * 4 + 1] = orig[i + 1]; sd.data[k * 4 + 2] = orig[i + 2]; sd.data[k * 4 + 3] = Math.round(soft[k] * 255)
    }
    sg.putImageData(sd, 0, 0)
    // the hole: the hand above the soil, grown 4 px (the red rim light), feathered 4 px
    const grown = dil(m, 4), hole = new Float32Array(bw * bh)
    const far = dil(grown, 4)
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const k = L(x, y), Y = BOX.y0 + y
      const below = Y <= SOIL ? 1 : Math.max(0, 1 - (Y - SOIL) / 10)
      hole[k] = (grown[k] ? 1 : far[k] ? 0.5 : 0) * below
    }
    // smooth fill from the hole's border: 16 rays, inverse square distance
    const solid = k => hole[k] < 0.01
    const fill = new Float32Array(bw * bh * 3)
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const k = L(x, y); if (solid(k)) continue
      let wr = 0, acc = [0, 0, 0]
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2, dx = Math.cos(ang), dy = Math.sin(ang)
        for (let s = 1; s < 400; s++) {
          const nx = Math.round(x + dx * s), ny = Math.round(y + dy * s)
          if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) break
          if (solid(L(nx, ny))) { const w = 1 / (s * s); const i = at(BOX.x0 + nx, BOX.y0 + ny); for (let ch = 0; ch < 3; ch++) acc[ch] += orig[i + ch] * w; wr += w; break }
        }
      }
      for (let ch = 0; ch < 3; ch++) fill[k * 3 + ch] = acc[ch] / wr
    }
    // soften the ray fill (two 9 px box blurs inside the hole) so no streaks show
    for (let pass = 0; pass < 2; pass++) {
      const src = fill.slice()
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
        const k = L(x, y); if (solid(k)) continue
        let s = [0, 0, 0], n = 0
        for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
          const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue
          const q = L(nx, ny), i = at(BOX.x0 + nx, BOX.y0 + ny)
          for (let ch = 0; ch < 3; ch++) s[ch] += solid(q) ? orig[i + ch] : src[q * 3 + ch]
          n++
        }
        for (let ch = 0; ch < 3; ch++) fill[k * 3 + ch] = s[ch] / n
      }
    }
    // mist: soft value noise in three octaves, brightening and darkening the fill a little
    const hash = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v) }
    const vnoise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
      const a = hash(xi, yi), b = hash(xi + 1, yi), c2 = hash(xi, yi + 1), e = hash(xi + 1, yi + 1)
      return a + (b - a) * sx + (c2 - a) * sy + (a - b - c2 + e) * sx * sy }
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const k = L(x, y), h = hole[k]; if (h < 0.01) continue
      const X = BOX.x0 + x, Y = BOX.y0 + y, t = at(X, Y)
      const mist = (vnoise(X / 38, Y / 16) * 0.55 + vnoise(X / 14, Y / 7) * 0.3 + vnoise(X / 4, Y / 4) * 0.15 - 0.5)
      for (let ch = 0; ch < 3; ch++) {
        const grain = mist * 26 * (ch === 0 ? 0.6 : 1)
        const v = fill[k * 3 + ch] + grain
        d[t + ch] = Math.round(orig[t + ch] * (1 - h) + Math.max(0, Math.min(255, v)) * h)
      }
    }
    g.putImageData(id, 0, 0)
    // debug views
    const crop = (src, tint) => { const k = document.createElement('canvas'); k.width = bw; k.height = bh; const kg = k.getContext('2d'); kg.drawImage(src, BOX.x0, BOX.y0, bw, bh, 0, 0, bw, bh); if (tint) { kg.globalAlpha = 0.45; kg.drawImage(sc, 0, 0) } return k.toDataURL('image/png') }
    const mk = document.createElement('canvas'); mk.width = bw; mk.height = bh; const mg = mk.getContext('2d'); mg.drawImage(img, BOX.x0, BOX.y0, bw, bh, 0, 0, bw, bh)
    const md = mg.getImageData(0, 0, bw, bh); for (let k = 0; k < bw * bh; k++) if (hole[k] > 0.5) { md.data[k * 4 + 1] = 255 }
    mg.putImageData(md, 0, 0)
    return { bg: c.toDataURL('image/webp', 0.97), sprite: sc.toDataURL('image/png'), mask: mk.toDataURL('image/png'), filled: crop(c, false), size: [W, H] }
  }, [b64, BOX, SOIL])
  const w = (p, u) => fs.writeFileSync(p, Buffer.from(u.split(',')[1], 'base64'))
  if (process.env.WRITE) { w(R + 'public\\landing\\title-graveyard.webp', out.bg); w(R + 'public\\landing\\title-hand.png', out.sprite) }
  w(R + 'tests\\browser\\out\\hand_mask.png', out.mask); w(R + 'tests\\browser\\out\\hand_fill.png', out.filled); w(R + 'tests\\browser\\out\\hand_sprite.png', out.sprite)
  console.log('done', out.size, process.env.WRITE ? 'written' : 'preview only')
  await browser.close()
})()
