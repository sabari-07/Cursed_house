// Arjun: the man in the long coat and fedora with a lantern. One model, used
// on the landing page and inside the bungalow so he is always the same man.
// Units: feet at y = 0, top of the hat ≈ 1.0; he faces +z (toward the camera).

import * as THREE from 'three'
import { coatFold, feltHat, knitScarf, leatherGlove, woolCoat } from './fabric'

/** The sculpted head and its painted skin / hair canvases, made once per page. */
interface HeadParts { geo: THREE.SphereGeometry; canvas: HTMLCanvasElement; hairCanvas: HTMLCanvasElement }
let headParts: HeadParts | null = null
/** The baked face and hair (public/arjun/), made by scripts/bake-arjun.cjs from makeHeadParts. */
export const ARJUN_SKIN = '/arjun/skin.png', ARJUN_HAIR = '/arjun/hair.png'
let baked: { skin: HTMLImageElement; hair: HTMLImageElement } | null = null
/**
 * Loads the baked face and hair before Arjun is built, so phones skip ~3 s of
 * per-pixel painting. Without them (a failed load) the model paints them itself.
 */
export async function preloadArjun(): Promise<void> {
  if (baked || headParts) return
  const load = (u: string) => new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = u })
  try {
    const [skin, hair] = await Promise.all([load(ARJUN_SKIN), load(ARJUN_HAIR)])
    await Promise.all([skin.decode?.(), hair.decode?.()]).catch(() => undefined)
    baked = { skin, hair }
  } catch { /* painted in code */ }
}
/** For scripts/bake-arjun.cjs: the painted face and hair canvases. */
export function paintArjunHead(): { skin: HTMLCanvasElement; hair: HTMLCanvasElement } {
  const p = ArjunModel.paintHead()
  return { skin: p.canvas, hair: p.hairCanvas }
}

/** Resamples a lathe profile so it has `n` rows (folds need vertical detail). */
function densify(pts: number[][], n: number): THREE.Vector2[] {
  const seg: number[] = [0]
  for (let i = 1; i < pts.length; i++) seg.push(seg[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const total = seg[seg.length - 1]
  const out: THREE.Vector2[] = []
  for (let k = 0; k < n; k++) {
    const d = (k / (n - 1)) * total
    let i = 1
    while (i < seg.length - 1 && seg[i] < d) i++
    const t = (d - seg[i - 1]) / Math.max(1e-6, seg[i] - seg[i - 1])
    out.push(new THREE.Vector2(
      pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t,
      pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t))
  }
  return out
}

/** A sleeve: tapered tube with soft folds bunched at the elbow and a wide cuff. */
function sleeveGeo(len: number, r0: number, r1: number, elbowBunch: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r0, r1, len, 28, 24, false)
  const p = g.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    const a = Math.atan2(x, z)
    const t = y / len + 0.5                                     // 0 bottom .. 1 top
    // horizontal creases where the cloth bunches, a few vertical drape folds
    const bunch = Math.sin(t * 26 + Math.sin(a * 2) * 1.5) * 0.06 * elbowBunch * Math.exp(-((t - 0.1) ** 2) * 18)
    const drape = Math.sin(a * 5 + t * 3) * 0.035 + Math.sin(a * 9 + 1.7) * 0.015
    const k = 1 + bunch + drape
    p.setX(i, x * k)
    p.setZ(i, z * k)
  }
  g.computeVertexNormals()
  return g
}

export class ArjunModel {
  readonly root = new THREE.Group()
  readonly inner = new THREE.Group()
  lanternGlass: THREE.Mesh | null = null
  readonly lanternLight = new THREE.PointLight(0xffa24a, 5, 100, 0)
  /** legs[0] = right, legs[1] = left */
  legs: Array<{ hip: THREE.Group; knee: THREE.Group; ankle: THREE.Group }> = []
  /** arms[0] = right (holds the lantern), arms[1] = left */
  arms: Array<{ shoulder: THREE.Group; elbow: THREE.Group; hand: THREE.Mesh }> = []
  /** Lantern pivot (at the right hand). */
  lantern: THREE.Group | null = null
  private coatGeo: THREE.LatheGeometry | null = null
  private coatRest: Float32Array | null = null
  /** Lantern pendulum state (angle, angular velocity) and last hand velocity. */
  private lanternSwing = { a: 0, v: 0, lastZ: 0 }

