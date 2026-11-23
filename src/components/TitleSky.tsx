import { useEffect, useRef } from 'react'

/**
 * The sky over the title card's painting, on one 2D canvas: low cloud
 * drifting across, a flock of bats wheeling round the blood moon and the
 * house, and the painting's own witch flying a slow circle round the moon
 * (cut out of the painting by scripts; the moon behind her was filled in). Everything stays dark
 * and soft, so it reads as part of the painting.
 *
 * Positions are fractions of the screen; the painting is shown cover-fit at
 * 16:9, so on a 16:9 screen they match it (the moon is about x 0.86, y 0.17).
 */
const MOON = { x: 0.86, y: 0.17 }
/** The painting's size, and where its witch was painted (her sprite's top left, painting px). */
const ART = { w: 1672, h: 941 }
export const WITCH_SPRITE = { url: '/landing/title-witch.png', x: 1398, y: 84, w: 144, h: 94 }
/** Her flight: one wide loop over the whole painting (painting px): left along the top of the sky, down past the lantern tree, back right low over the graveyard, up to the moon. One lap in LAP seconds. */
const LOOP = { cx: 860, cy: 300, rx: 720, ry: 210 }, LAP = 10

interface Bat { a: number; r: number; ry: number; speed: number; size: number; phase: number; cx: number; cy: number; flap: number }

const TOUCH = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
const rnd = (k: number) => { const v = Math.sin(k * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v) }

/**
 * One band of storm cloud as a small image that tiles left to right: fractal
 * value noise (5 octaves, wrapping in x), stretched wide, thresholded into
 * wisps with soft edges. Lit cores are moonlit grey, the edges dark smoke.
 * Built once (256 x 85 px) and drawn scaled up, so it costs two drawImage calls a frame.
 */
function cloudBand(seed: number, lit: [number, number, number], dark: [number, number, number], maxA: number): HTMLCanvasElement {
  const W = 256, H = 85, P = 5                       // P noise cells across, per octave doubled
  const hash = (x: number, y: number) => { const v = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453; return v - Math.floor(v) }
  // the lattice of each octave, computed once (the per-sample sin() was most of the cost on phones)
  const lattices = [0, 1, 2, 3, 4].map(o => {
    const per = P << o, rows = Math.ceil(2.2 * (1 << o)) + 2, t = new Float32Array(per * rows)
    for (let y = 0; y < rows; y++) for (let x = 0; x < per; x++) t[y * per + x] = hash(x, y)
    return { per, t }
  })
  const vnoise = (x: number, y: number, o: number) => {
    const { per, t } = lattices[o]
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
    const x0 = ((xi % per) + per) % per, x1 = (x0 + 1) % per
    const a = t[yi * per + x0], b = t[yi * per + x1], c = t[(yi + 1) * per + x0], d = t[(yi + 1) * per + x1]
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
  }
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H
  const g = cv.getContext('2d')!, img = g.createImageData(W, H)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let n = 0, amp = 0.5, f = 1
    for (let o = 0; o < 5; o++) { n += amp * vnoise((x / W) * P * f, (y / H) * 2.2 * f, o); amp *= 0.5; f *= 2 }
    const v = Math.min(1, Math.max(0, (n - 0.4) / 0.32))       // wisps, gaps between them
    const yf = y / H, band = Math.min(1, yf / 0.15) * Math.min(1, (1 - yf) / 0.45)   // fades top and bottom
    const s = Math.min(1, Math.max(0, (n - 0.55) / 0.25))       // brighter where it is thick
    const k = (y * W + x) * 4
    for (let ch = 0; ch < 3; ch++) img.data[k + ch] = dark[ch] + (lit[ch] - dark[ch]) * s
    img.data[k + 3] = Math.round(255 * maxA * v * v * (3 - 2 * v) * band)
  }
  g.putImageData(img, 0, 0)
  return cv
}

/** A bat facing +x, wings up (f = 1) to down (f = -1), about 2 units wide. */
function batPath(g: CanvasRenderingContext2D, f: number): void {
  const up = -0.55 * f
  g.beginPath()
  g.moveTo(0, -0.08)
  // left wing: three scalloped fingers
  g.quadraticCurveTo(-0.35, up - 0.1, -1, up)
  g.quadraticCurveTo(-0.8, up + 0.18, -0.68, up + 0.32)
  g.quadraticCurveTo(-0.55, up + 0.2, -0.4, up + 0.38)
  g.quadraticCurveTo(-0.28, up * 0.4 + 0.15, -0.12, 0.12)
  // body and ears
  g.lineTo(-0.06, 0.2); g.lineTo(0.06, 0.2); g.lineTo(0.12, 0.12)
  // right wing, mirrored
  g.quadraticCurveTo(0.28, up * 0.4 + 0.15, 0.4, up + 0.38)
  g.quadraticCurveTo(0.55, up + 0.2, 0.68, up + 0.32)
  g.quadraticCurveTo(0.8, up + 0.18, 1, up)
  g.quadraticCurveTo(0.35, up - 0.1, 0, -0.08)
  g.closePath()
  g.fill()
  g.beginPath(); g.moveTo(-0.07, -0.08); g.lineTo(-0.05, -0.2); g.lineTo(0, -0.1); g.lineTo(0.05, -0.2); g.lineTo(0.07, -0.08); g.fill()
}

