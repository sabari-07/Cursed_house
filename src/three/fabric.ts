// Procedural cloth for Arjun: small tileable colour / normal / roughness maps
// generated once on a canvas (no image files) and shared by every ArjunModel.
// Wool for the coat, felt for the hat, knit for the scarf, leather for gloves.
//
// The large folds of the coat are in the geometry (see coatFold); the maps
// only carry fine fibre detail, so they can be small and repeated. Generation
// takes a few tens of milliseconds and happens once per page load.

import * as THREE from 'three'

export interface ClothMaps {
  map: THREE.CanvasTexture
  normalMap: THREE.CanvasTexture
  roughnessMap: THREE.CanvasTexture
}

/** Tileable value noise on an integer lattice of `period` cells. */
function latticeNoise(seed: number, period: number) {
  const P = period
  const grid = new Float32Array(P * P)
  let s = seed * 9301 + 49297
  for (let i = 0; i < P * P; i++) { s = (s * 9301 + 49297) % 233280; grid[i] = s / 233280 }
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y)
    const fx = x - xi, fy = y - yi
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy)
    const w = (i: number) => ((i % P) + P) % P
    const a = grid[w(yi) * P + w(xi)], b = grid[w(yi) * P + w(xi + 1)]
    const c = grid[w(yi + 1) * P + w(xi)], d = grid[w(yi + 1) * P + w(xi + 1)]
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
  }
}

function bake(
  size: number,
  height: (x: number, y: number) => number,
  colour: (h: number, x: number, y: number) => [number, number, number],
  rough: (h: number) => number,
  bump: number,
  repeat: number,
): ClothMaps {
  const N = size
  const hgt = new Float32Array(N * N)
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) hgt[y * N + x] = height(x, y)
  const mk = () => { const c = document.createElement('canvas'); c.width = N; c.height = N; return c }
  const cc = mk(), nc = mk(), rc = mk()
  const cx = cc.getContext('2d')!, nx = nc.getContext('2d')!, rx = rc.getContext('2d')!
  const ci = cx.createImageData(N, N), ni = nx.createImageData(N, N), ri = rx.createImageData(N, N)
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, k = i * 4, h = hgt[i]
    const [r, g, b] = colour(h, x, y)
    ci.data[k] = r; ci.data[k + 1] = g; ci.data[k + 2] = b; ci.data[k + 3] = 255
    const hx = hgt[y * N + ((x + 1) % N)] - hgt[y * N + ((x - 1 + N) % N)]
    const hy = hgt[((y - 1 + N) % N) * N + x] - hgt[((y + 1) % N) * N + x]
    const vx = -hx * bump, vy = -hy * bump, len = Math.hypot(vx, vy, 1)
    ni.data[k] = (vx / len * 0.5 + 0.5) * 255
    ni.data[k + 1] = (vy / len * 0.5 + 0.5) * 255
    ni.data[k + 2] = (0.5 / len + 0.5) * 255
    ni.data[k + 3] = 255
    ri.data[k] = ri.data[k + 1] = ri.data[k + 2] = rough(h) * 255; ri.data[k + 3] = 255
  }
  cx.putImageData(ci, 0, 0); nx.putImageData(ni, 0, 0); rx.putImageData(ri, 0, 0)
  const tex = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(repeat, repeat)
    t.anisotropy = 8
    return t
  }
  return { map: tex(cc, true), normalMap: tex(nc, false), roughnessMap: tex(rc, false) }
}

const cache = new Map<string, ClothMaps>()
const once = (key: string, make: () => ClothMaps) => {
  let m = cache.get(key)
  if (!m) { m = make(); cache.set(key, m) }
  return m
}

/** Felted charcoal-blue wool with a fine weave (tiles 8x across the coat). */
export function woolCoat(): ClothMaps {
  return once('wool', () => {
    const N = 256
    const a = latticeNoise(3, 16), b = latticeNoise(7, 64), c = latticeNoise(13, 8)
    return bake(N,
      (x, y) => a(x / 16, y / 16) * 0.55 + b(x / 4, y / 4) * 0.3 + ((x + y) % 2) * 0.06,
      (h, x, y) => { const k = 0.82 + 0.22 * h + 0.18 * (c(x / 32, y / 32) - 0.5); return [30 * k, 30 * k, 38 * k] },
      h => 0.8 + 0.15 * h,
      // a soft nap, not a glittering bump: heavy wool barely catches the light
      1.6, 8)
  })
}

/** Brushed felt for the fedora. */
export function feltHat(): ClothMaps {
  return once('felt', () => {
    const a = latticeNoise(11, 32), b = latticeNoise(17, 8)
    return bake(128,
      (x, y) => a(x / 4, y / 4) * 0.4 + b(x / 16, y / 16) * 0.2,
      h => { const k = 0.7 + 0.5 * h; return [24 * k, 22 * k, 26 * k] },
      () => 0.88,
      3, 4)
  })
}

/** Dark red wool knit for the scarf. */
export function knitScarf(): ClothMaps {
  return once('knit', () => {
    const a = latticeNoise(5, 8)
    return bake(64,
      (x, y) => Math.abs(Math.sin((x / 64) * Math.PI * 8)) * 0.5 + Math.abs(Math.sin((y / 64) * Math.PI * 6 + Math.sin((x / 64) * Math.PI * 8))) * 0.3,
      (h, x, y) => { const k = 0.55 + 0.6 * h + 0.2 * (a(x / 8, y / 8) - 0.5); return [80 * k, 22 * k, 28 * k] },
      () => 0.95,
      5, 4)
  })
}

/** Worn black leather for the gloves. */
export function leatherGlove(): ClothMaps {
  return once('leather', () => {
    const a = latticeNoise(9, 16)
    return bake(64,
      (x, y) => a(x / 4, y / 4) * 0.5,
      h => { const k = 0.7 + 0.6 * h; return [22 * k, 18 * k, 16 * k] },
      h => 0.45 + 0.3 * h,
      4, 2)
  })
}

/** The drape of a long coat: folds hanging from the shoulders, deepening toward the hem. 0 = valley, 1 = ridge. */
export function coatFold(u: number, v: number): number {
  const a = u * Math.PI * 2
  const depth = THREE.MathUtils.smoothstep(0.95 - v, 0.05, 0.75)
  const f = Math.sin(a * 9 + Math.sin(a * 3) * 1.2) * 0.55
          + Math.sin(a * 17 + 1.3 + Math.sin(a * 5 + v * 4)) * 0.3
          + Math.sin(a * 5 + 2.1) * 0.25
  return 0.5 + 0.5 * f * depth
}