  constructor() {
    // Units: feet at y = 0, top of hat ≈ 1.0. Model faces +z (toward camera).
    // Cloth is textured with generated wool / felt / knit / leather maps so it
    // reads as fabric, not plastic.
    // one small tileable wool texture (generated once, shared); the coat's
    // big folds are in its geometry
    const wool = woolCoat()
    const coat = new THREE.MeshStandardMaterial({
      color: 0xffffff, ...wool, normalScale: new THREE.Vector2(1, 1), roughness: 1, metalness: 0,
    })
    const sleeveWool = wool
    const coatPlain = coat
    const trousers = new THREE.MeshStandardMaterial({ color: 0x141217, roughness: 0.9 })
    const boots = new THREE.MeshStandardMaterial({ color: 0x0d0b0a, roughness: 0.6 })
    const skin = new THREE.MeshStandardMaterial({ color: 0x8c5a3e, roughness: 0.75 })
    const glove = new THREE.MeshStandardMaterial({ color: 0xffffff, ...leatherGlove(), roughness: 1 })
    const felt = feltHat()
    const hat = new THREE.MeshStandardMaterial({ color: 0xffffff, ...felt, roughness: 1, normalScale: new THREE.Vector2(0.8, 0.8) })
    const metal = new THREE.MeshStandardMaterial({ color: 0x2a2520, metalness: 0.7, roughness: 0.4 })
    const add = (mesh: THREE.Mesh, x: number, y: number, z = 0) => {
      mesh.position.set(x, y, z)
      this.inner.add(mesh)
      return mesh
    }

    // Legs: real proportions (hip at ~48% of height, thigh + shin) so the
    // walk has a knee bend and planted feet. Mostly hidden by the long coat;
    // the shins and boots show below the hem. legs[0] = right, legs[1] = left.
    for (const side of [-1, 1]) {
      const hip = new THREE.Group()
      hip.position.set(side * 0.048, 0.47, 0)
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.032, 0.24, 10), trousers)
      thigh.position.y = -0.12
      hip.add(thigh)
      const knee = new THREE.Group()
      knee.position.y = -0.24
      hip.add(knee)
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.026, 0.215, 10), trousers)
      shin.position.y = -0.107
      knee.add(shin)
      const ankle = new THREE.Group()
      ankle.position.y = -0.21
      knee.add(ankle)
      const boot = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 8), boots)
      boot.position.set(side * 0.002, -0.008, 0.018)
      boot.scale.set(0.85, 0.6, 1.5)
      ankle.add(boot)
      this.inner.add(hip)
      this.legs.push({ hip, knee, ankle })
    }

    // Greatcoat: tailored lathe profile with a flared, slightly uneven hem.
    const profile = densify([
      [0.0, 0.13], [0.15, 0.125], [0.158, 0.14], [0.142, 0.22], [0.126, 0.33],
      [0.112, 0.45], [0.104, 0.52], [0.112, 0.6], [0.126, 0.66], [0.128, 0.69],
      // sloping shoulders up to the neck (no flat "table" top)
      [0.116, 0.718], [0.094, 0.742], [0.066, 0.763], [0.04, 0.775], [0.0, 0.778],
    ], 64)
    const coatGeo = new THREE.LatheGeometry(profile, 96)
    const cp = coatGeo.getAttribute('position') as THREE.BufferAttribute
    const cuv = coatGeo.getAttribute('uv') as THREE.BufferAttribute
    for (let i = 0; i < cp.count; i++) {
      let x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i)
      // u: 0 = front, 0.5 = centre back (matches the wool texture); v = height
      let a = Math.atan2(x, z)
      if (a < 0) a += Math.PI * 2
      const u = a / (Math.PI * 2), v = y / 0.8
      cuv.setXY(i, u, v)
      const r = Math.hypot(x, z)
      if (r < 1e-5) continue
      // the drape: folds hanging from the shoulders, deepest at the hem
      let k = 1 + (coatFold(u, v) - 0.5) * 0.11
      // shoulder blades push the back out a little; the small of the back curves in
      const back = Math.max(0, -Math.cos(a))
      k += back * (0.05 * Math.exp(-((v - 0.82) ** 2) * 220) - 0.035 * Math.exp(-((v - 0.62) ** 2) * 150))
      // the back vent: the two flaps part slightly below the hips
      const ventSide = Math.sin(a)                                   // + = his left
      const vent = THREE.MathUtils.smoothstep(0.42 - v, 0, 0.2) * Math.exp(-((u - 0.5) ** 2) * 900)
      x *= k
      z *= k
      x += Math.sign(ventSide) * vent * 0.012
      z += vent * 0.006
      // wind-blown, uneven hem
      if (y < 0.2) {
        const h = (0.2 - y) / 0.075
        y += Math.sin(a * 5) * 0.008 * h
        x *= 1 + Math.sin(a * 3 + 1) * 0.05 * h
        x += 0.012 * h
      }
      cp.setXYZ(i, x, y, z)
    }
    coatGeo.computeVertexNormals()
    const coatMesh = add(new THREE.Mesh(coatGeo, coat), 0, 0)
    coatMesh.scale.z = 0.66
    this.coatGeo = coatGeo
    this.coatRest = new Float32Array(cp.array as Float32Array)

    // Shoulders: padded, squared caps that the sleeves hang from
    // (sunk into the coat so only a soft rise shows, not a ball)
    for (const side of [-1, 1]) {
      const shoulder = add(new THREE.Mesh(new THREE.SphereGeometry(0.046, 28, 20), coatPlain), side * 0.1, 0.682)
      shoulder.scale.set(1.0, 0.5, 0.75)
    }

    // Arms: shoulder and elbow pivots so they swing against the legs.
    // arms[0] = right (holds the lantern), arms[1] = left.
    // Sleeves are folded cloth tubes, wider at the cuff, not capsules.
    const capsule = (len: number) => {
      const upperArm = len > 0.125
      const m = new THREE.Mesh(sleeveGeo(len + 0.05, upperArm ? 0.036 : 0.033, upperArm ? 0.034 : 0.038, upperArm ? 1 : 0.6), coatPlain)
      return m
    }
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group()
      shoulder.position.set(side * 0.123, 0.67, 0)
      shoulder.rotation.z = -side * 0.045     // arms hang close to the coat
      const upper = capsule(0.13)
      upper.position.set(side * (side < 0 ? 0.011 : 0.007), -0.07, side < 0 ? 0.01 : 0)
      upper.rotation.z = side < 0 ? -0.14 : 0.1
      shoulder.add(upper)
      const elbow = new THREE.Group()
      elbow.position.set(side * (side < 0 ? 0.025 : 0.015), -0.15, side < 0 ? 0.02 : 0)
      shoulder.add(elbow)
      const lower = capsule(0.12)
      lower.position.set(side * (side < 0 ? 0.008 : 0.002), -0.065, 0.012)
      lower.rotation.x = side < 0 ? -0.3 : -0.15
      elbow.add(lower)
      // gloved hand: a flattened, slightly cupped mitt rather than a ball
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.027, 20, 14), glove)
      hand.scale.set(0.8, 1.25, 0.6)
      hand.position.set(side * (side < 0 ? 0.013 : 0.005), -0.13, side < 0 ? 0.03 : 0.02)
      elbow.add(hand)
      this.inner.add(shoulder)
      this.arms.push({ shoulder, elbow, hand })
    }

    // Neck, wool scarf and a turned-up collar that opens at the front.
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.033, 0.05, 14), skin), 0, 0.79)
    // The dark red knitted scarf: wound twice round the neck, lumpy, not a ring.
    const scarfMat = new THREE.MeshStandardMaterial({ color: 0xffffff, ...knitScarf(), roughness: 1 })
    for (const [r, tube, y, tilt] of [[0.041, 0.015, 0.772, 0.14], [0.043, 0.013, 0.787, -0.08]]) {
      const tg = new THREE.TorusGeometry(r, tube, 16, 48)
      const tp = tg.getAttribute('position') as THREE.BufferAttribute
      for (let i = 0; i < tp.count; i++) {
        const a = Math.atan2(tp.getY(i), tp.getX(i))
        const k = 1 + 0.12 * Math.sin(a * 3 + r * 90) + 0.06 * Math.sin(a * 7)
        tp.setXYZ(i, tp.getX(i) * k, tp.getY(i) * k, tp.getZ(i) * (1 + 0.2 * Math.sin(a * 2)))
      }
      tg.computeVertexNormals()
      const s = add(new THREE.Mesh(tg, scarfMat), 0, y, 0.004)
      s.rotation.x = Math.PI / 2 + tilt
      s.scale.set(1.06, 0.92, 1)
    }
    // A turned-up wool collar standing behind the neck, open at the front.
    // the inside of the collar is in shadow: a darker lining
    const collarMat = new THREE.MeshStandardMaterial({
      color: 0x8a8a90, map: sleeveWool.map, normalMap: sleeveWool.normalMap, roughness: 1, side: THREE.DoubleSide,
    })
    // tall enough at the back to hide the neck up to the hairline
    const cg = new THREE.CylinderGeometry(0.06, 0.058, 0.07, 40, 4, true, Math.PI * 0.3, Math.PI * 1.4)
    const cgp = cg.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < cgp.count; i++) {
      // the top edge rolls outward, like a heavy collar
      const t = cgp.getY(i) / 0.07 + 0.5
      const k = 1 + 0.18 * t * t
      cgp.setX(i, cgp.getX(i) * k)
      cgp.setZ(i, cgp.getZ(i) * k)
    }
    cg.computeVertexNormals()
    const collar = add(new THREE.Mesh(cg, collarMat), 0, 0.8, -0.008)
    collar.rotation.x = -0.18

    const head = add(this.buildHead(), 0, 0.845)
    head.scale.set(0.86, 1.08, 0.95)
    // Hair at the back of the head, below the hat: short dark hair ending in a
    // ragged line at the nape (strands made by displacing the shell's lower edge).
    {
      // phi π..2π is the back half (three.js spheres put phi = 1.5π at -z)
      const hg = new THREE.SphereGeometry(0.058, 48, 24, Math.PI * 0.92, Math.PI * 1.16, Math.PI * 0.12, Math.PI * 0.6)
      const hp = hg.getAttribute('position') as THREE.BufferAttribute
      for (let i = 0; i < hp.count; i++) {
        const x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i)
        const a = Math.atan2(x, z)
        // ragged nape: tufts of different length
        const tuft = y < -0.01 ? (Math.sin(a * 23) * 0.5 + Math.sin(a * 41 + 1) * 0.5) * 0.006 : 0
        // a little volume, combed slightly down
        const k = 1 + 0.02 * Math.sin(a * 13 + y * 90)
        hp.setXYZ(i, x * k, y + tuft, z * k)
      }
      hg.computeVertexNormals()
      const hairC = document.createElement('canvas')
      hairC.width = 256; hairC.height = 128
      const hc = hairC.getContext('2d')!
      hc.fillStyle = '#100c0b'
      hc.fillRect(0, 0, 256, 128)
      for (let i = 0; i < 900; i++) {
        const x = Math.random() * 256, y = Math.random() * 128
        hc.strokeStyle = `rgba(${40 + Math.random() * 30},${32 + Math.random() * 20},${28 + Math.random() * 16},${0.35 + Math.random() * 0.4})`
        hc.lineWidth = 0.6 + Math.random() * 0.8
        hc.beginPath(); hc.moveTo(x, y); hc.lineTo(x + (Math.random() - 0.5) * 4, y + 10 + Math.random() * 16); hc.stroke()
      }
      const hairTex = new THREE.CanvasTexture(hairC)
      hairTex.colorSpace = THREE.SRGBColorSpace
      const hairMat = new THREE.MeshStandardMaterial({ map: hairTex, color: 0x3a3634, roughness: 0.9, metalness: 0, side: THREE.DoubleSide })
      const hair = add(new THREE.Mesh(hg, hairMat), 0, 0.848, -0.002)
      hair.scale.set(0.88, 1.1, 0.98)
    }
    // Ears
    for (const side of [-1, 1]) {
      const ear = add(new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), skin), side * 0.047, 0.85, -0.004)
      ear.scale.set(0.45, 1.25, 0.85)
      ear.rotation.y = side * 0.35
    }

    // Fedora: brim sits on the brow, turned down at the front and back and
    // curled up at the sides; tapered crown with a centre pinch.
    const brimGeo = new THREE.LatheGeometry(
      [[0.05, 0.004], [0.08, 0.002], [0.1, 0], [0.11, -0.002], [0.112, 0.0], [0.108, 0.004], [0.05, 0.006]]
        .map(([r, y]) => new THREE.Vector2(r, y)), 40)
    const bp = brimGeo.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < bp.count; i++) {
      const x = bp.getX(i), z = bp.getZ(i)
      const r = Math.hypot(x, z)
      const k = THREE.MathUtils.smoothstep(r, 0.06, 0.112)
      const a = Math.atan2(x, z)
      bp.setY(i, bp.getY(i) + k * (Math.sin(a) ** 2 * 0.012 - Math.cos(a) ** 2 * 0.01))
    }
    brimGeo.computeVertexNormals()
    const brim = add(new THREE.Mesh(brimGeo, hat), 0, 0.882)
    brim.rotation.x = 0.1
    const crownGeo = new THREE.LatheGeometry(
      [[0.0, 0.0], [0.062, 0.0], [0.061, 0.03], [0.057, 0.058], [0.046, 0.07], [0.02, 0.066], [0.0, 0.062]]
        .map(([r, y]) => new THREE.Vector2(r, y)), 32)
    const crp = crownGeo.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < crp.count; i++) {
      // front pinch: squeeze the sides near the top
      const x = crp.getX(i), y = crp.getY(i), z = crp.getZ(i)
      const k = THREE.MathUtils.smoothstep(y, 0.03, 0.068) * Math.max(0, z / 0.062)
      crp.setX(i, x * (1 - 0.18 * k))
    }
    crownGeo.computeVertexNormals()
    const crown = add(new THREE.Mesh(crownGeo, hat), 0, 0.885)
    crown.rotation.x = 0.1
    crown.scale.z = 1.12
    const band = add(new THREE.Mesh(new THREE.CylinderGeometry(0.0625, 0.0625, 0.013, 32, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x2c1a14, roughness: 0.7, side: THREE.DoubleSide })), 0, 0.893, 0.001)
    band.rotation.x = 0.1
    band.scale.z = 1.12

    // Lantern hanging from the right hand
    const lantern = new THREE.Group()
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.004, 6, 16, Math.PI), metal)
    handle.position.y = 0.06
    lantern.add(handle)
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.03, 8), metal)
    cap.position.y = 0.045
    lantern.add(cap)
    this.lanternGlass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 0.06, 10),
      new THREE.MeshBasicMaterial({ color: 0xffc56a }),
    )
    lantern.add(this.lanternGlass)
    const baseRing = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.036, 0.012, 10), metal)
    baseRing.position.y = -0.036
    lantern.add(baseRing)
    // Hangs from the right hand on a pivot so it swings like a pendulum.
    const lanternPivot = new THREE.Group()
    lanternPivot.position.copy(this.arms[0].hand.position)
    this.arms[0].elbow.add(lanternPivot)
    lantern.position.set(-0.005, -0.09, 0.01)
    lanternPivot.add(lantern)
    this.lantern = lanternPivot
    this.lanternLight.position.set(0, 0, 0.06)
    lantern.add(this.lanternLight)

    this.root.add(this.inner)
  }

  /**
   * Arjun's head: a sphere sculpted into a face (brow ridge, eye sockets,
   * nose, cheekbones, lips, chin, narrower jaw) and painted with a matching
   * skin texture (eyes, brows, trimmed beard, hair). Both use the same
   * (azimuth, elevation) feature map so the paint sits on the sculpted form.
   * The face looks toward +z.
   */
  private makeHeadParts(): HeadParts {
    if (baked) {
      const toCanvas = (img: HTMLImageElement) => { const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d')!.drawImage(img, 0, 0); return c }
      return { geo: ArjunModel.sculptHead(), canvas: toCanvas(baked.skin), hairCanvas: toCanvas(baked.hair) }
    }
    return ArjunModel.paintHead()
  }

  /** The sculpted head only (fast). */
  static sculptHead(): THREE.SphereGeometry { return ArjunModel.paintHead(true).geo }

  /** The sculpted head and, unless geoOnly, its painted skin and hair (slow: per-pixel). */
  static paintHead(geoOnly = false): HeadParts {
    const R = 0.055
    const g = (a: number, e: number, a0: number, e0: number, sa: number, se: number) =>
      Math.exp(-(((a - a0) / sa) ** 2) - ((e - e0) / se) ** 2)
    const pair = (a: number, e: number, a0: number, e0: number, sa: number, se: number) =>
      g(a, e, a0, e0, sa, se) + g(a, e, -a0, e0, sa, se)
    // GLSL-style smoothstep(edge0, edge1, x); the edges may be reversed.
    const sm = (e0: number, e1: number, x: number) => {
      const k = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1)
      return k * k * (3 - 2 * k)
    }

    // Relief in units of the radius (positive = outward).
    // Features sit above the sphere's equator so the chin clears the collar
    // and the forehead under the brim is a normal height.
    const FACE_UP = 0.16
    const relief = (a: number, eRaw: number): number => {
      const e = eRaw - FACE_UP
      const front = sm(0.0, 0.5, Math.cos(a))
      let d = 0
      d += g(a, e, 0, -0.06, 0.08, 0.2) * 0.09        // nose bridge
      d += g(a, e, 0, -0.25, 0.1, 0.08) * 0.13        // nose tip
      d += pair(a, e, 0.11, -0.27, 0.06, 0.05) * 0.04 // nostril wings
      d += pair(a, e, 0.32, 0.2, 0.22, 0.06) * 0.05   // brow ridge
      d -= pair(a, e, 0.33, 0.06, 0.13, 0.08) * 0.07  // eye sockets
      d += pair(a, e, 0.62, -0.12, 0.2, 0.12) * 0.035 // cheekbones
      d -= pair(a, e, 0.5, -0.38, 0.16, 0.14) * 0.03  // hollow cheeks
      d += g(a, e, 0, -0.46, 0.22, 0.06) * 0.04       // lips
      d -= g(a, e, 0, -0.56, 0.18, 0.04) * 0.02       // groove under the lip
      d += g(a, e, 0, -0.75, 0.26, 0.12) * 0.07       // chin
      return d * front
    }

    const geo = new THREE.SphereGeometry(R, 96, 64)
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      const a = Math.atan2(v.x, v.z)
      const e = Math.asin(THREE.MathUtils.clamp(v.y / R, -1, 1))
      v.multiplyScalar(1 + relief(a, e))
      // Jaw narrows toward the chin; the back of the skull is fuller.
      v.x *= 1 - 0.16 * sm(0.2, 1.0, FACE_UP - e)
      if (v.z < 0) v.z *= 1.06
      pos.setXYZ(i, v.x, v.y, v.z)
    }
    geo.computeVertexNormals()
    if (geoOnly) return { geo, canvas: null as unknown as HTMLCanvasElement, hairCanvas: null as unknown as HTMLCanvasElement }

    // Skin texture, equirectangular in the sphere's UVs:
    // u = (azimuth + π/2) / 2π, v = elevation (top of the canvas = crown).
    const W = 512, H = 256
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const c2d = canvas.getContext('2d')!
    const img = c2d.createImageData(W, H)
    const hash = (x: number, y: number) => {
      const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
      return s - Math.floor(s)
    }
    const mix = (c: number[], t: number[], k: number) => c.map((x, i) => x + (t[i] - x) * k)
    // Short dark hair: crown, back and sides, with a slightly ragged hairline
    // and the ears left clear.
    const hairMask = (a: number, eRaw: number, n: number) => {
      const aa = Math.abs(a)
      const crown = sm(0.6, 0.66, eRaw - 0.04 * Math.cos(a * 4) + (n - 0.5) * 0.04)
      // back hair runs down to the nape (it disappears into the collar)
      const back = sm(1.05, 1.3, aa + (n - 0.5) * 0.08) * sm(-0.75, -0.55, eRaw)
      const ear = Math.exp(-(((aa - Math.PI / 2) / 0.14) ** 2) - ((eRaw - 0.02) / 0.15) ** 2)
      const temple = sm(0.95, 1.12, aa + (n - 0.5) * 0.06) * sm(0.05, 0.2, eRaw)
      return Math.max(crown, back * (1 - ear), temple * (1 - ear))
    }
    const hairImg = c2d.createImageData(W, H)
    hairImg.data.fill(255)
    for (let py = 0; py < H; py++) {
      const eRaw = (0.5 - (py + 0.5) / H) * Math.PI
      const e = eRaw - FACE_UP
      for (let px = 0; px < W; px++) {
        let a = ((px + 0.5) / W) * Math.PI * 2 - Math.PI / 2
        if (a > Math.PI) a -= Math.PI * 2
        const aa = Math.abs(a)
        const n = hash(px, py)
        // Warm brown skin; ruddier over the nose and cheeks, paler forehead.
        let col = [146, 96, 70]
        col = mix(col, [160, 92, 70], pair(a, e, 0.5, -0.15, 0.25, 0.15) * 0.5 + g(a, e, 0, -0.2, 0.1, 0.12) * 0.4)
        col = mix(col, [158, 110, 84], g(a, e, 0, 0.4, 0.5, 0.15) * 0.4)
        col = col.map(x => x * (0.96 + n * 0.08))

        // Shading that the low-poly relief can't carry on its own.
        col = col.map(x => x * (1 - pair(a, e, 0.33, 0.04, 0.17, 0.11) * 0.35)) // eye sockets
        col = col.map(x => x * (1 - pair(a, e, 0.08, -0.15, 0.04, 0.12) * 0.25)) // sides of the nose
        col = col.map(x => x * (1 - g(a, e, 0, -0.33, 0.08, 0.03) * 0.3))        // under the nose

        // Eyes: almond-shaped, dark iris, small catch-light, heavy upper lid.
        for (const s of [-1, 1]) {
          const ex = (a - s * 0.33) / 0.12
          const ey = (e - 0.055) / 0.042
          const lid = ex * ex + ey * ey * (ey > 0 ? 1 : 1.4)
          if (lid < 1) {
            const ir = Math.hypot((a - s * 0.315) / 0.05, (e - 0.055) / 0.05)
            let eye = mix([182, 165, 150], [120, 100, 90], sm(0.5, 1, Math.abs(ex)))
            if (ir < 1) eye = mix([58, 36, 24], [16, 10, 8], sm(0.4, 0.75, 1 - ir))
            if (Math.hypot(a - s * 0.3, e - 0.07) < 0.012) eye = [235, 225, 215]
            col = mix(col, eye, sm(0, 0.25, 1 - lid))
          }
          // Upper lid crease and lash line.
          const lash = Math.abs(lid - 1) < 0.25 && ey > -0.2 ? 1 - Math.abs(lid - 1) / 0.25 : 0
          col = mix(col, [30, 20, 16], lash * 0.85)
          // Eyebrow: thick, slightly arched.
          const bx = (a - s * 0.33) / 0.2
          const by = e - (0.165 + 0.035 * (1 - bx * bx) - 0.02 * bx * s)
          if (Math.abs(bx) < 1) col = mix(col, [32, 22, 18], sm(0.032, 0.012, Math.abs(by)) * (0.75 + n * 0.25) * sm(1, 0.7, Math.abs(bx)))
        }
        // Nostrils
        col = mix(col, [40, 22, 18], pair(a, e, 0.07, -0.285, 0.03, 0.02) * 0.9)
        // Lips and the dark line between them.
        if (aa < 0.2) {
          const lipT = sm(0.2, 0.12, aa)
          col = mix(col, [118, 66, 58], g(a, e, 0, -0.47, 0.17, 0.04) * lipT * 0.8)
          col = mix(col, [40, 22, 20], sm(0.012, 0.0, Math.abs(e + 0.465)) * lipT)
        }
        // Trimmed beard and moustache with stubble speckle.
        const jaw = sm(-0.26, -0.38, e) * sm(1.45, 1.05, aa)
        // Full moustache, drooping slightly at the corners of the mouth.
        const moustache = sm(0.015, 0, Math.abs(e + 0.39 + aa * aa * 0.6) - 0.032) * sm(0.32, 0.22, aa)
        const sideburn = sm(0.95, 1.1, aa) * sm(1.35, 1.2, aa) * sm(0.3, 0.0, e)
        const mouthGap = g(a, e, 0, -0.47, 0.17, 0.035)
        // Moustache is solid; the jaw only carries a few days of stubble, so
        // the lower face keeps its skin tone instead of reading as a mask.
        col = mix(col, [36, 27, 23], Math.max(moustache, sideburn) * (0.6 + n * 0.35))
        col = mix(col, [70, 50, 42], jaw * (1 - mouthGap) * (0.18 + n * 0.3))
        // Shade cast by the hat brim over the brow and eyes.
        col = col.map(x => x * (1 - 0.32 * sm(0.0, 0.3, e) * sm(1.6, 0.6, aa)))
        // Hair: short, dark, swept back; hairline on the forehead.
        const hair = hairMask(a, eRaw, n)
        col = mix(col, [22, 17, 15], hair)
        hairImg.data[(py * W + px) * 4 + 3] = hair > 0.5 ? 255 : 0

        const k = (py * W + px) * 4
        img.data[k] = col[0]
        img.data[k + 1] = col[1]
        img.data[k + 2] = col[2]
        img.data[k + 3] = 255
      }
    }
    c2d.putImageData(img, 0, 0)

    // Hair as a separate, slightly larger matte layer with uneven strand
    // brightness, so it doesn't shine like skin.
    const hairCanvas = document.createElement('canvas')
    hairCanvas.width = W
    hairCanvas.height = H
    const hctx = hairCanvas.getContext('2d')!
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      const k = (py * W + px) * 4
      const s = hash(Math.floor(px / 2), py * 0.35 | 0) * 0.6 + hash(px, py) * 0.4
      hairImg.data[k] = 18 + s * 22
      hairImg.data[k + 1] = 14 + s * 16
      hairImg.data[k + 2] = 12 + s * 12
    }
    hctx.putImageData(hairImg, 0, 0)
    return { geo, canvas, hairCanvas }
  }

  /**
   * The head and hair meshes. The painted skin and hair canvases and the
   * sculpted sphere are made once per page (a few hundred ms of per-pixel
   * work) and shared; each model gets its own geometry copy, textures and
   * materials, so disposing one scene never touches another's.
   */
  private buildHead(): THREE.Mesh {
    headParts ??= this.makeHeadParts()
    const { canvas, hairCanvas } = headParts
    const geo = headParts.geo.clone()
    const map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace
    map.anisotropy = 4
    const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.62, metalness: 0 })
    const headMesh = new THREE.Mesh(geo, mat)
    const hairTex = new THREE.CanvasTexture(hairCanvas)
    hairTex.colorSpace = THREE.SRGBColorSpace
    const hairMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      map: hairTex, alphaTest: 0.5, roughness: 1, metalness: 0,
    }))
    hairMesh.scale.setScalar(1.035)
    headMesh.add(hairMesh)
    return headMesh
  }

  /**
   * Walk cycle from the gait phase (π per step) and speed: hips swing, knees
   * bend through the swing and flex on heel strike, the boot rolls heel to
   * toe, the body drops by the leg geometry at full stride and shifts over
   * the standing foot, the free arm swings against the legs, the long coat
   * moves with the legs and the lantern swings behind the hand.
   */
  updateGait(phase: number, speed: number, delta: number): void {
    const s = speed
    const pR = phase, pL = phase + Math.PI
    const legAngles: number[] = []
    this.legs.forEach((leg, i) => {
      const p = i === 0 ? pR : pL
      const sin = Math.sin(p), cos = Math.cos(p)
      const hip = -0.34 * s * sin
      const knee = s * (0.62 * Math.pow(Math.max(0, cos), 1.6) + 0.14 * Math.max(0, -cos) * Math.max(0, sin))
      const toe = s * (0.32 * Math.pow(Math.max(0, -sin), 3) * (cos > -0.2 ? 1 : 0.5) - 0.18 * Math.pow(Math.max(0, sin), 4))
      leg.hip.rotation.x = hip
      leg.knee.rotation.x = knee
      leg.ankle.rotation.x = -(hip + knee) + toe
      legAngles.push(hip)
    })
    const inner = this.inner
    // The standing leg is the straighter one: drop the body so it reaches the ground.
    const stance = Math.min(Math.cos(legAngles[0]), Math.cos(legAngles[1]))
    inner.position.y -= 0.45 * (1 - stance) * 0.9
    inner.position.x = s * 0.006 * Math.cos(pR)
    inner.rotation.x = s * 0.045                       // slight forward lean
    inner.rotation.z += s * 0.012 * Math.cos(pR)
    inner.rotation.y += s * 0.035 * Math.sin(pR)       // hips/shoulders counter-rotate

    // Arms: left swings opposite the left leg; the lantern arm moves less.
    const [right, left] = this.arms
    if (left && right) {
      left.shoulder.rotation.x = 0.3 * s * Math.sin(pL)
      left.elbow.rotation.x = -s * (0.08 + 0.26 * Math.max(0, -Math.sin(pL)))
      right.shoulder.rotation.x = 0.08 * s * Math.sin(pR)
      right.elbow.rotation.x = -0.05 * s
    }
    // Lantern: a damped pendulum driven by the hand's forward acceleration.
    if (this.lantern && right) {
      const handZ = -right.shoulder.rotation.x * 0.28 - inner.rotation.x * 0.4
      const dt = Math.max(1e-3, delta)
      const sw = this.lanternSwing
      const handV = (handZ - sw.lastZ) / dt
      sw.lastZ = handZ
      const w0 = 9, zeta = 0.12
      const accel = -w0 * w0 * sw.a - 2 * zeta * w0 * sw.v + handV * 6
      sw.v += accel * dt
      sw.a += sw.v * dt
      sw.a = THREE.MathUtils.clamp(sw.a, -0.5, 0.5)
      this.lantern.rotation.x = sw.a
    }
    // Coat: the hem is pushed forward by whichever leg is in front.
    if (this.coatGeo && this.coatRest) {
      const pos = this.coatGeo.getAttribute('position') as THREE.BufferAttribute
      const arr = pos.array as Float32Array
      const rest = this.coatRest
      const fR = s * Math.sin(pR), fL = s * Math.sin(pL)
      if (s > 0.001 || this.coatDeformed) {
        // only the skirt below the hips moves; its weights are precomputed
        if (!this.hemIdx) {
          const idx: number[] = [], wts: number[] = [], ks: number[] = []
          for (let i = 0; i < pos.count; i++) {
            const y = rest[i * 3 + 1]
            if (y >= 0.45) continue
            idx.push(i)
            wts.push(THREE.MathUtils.smoothstep(0.45 - y, 0, 0.3))
            ks.push(THREE.MathUtils.clamp(0.5 + rest[i * 3] / 0.2, 0, 1))
          }
          this.hemIdx = Int32Array.from(idx); this.hemW = Float32Array.from(wts); this.hemK = Float32Array.from(ks)
        }
        const idx = this.hemIdx, hw = this.hemW!, hk = this.hemK!
        for (let j = 0; j < idx.length; j++) {
          const i = idx[j], w = hw[j], k = hk[j]
          const fwd = k * fL + (1 - k) * fR
          arr[i * 3 + 1] = rest[i * 3 + 1] + Math.abs(fwd) * 0.012 * w
          arr[i * 3 + 2] = rest[i * 3 + 2] + fwd * 0.11 * w
        }
        pos.needsUpdate = true
        // the swing is small: the folds' normals stay valid (no per-frame recompute)
        this.coatDeformed = s > 0.001
      }
    }
  }

  private coatDeformed = false
  private hemIdx: Int32Array | null = null
  private hemW: Float32Array | null = null
  private hemK: Float32Array | null = null

  /** Fades his colours toward black (0 = normal, 1 = black, hidden). */
  setDarkness(k: number): void {
    this.inner.traverse(obj => {
      const m = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
      if (!m || !(m as THREE.MeshStandardMaterial).isMeshStandardMaterial) return
      if (!m.userData.base) m.userData.base = m.color.clone()
      m.color.copy(m.userData.base as THREE.Color).multiplyScalar(1 - k * 0.92)
    })
    this.root.visible = k < 0.999
  }
}