export function TitleSky() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const g = c.getContext('2d')!
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let w = 0, h = 0, dpr = 1, raf = 0
    const resize = () => {
      dpr = Math.min(TOUCH ? 1.25 : 2, window.devicePixelRatio || 1)   // phones: fewer pixels for soft cloud and small bats
      w = window.innerWidth; h = window.innerHeight
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr)
    }
    resize()
    window.addEventListener('resize', resize)

    // cloud: two bands of storm cloud drifting right to left across the upper sky,
    // the far one higher and slower, the near one lower, darker and faster (screen widths per second)
    const layers = [
      { img: cloudBand(1, [96, 92, 100], [24, 24, 30], 0.62), top: -0.02, height: 0.36, speed: 0.022 },
      { img: cloudBand(2, [70, 62, 66], [12, 12, 16], 0.7), top: 0.12, height: 0.34, speed: 0.04 },
    ]
    // bats: a loose flock round the moon, a few round the house's roof
    const bats: Bat[] = Array.from({ length: 11 }, (_, i) => {
      const nearMoon = i < 7
      return {
        a: rnd(i + 200) * Math.PI * 2, r: (nearMoon ? 0.07 : 0.05) + rnd(i + 220) * 0.07, ry: 0.45 + rnd(i + 240) * 0.3,
        speed: (0.35 + rnd(i + 260) * 0.35) * (rnd(i + 280) > 0.3 ? 1 : -1), size: 10 + rnd(i + 300) * 10, phase: rnd(i + 320) * 6,
        cx: nearMoon ? MOON.x - 0.02 : 0.62 + rnd(i + 340) * 0.08, cy: nearMoon ? MOON.y + 0.02 : 0.2 + rnd(i + 360) * 0.06,
        flap: 9 + rnd(i + 380) * 5,
      }
    })
    const witch = new Image(); witch.src = WITCH_SPRITE.url
    // the sky is hidden until she can be drawn, so the moon never shows without her
    c.style.opacity = '0'
    const show = () => { c.style.opacity = '1' }
    if (witch.complete) show(); else witch.onload = show
    const t0 = performance.now() / 1000

    const frame = () => {
      raf = requestAnimationFrame(frame)
      const t = performance.now() / 1000 - t0
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, w, h)

      // ── cloud: each band tiles across the screen and scrolls left
      for (const L of layers) {
        const off = reduced ? 0 : ((L.speed * t) % 1) * w
        const y = L.top * h, bh = L.height * h
        g.drawImage(L.img, -off, y, w, bh)
        g.drawImage(L.img, w - off, y, w, bh)
      }

      // ── bats
      g.fillStyle = '#050607'
      for (const b of bats) {
        const a = b.a + (reduced ? 0 : b.speed * t)
        const x = (b.cx + Math.cos(a) * b.r) * w
        const y = (b.cy + Math.sin(a) * b.r * b.ry) * h + Math.sin(t * 1.7 + b.phase) * 4
        const dir = Math.sign(-Math.sin(a) * b.speed) || 1
        const s = b.size * (h / 900) * (0.85 + 0.25 * Math.sin(a))          // nearer on one side of the loop
        g.save(); g.translate(x, y); g.scale(s * dir, s)
        batPath(g, reduced ? 0.4 : Math.sin(t * b.flap + b.phase))
        g.restore()
      }

      // ── the painting's witch: she starts exactly where she was painted, then
      // flies a slow loop round the moon (left along the top, right along the bottom)
      if (witch.complete && witch.naturalWidth) {
        const sc = Math.max(w / ART.w, h / ART.h), ox = (w - ART.w * sc) / 2, oy = (h - ART.h * sc) / 2
        const a0 = Math.atan2((WITCH_SPRITE.y + WITCH_SPRITE.h / 2 - LOOP.cy) / LOOP.ry, (WITCH_SPRITE.x + WITCH_SPRITE.w / 2 - LOOP.cx) / LOOP.rx)
        const a = a0 - (reduced ? 0 : (Math.PI * 2 * t) / LAP)
        const loop = (k: number) => [LOOP.cx + LOOP.rx * Math.cos(k), LOOP.cy + LOOP.ry * Math.sin(k)]
        const [lx, ly] = loop(a), [sx, sy] = loop(a0)
        const vx = LOOP.rx * Math.sin(a)                         // her heading (sign only)
        const px = WITCH_SPRITE.x + (lx - sx), py = WITCH_SPRITE.y + (ly - sy) + Math.sin(t * 2.1) * 2.5
        const near = 1 + 0.35 * (Math.sin(a) + 1) / 2                  // larger as she swoops low and near
        const dw = WITCH_SPRITE.w * sc * near, dh = WITCH_SPRITE.h * sc * near
        g.save()
        g.translate(ox + (px + WITCH_SPRITE.w / 2) * sc, oy + (py + WITCH_SPRITE.h / 2) * sc)
        g.rotate(Math.cos(a) * 0.08 + Math.sin(t * 2.1) * 0.02)
        if (vx > 0) g.scale(-1, 1)                                    // she faces the way she flies
        if (!TOUCH) { g.shadowColor = 'rgba(200, 40, 30, .55)'; g.shadowBlur = 4 * dpr }   // a canvas blur every frame is slow on phones
        g.drawImage(witch, -dw / 2, -dh / 2, dw, dh)
        g.restore()
      }
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={ref} className="tc-sky" aria-hidden="true" />
}
