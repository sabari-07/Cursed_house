import * as THREE from 'three'
import { ArjunModel } from '../three/ArjunModel'
import { gameAudio, releaseAudio } from '../game/audioUnlock'
import { audioManager } from '../game/AudioManager'

// ─── LANDING SCENE: animated matte painting ─────────────────────────────────
// The reference painting is the backdrop. Everything that moves is a real,
// separately rendered layer on top of it:
//   • storm clouds (shader) drifting across the sky and the moon
//   • ground fog, rain, steady firelight; one tree lantern and two pumpkins blink
//   • 3D bats with flapping wings crossing and circling the moon
//   • lightning that lights the whole scene, with a visible bolt + thunder
//   • one upstairs window that blinks; a person's shadow on alternate blinks
//   • Arjun (3D, lantern in hand) who turns around to face the bungalow
// All coordinates below are measured in pixels of the 1072×715 painting.
// ─────────────────────────────────────────────────────────────────────────────

/** Shared between the landing page and the cinematic that follows it. */
export const soundState = { muted: false }

const PAINTING = '/landing/bungalow.webp'
/**
 * The same painting already prepared (preparePainting, baked by
 * scripts/prepare-landing.cjs): loading it skips seconds of pixel work that
 * froze phones during the title card. The raw painting is the fallback.
 */
const PREPARED = '/landing/bungalow-prepared.webp'
// Wolf howls: real field recordings, U.S. National Park Service (public domain), trimmed.
const WOLF_CLIPS = ['denali', 'pack-a', 'yellowstone', 'pack-b'].map(k => `/audio/wolf-${k}.mp3`)

// the owner's second, sharper painting of the bungalow (1536 x 1024); every position below is
// measured on it in painting px (50 px grid). S scales the "look" numbers (cloud and fog sizes,
// bat sizes and speeds, bolt areas) that were tuned on the first painting, 1072 px wide.
const IMG_W = 1536
const IMG_H = 1024
const S = IMG_W / 1072
/** The painting is not upscaled before upload (it is sharp at its own size); the bicubic sampler uses this. */
const TEX_UP = 1
/** Area occupied by the painted figure; it is painted out and replaced by Arjun. */
const FIGURE_HOLE = { x0: 680, y0: 600, x1: 782, y1: 777 }
/** The area filled where the painted figure and her lantern's glow were (painting px). */
const FIGURE_FILL = { x0: 634, y0: 596, x1: 792, y1: 784, feather: 4 }
/** Kept inside that area: the small pumpkin on the path just above where she stood. */
const FIGURE_KEEP = { x0: 676, y0: 590, x1: 714, y1: 624 }
/** Bats painted into the artwork (measured). They are removed so only the animated bats fly. */
const PAINTED_BATS: Array<[number, number, number, number]> = [
  [467, 159, 539, 181], [555, 149, 596, 164], [642, 100, 675, 110], [708, 126, 774, 143],
  [841, 65, 877, 76], [883, 120, 922, 133], [816, 179, 852, 190], [436, 121, 460, 134],
  [405, 257, 430, 266], [405, 298, 460, 310], [739, 221, 760, 228], [824, 143, 831, 148],
  [858, 314, 866, 319],
]
/** Arjun's feet position and height in painting pixels. */
const ARJUN_FEET = { x: 738, y: 765 }
const ARJUN_HEIGHT = 152
/** The upstairs window that blinks (big centre window, measured). */
const BLINK_WINDOW = { x0: 673, y0: 250, x1: 702, y1: 287 }
const MOON = { x: 603, y: 160, r: 136 }
/** Lantern hanging in the left tree (centre + radii of its glow, painting px, measured). */
const TREE_LANTERN = { x: 95, y: 227, rx: 36, ry: 38 }
/**
 * The two jack-o'-lanterns that blink, chosen by the owner: the first (outermost) big pumpkin on
 * each side. Left: body x 62-330, y 722-905. Right: body x 1242-1480, y 695-847.
 * Centre and radii of the body, painting px, measured. The left radius stops short of the
 * pumpkin touching it on the right (from x 320).
 */
const PUMPKIN_A = { x: 196, y: 814, rx: 128, ry: 90 }
const PUMPKIN_B = { x: 1361, y: 771, rx: 116, ry: 74 }

/**
 * Blink cycles: [seconds into the cycle, light level]. Level 0 is dark, 1 is
 * normal, above 1 is a short flare as the flame catches again. A cycle
 * starts again after a short random pause, so these lights never stop blinking.
 */
const LANTERN_BLINK: Array<[number, number]> = [
  [0, 0.15], [0.05, 0.9], [0.09, 0], [0.35, 0.6], [0.4, 0], [0.52, 1.25], [0.65, 1],
]
const PUMPKIN_BLINK: Array<[number, number]> = [
  [0, 0.45], [0.08, 0], [0.42, 0.35], [0.48, 0], [0.65, 0.7], [0.72, 1.2], [0.88, 1],
]
/** Real thunder clap; the lightning flash is driven by this recording's loudness. */
const THUNDER_HIT = '/audio/thunder-hit.mp3'
const THUNDER_ENV_STEP = 0.01

// ── ENTER THE BUNGALOW ─────────────────────────────────────────────────────
/** User-supplied recording: two ghostly booms, knocks, then the door creaking open. */
const DOOR_CLIP = '/audio/door-enter.mp3'
/** Painted front door (arched), painting px, measured. */
const DOOR = { x0: 586, y0: 495, x1: 626, y1: 570, arch: 20 }
/**
 * The recording has knocks between the booms and the creak (5.4–10.25 s).
 * They are cut out when the clip is decoded, so only the booms and the
 * creak play: [0, 5.4] + [10.25, end] with a short crossfade.
 */
// Measured: the loud bursts at 0.5–1.95 s and 3.55–5.1 s are knocks (a hit
// every ~0.2 s), and soft taps sit at 6.7–9.1 s. The ghostly drone ("bhoot")
// is the quiet tonal sound between them. Only clean drone pieces (boosted,
// it is ~-32 dB) and the creak are kept: [start, end, gain].
const DOOR_KEEP: Array<[number, number, number]> = [
  [2.05, 3.52, 3.2], [5.35, 6.62, 3.2], [9.18, 10.5, 3.2], [10.5, 18.7, 1],
]
/** Timeline in seconds of the edited recording (12.0 s long). */
const ENTER = {
  boomsEnd: 3.85,     // the ghostly drone before the creak
  walkStart: 0.5,
  walkEnd: 10.0,      // Arjun reaches the door step
  zoomEnd: 9.8,       // push-in done
  creakStart: 3.82,   // the door opens by itself as he approaches; the leaf follows the creak
  creakEnd: 10.1,
  stepIn: 10.0,       // Arjun turns and steps through the doorway
  stepInEnd: 11.5,
  fadeStart: 11.15,
  end: 12.0,
}
/** Arjun's walk from his spot on the path to the door step (painting px). */
// He stops beside the door (right of it) so the opening is visible, then steps in.
// the path's centre line, measured on the painting: (738, 765) where he stands, bending left and up
// through the fog to the steps below the door (about 612, 585); he stops on the step right of the door
const WALK_PATH = [[738, 765], [728, 730], [712, 700], [690, 668], [664, 638], [642, 610], [630, 590], [638, 576]]
const STEP_IN_PATH = [[638, 576], [622, 572], [606, 568]]
/** Perspective on the path: a 1.8 m man is ARJUN_HEIGHT px at y = 559 and 0.85 door at the step. */
const heightAt = (y: number) => 0.4706 * (y - 442)       // 152 px at the start, 64 px at the door step
/** Painting focal length in px (≈72° horizontal view); puts the door ~15 m from Arjun. */
const FOCAL = 1000
/** The bungalow's column, painting px: the camera centre and the ground plane's middle. */
const HOUSE_X = 673
/** One step = 0.4 of his height (≈0.72 m); acceleration time at start/stop. */
const STEP_LEN = 0.4
const ACCEL = 1.3

interface Bat {
  root: THREE.Group
  wingL: THREE.Object3D
  wingR: THREE.Object3D
  kind: 'orbit' | 'cross' | 'swoop'
  size: number
  speed: number
  phase: number
  rx: number
  ry: number
  y: number
  dir: 1 | -1
  flap: number
}

const NOISE_GLSL = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
    return v;
  }
`

export class LandingScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(0, 1, 1, 0, -3000, 3000)
  private clock = new THREE.Clock()
  private frameId = 0
  private disposed = false
  private width = 1
  private height = 1

  // painting → screen mapping (updated every frame for the slow camera push)
  private mapScale = 1
  private mapOffset = new THREE.Vector2()

  private backdrop: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null = null
  private uniforms = {
    uTex: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uFlash: { value: 0 },
    uScreen: { value: new THREE.Vector2(1, 1) },
    uScale: { value: 1 },
    uOffset: { value: new THREE.Vector2() },
    uImg: { value: new THREE.Vector2(IMG_W, IMG_H) },
    uWin: { value: new THREE.Vector4(BLINK_WINDOW.x0, BLINK_WINDOW.y0, BLINK_WINDOW.x1, BLINK_WINDOW.y1) },
    uWinOn: { value: 1 },
    uMoon: { value: new THREE.Vector3(MOON.x, MOON.y, MOON.r) },
    uLamp: { value: new THREE.Vector4(TREE_LANTERN.x, TREE_LANTERN.y, TREE_LANTERN.rx, TREE_LANTERN.ry) },
    uLampOn: { value: 1 },
    uPumpA: { value: new THREE.Vector4(PUMPKIN_A.x, PUMPKIN_A.y, PUMPKIN_A.rx, PUMPKIN_A.ry) },
    uPumpAOn: { value: 1 },
    uPumpB: { value: new THREE.Vector4(PUMPKIN_B.x, PUMPKIN_B.y, PUMPKIN_B.rx, PUMPKIN_B.ry) },
    uPumpBOn: { value: 1 },
    uDoor: { value: new THREE.Vector4(DOOR.x0, DOOR.y0, DOOR.x1, DOOR.y1) },
    uDoorArch: { value: DOOR.arch },
    uDoorOpen: { value: 0 },
    /** Warm lights dip on each ghostly boom (0..1). */
    uDim: { value: 0 },
    /** Fade to black at the end of the entrance (0..1). */
    uFade: { value: 0 },
  }

  // Independent, never-ending blinkers (different phases so they don't sync).
  private lampBlink = { t: -1, wait: 0, next: 0.6 }
  private pumpABlink = { t: -1, wait: 0, next: 1.4 }
  private pumpBBlink = { t: -1, wait: 0, next: 2.3 }

  // Arjun
  private arjunModel = new ArjunModel()
  private arjun = this.arjunModel.root
  private arjunInner = this.arjunModel.inner
  private lanternLight = this.arjunModel.lanternLight
  private get lanternGlass(): THREE.Mesh | null { return this.arjunModel.lanternGlass }
  private lanternHalo: THREE.Sprite | null = null
  private groundGlow: THREE.Sprite | null = null
  private rimLight = new THREE.DirectionalLight(0x9fb6ff, 2.2)

  private walkHeading = 0

  // ENTER THE BUNGALOW sequence (driven by the door recording's clock)
  private doorClip: AudioBuffer | null = null
  private doorEnv: Float32Array | null = null
  /** Door-leaf progress over the creak, by DOOR_ENV_STEP, 0..1 (follows the sound's energy). */
  private doorCreak: Float32Array | null = null
  private enterStart: number | null = null      // audio-clock time (or performance s) of t = 0
  private enterUsesAudio = false
  private enterDone: (() => void) | null = null
  private enterFinished = false
  private enterFrom = { rot: 0 }

  private bats: Bat[] = []
  private rain: THREE.LineSegments | null = null
  private rainData: Float32Array | null = null
  private bolt: THREE.Mesh | null = null

  // timing state
  private flashTimer = 0
  private nextFlash = 2.5
  private flashT = -1
  private blinkTimer = 0
  private nextBlink = 4
  private blinkT = -1

  // audio
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private wolfInterval: number | null = null
  private wolfTimeout: number | null = null
  private muted = false

  constructor(canvas: HTMLCanvasElement, private onReady?: () => void) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    // phones: 1.5x is sharp on their small screens and draws ~45% fewer pixels than 2x
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.matchMedia('(pointer: coarse)').matches ? 1.5 : 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.NoToneMapping
    this.camera.position.z = 1000
  }

  async start(): Promise<void> {
    let source: HTMLImageElement | HTMLCanvasElement
    try {
      const baked = await this.loadImage(PREPARED)
      await baked.decode?.().catch(() => undefined)        // decode off the main thread before upload
      source = baked
    } catch {
      source = this.preparePainting(await this.loadImage(PAINTING))
    }
    if (this.disposed) return
    const texture = source instanceof HTMLImageElement ? new THREE.Texture(source) : new THREE.CanvasTexture(source)
    texture.needsUpdate = true
    texture.colorSpace = THREE.NoColorSpace // shader outputs the painting's colours untouched
    texture.minFilter = THREE.LinearFilter
    texture.generateMipmaps = false
    this.uniforms.uTex.value = texture

    // built in steps, the page painting between them: behind the entry screen its
    // mist and candle keep moving while the house gets ready
    const breathe = async () => {
      await new Promise<void>(r => requestAnimationFrame(() => setTimeout(r, 0)))
      // while the title card plays, the build waits (it would make the card stutter)
      while (!this.buildAllowed && !this.disposed) await new Promise<void>(r => { this.buildResume = r })
    }
    for (const step of [() => this.buildBackdrop(), () => this.buildArjun(), () => this.buildBats(), () => this.buildRain(), () => { this.buildBolt(); this.buildFadePlane() }]) {
      step()
      await breathe()
      if (this.disposed) return
    }

    this.resize()
    // Compile the shaders off the main thread (KHR_parallel_shader_compile)
    // and upload the painting before the first frame, so the intro letter
    // above keeps writing smoothly while the landing gets ready behind it.
    try { await this.renderer.compileAsync(this.scene, this.camera) } catch { /* compiled on first draw */ }
    if (this.disposed) return
    await breathe()
    this.renderer.initTexture(texture)
    await breathe()
    if (this.disposed) return
    // one frame drawn while still hidden: links the programs and uploads every texture
    // (Arjun's too), the ~2 s a phone spent on the first visible frame
    this.updateMapping(0)
    this.renderer.render(this.scene, this.camera)
    await breathe()
    if (this.disposed) return
    // the storm's echo, ready before sound starts (it was made when the landing appeared)
    this.verbNoise ??= LandingScene.impulseNoise(48000, 2.6, 2.8)
    this.started = true
    if (this.active) { this.clock.start(); this.loop() }
    this.onReady?.()
  }

  private started = false
  private active = true
  private buildAllowed = true
  private buildResume: (() => void) | null = null
  /** False holds the build between its steps (the title card is playing); true lets it go on. */
  setBuildAllowed(on: boolean): void {
    this.buildAllowed = on
    if (on) { const r = this.buildResume; this.buildResume = null; r?.() }
  }
  /**
   * Pauses or resumes the landing. It is built and warmed up behind the entry
   * screen, then paused (drawing nothing) while the title card plays, so the
   * card stays smooth and the house appears at once when the card ends.
   */
  setActive(on: boolean): void {
    if (on === this.active) return
    this.active = on
    if (!this.started || this.disposed) return
    if (on) { this.clock.start(); this.loop() } else cancelAnimationFrame(this.frameId)
  }

  /** Decaying stereo noise for the forest reverb, made once (it took ~0.3 s on a phone as sound began). */
  private verbNoise: Float32Array[] | null = null
  private static impulseNoise(rate: number, seconds: number, decay: number): Float32Array[] {
    const len = Math.floor(rate * seconds), earlyEnd = rate * 0.08
    return [0, 1].map(() => {
      const d = new Float32Array(len)
      let env = 1
      for (let i = 0; i < len; i++) {
        if ((i & 63) === 0) env = Math.pow(1 - i / len, decay)
        const early = i < earlyEnd && Math.random() < 0.004 ? 0.6 : 0
        d[i] = ((Math.random() * 2 - 1) * 0.35 + early) * env
      }
      return d
    })
  }

  // ── painting preparation ─────────────────────────────────────────────────

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
  }

  /** Removes the painted witch and the painted (static) bats from the artwork. */
  private preparePainting(img: HTMLImageElement): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(img, 0, 0)

    // The painted figure and the glow of her lantern: the whole area is filled from the fog and
    // the path round it (Arjun stands here, with his own lantern).
    this.fillRegion(ctx, FIGURE_FILL)
    // Bats: near-black blobs against the brighter sky / moon.
    for (const [x0, y0, x1, y1] of PAINTED_BATS) {
      this.inpaint(ctx, x0 - 5, y0 - 5, x1 + 5, y1 + 5, (lum, _r, _b, fog, x, y) =>
        x >= x0 && x <= x1 && y >= y0 && y <= y1 && lum < fog - 22, 2, 0.25, 0.25)
    }
    return this.sharpen(canvas)
  }

  /**
   * (First written for the 1072 px painting.) The painting is shown up to a few times larger, which looks
   * soft. Upscale it 2× with high-quality smoothing, then an unsharp mask
   * (radius 1.4 px, amount 0.7) so edges, windows and branches read crisply.
   * The shader samples by uv, so a larger texture changes nothing else.
   */
  private sharpen(src: HTMLCanvasElement): HTMLCanvasElement {
    this.deblock(src)
    const W = src.width * TEX_UP, H = src.height * TEX_UP
    const up = document.createElement('canvas'); up.width = W; up.height = H
    const u = up.getContext('2d', { willReadFrequently: true })!
    u.imageSmoothingEnabled = true; u.imageSmoothingQuality = 'high'
    u.drawImage(src, 0, 0, W, H)
    const bl = document.createElement('canvas'); bl.width = W; bl.height = H
    const b = bl.getContext('2d', { willReadFrequently: true })!
    b.filter = 'blur(1.6px)'
    b.drawImage(up, 0, 0)
    const o = u.getImageData(0, 0, W, H), s = b.getImageData(0, 0, W, H).data, d = o.data
    const k = 0.45                       // gentler: strong sharpening outlines the compression blocks
    for (let i = 0; i < d.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const v = d[i + c] + k * (d[i + c] - s[i + c])
        d[i + c] = v < 0 ? 0 : v > 255 ? 255 : v
      }
    }
    u.putImageData(o, 0, 0)
    return up
  }

  /**
   * Smooths the JPEG blocks out of the painting (which is shown enlarged up to
   * ~3.6x during ENTER): a 3x3 bilateral filter, so flat areas are averaged
   * and real edges (window frames, branches) are kept. In place.
   */
  private deblock(c: HTMLCanvasElement): void {
    const g = c.getContext('2d', { willReadFrequently: true })!
    const W = c.width, H = c.height, img = g.getImageData(0, 0, W, H), d = img.data, src = new Uint8ClampedArray(d)
    const SIGMA = 2 * 14 * 14                      // colour difference that still counts as "the same surface"
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = (y * W + x) * 4
      let r = 0, gg = 0, b = 0, ws = 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const j = ((y + dy) * W + x + dx) * 4
        const dr = src[j] - src[i], dg = src[j + 1] - src[i + 1], db = src[j + 2] - src[i + 2]
        const w = Math.exp(-(dr * dr + dg * dg + db * db) / SIGMA) * (dx === 0 && dy === 0 ? 1 : dx === 0 || dy === 0 ? 0.6 : 0.4)
        r += src[j] * w; gg += src[j + 1] * w; b += src[j + 2] * w; ws += w
      }
      d[i] = r / ws; d[i + 1] = gg / ws; d[i + 2] = b / ws
    }
    g.putImageData(img, 0, 0)
  }
  /**
   * Removes the painted figure and the glow of her lantern. Only those pixels are replaced: the
   * figure (darker than the fog round her) and the lantern-lit fog (warmer than it). The small
   * pumpkin beside her is kept. The hole is filled by solving for the smoothest surface that meets
   * the painting all round it (Laplace, solved coarse to fine, so it converges over a large hole and
   * keeps the colours round it), then given a soft fog grain and feathered into the painting.
   */
  private fillRegion(ctx: CanvasRenderingContext2D, r: { x0: number; y0: number; x1: number; y1: number; feather: number }): void {
    const m = 40
    const X0 = Math.max(0, r.x0 - m), Y0 = Math.max(0, r.y0 - m)
    const X1 = Math.min(ctx.canvas.width - 1, r.x1 + m), Y1 = Math.min(ctx.canvas.height - 1, r.y1 + m)
    const w = X1 - X0 + 1, h = Y1 - Y0 + 1, n = w * h
    const img = ctx.getImageData(X0, Y0, w, h), d = img.data
    const lum = (i: number) => 0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2]
    // the fog's brightness on each row, from the clean columns either side of the area
    const fogRow = new Float32Array(h)
    for (let y = 0; y < h; y++) {
      const v: number[] = []
      for (let x = 0; x < w; x++) { const gx = X0 + x; if (gx < r.x0 - 4 || gx > r.x1 + 4) v.push(lum(y * w + x)) }
      v.sort((p, q) => p - q); fogRow[y] = v.length ? v[v.length >> 1] : 120
    }
    let mask = new Uint8Array(n)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const gx = X0 + x, gy = Y0 + y
      if (gx < r.x0 || gx > r.x1 || gy < r.y0 || gy > r.y1) continue
      const k = FIGURE_KEEP
      if (gx >= k.x0 && gx <= k.x1 && gy >= k.y0 && gy <= k.y1) continue          // the small pumpkin on the path
      mask[y * w + x] = 1                // the whole area: her figure and every bit of her lantern's haze
    }
    // grow the mask 3 px (her soft edges and the lantern's fringe)
    for (let k = 0; k < 3; k++) {
      const nx = new Uint8Array(mask)
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (mask[i - 1] || mask[i + 1] || mask[i - w] || mask[i + w]) nx[i] = 1 }
      mask = nx
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) mask[y * w + x] = 0
    // Laplace fill, coarse to fine
    // The path's own texture is copied in from the clean wet path to the left, mirrored back and forth
    // (the ripples there run sideways, so a sideways mirror keeps them continuous). The Laplace solve
    // is done on the difference between the painting and that copy, so the copy meets the painting
    // all round the area without a seam (Poisson blending).
    const lx = r.x0 - X0, P = 44
    const srcX = (x: number) => {
      if (x < lx) return x
      const u = (x - lx) % (2 * P)
      return u < P ? lx - 1 - u : lx - 2 * P + u
    }
    const S = new Float32Array(n * 3)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      // below y 700 the strip to the left is a bank of dry plants, not path: there the copied path
      // above is mirrored downwards instead (rows y 616-700 reflected), so the ripples carry on
      const gy = Y0 + y, i = y * w + x
      if (gy > 700) {
        const k = (Math.max(0, 2 * 700 - gy - Y0)) * w + x
        for (let c = 0; c < 3; c++) S[i * 3 + c] = S[k * 3 + c]
        continue
      }
      const j = y * w + Math.max(0, srcX(x))
      for (let c = 0; c < 3; c++) S[i * 3 + c] = d[j * 4 + c]
    }
    // soften the copy's detail to 60 % (a 13 px box blur plus 0.6 of the detail) so the mirrored
    // shapes do not repeat visibly when the camera pushes in
    {
      const tmp = new Float32Array(n * 3), bl = new Float32Array(n * 3), R = 6
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
        let s = 0, k = 0; for (let t = -R; t <= R; t++) { const xx = x + t; if (xx >= 0 && xx < w) { s += S[(y * w + xx) * 3 + c]; k++ } }
        tmp[(y * w + x) * 3 + c] = s / k
      }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
        let s = 0, k = 0; for (let t = -R; t <= R; t++) { const yy = y + t; if (yy >= 0 && yy < h) { s += tmp[(yy * w + x) * 3 + c]; k++ } }
        bl[(y * w + x) * 3 + c] = s / k
      }
      for (let i = 0; i < n * 3; i++) S[i] = bl[i] + 0.6 * (S[i] - bl[i])
    }
    const vals = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) vals[i * 3 + c] = d[i * 4 + c] - S[i * 3 + c]
    const known = new Uint8Array(n); for (let i = 0; i < n; i++) known[i] = mask[i] ? 0 : 1
    const relax = (v: Float32Array, kn: Uint8Array, W: number, H: number, iters: number) => {
      for (let it = 0; it < iters; it++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x; if (kn[i]) continue
        const l = x > 0 ? i - 1 : i, rr = x < W - 1 ? i + 1 : i, u = y > 0 ? i - W : i, dn = y < H - 1 ? i + W : i
        for (let c = 0; c < 3; c++) v[i * 3 + c] = (v[l * 3 + c] + v[rr * 3 + c] + v[u * 3 + c] + v[dn * 3 + c]) * 0.25
      }
    }
    const solve = (v: Float32Array, kn: Uint8Array, W: number, H: number): void => {
      if (W <= 12 || H <= 12) {
        let s0 = [0, 0, 0], cnt = 0
        for (let i = 0; i < W * H; i++) if (kn[i]) { for (let c = 0; c < 3; c++) s0[c] += v[i * 3 + c]; cnt++ }
        for (let i = 0; i < W * H; i++) if (!kn[i]) for (let c = 0; c < 3; c++) v[i * 3 + c] = cnt ? s0[c] / cnt : 128
        relax(v, kn, W, H, 300); return
      }
      const cw = Math.ceil(W / 2), chh = Math.ceil(H / 2)
      const cv = new Float32Array(cw * chh * 3), ck = new Uint8Array(cw * chh), cc = new Float32Array(cw * chh)
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x; if (!kn[i]) continue
        const j = (y >> 1) * cw + (x >> 1); cc[j]++; for (let c = 0; c < 3; c++) cv[j * 3 + c] += v[i * 3 + c]
      }
      for (let j = 0; j < cw * chh; j++) if (cc[j]) { ck[j] = 1; for (let c = 0; c < 3; c++) cv[j * 3 + c] /= cc[j] }
      solve(cv, ck, cw, chh)
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x; if (kn[i]) continue
        const j = (y >> 1) * cw + (x >> 1); for (let c = 0; c < 3; c++) v[i * 3 + c] = cv[j * 3 + c]
      }
      relax(v, kn, W, H, 40)
    }
    solve(vals, known, w, h)
    // a soft fog grain (brightness only, smoothed so it reads as mist, not noise), and a feathered edge
    let seed = 7
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5 }
    const noise = new Float32Array(n); for (let i = 0; i < n; i++) noise[i] = rnd()
    const soft = new Float32Array(n)
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x; soft[i] = (noise[i] * 2 + noise[i - 1] + noise[i + 1] + noise[i - w] + noise[i + w]) / 6
    }
    // distance into the hole (for the feather), by repeated erosion up to r.feather
    const depth = new Uint8Array(n); { let cur = new Uint8Array(mask)
      for (let k = 1; k <= r.feather; k++) {
        const nx = new Uint8Array(n)
        for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (cur[i] && cur[i - 1] && cur[i + 1] && cur[i - w] && cur[i + w]) nx[i] = 1 }
        for (let i = 0; i < n; i++) if (cur[i]) depth[i] = k
        cur = nx
      } }
    const out = new Uint8ClampedArray(d)
    for (let i = 0; i < n; i++) {
      if (!mask[i]) continue
      const t = Math.min(1, depth[i] / r.feather), a2 = t * t * (3 - 2 * t)
      for (let c = 0; c < 3; c++) out[i * 4 + c] = d[i * 4 + c] * (1 - a2) + (S[i * 3 + c] + vals[i * 3 + c] + soft[i] * 3) * a2
    }
    img.data.set(out)
    ctx.putImageData(img, X0, Y0)
  }

  /**
   * Mask-based inpainting.
   * 1. The mask selects only the pixels to remove (plus `dilate` px).
   * 2. Those pixels are filled by Laplace diffusion from the surrounding ones.
   * 3. Fine texture (high-pass detail) is copied from the nearest unmasked
   *    pixels on the same row, mirrored, so fog/moon grain continues through.
   * 4. The edge is feathered by one pixel ring.
   * `select(lum, r, b, bgLum, x, y)` – bgLum is the row's background luminance.
   */
  private inpaint(
    ctx: CanvasRenderingContext2D,
    rx0: number, ry0: number, rx1: number, ry1: number,
    select: (lum: number, r: number, b: number, bg: number, x: number, y: number) => boolean,
    dilate: number, wx: number, wy: number,
  ): void {
    const m = 8
    const X0 = Math.max(0, rx0 - m), Y0 = Math.max(0, ry0 - m)
    const X1 = Math.min(ctx.canvas.width - 1, rx1 + m), Y1 = Math.min(ctx.canvas.height - 1, ry1 + m)
    const w = X1 - X0 + 1, h = Y1 - Y0 + 1
    const img = ctx.getImageData(X0, Y0, w, h)
    const d = img.data
    const lum = new Float32Array(w * h)
    for (let i = 0; i < w * h; i++) lum[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]

    // Background luminance per row = median of the margin columns.
    const bgRow = new Float32Array(h)
    for (let y = 0; y < h; y++) {
      const vals: number[] = []
      for (let x = 0; x < w; x++) {
        const gx = X0 + x
        if (gx < rx0 || gx > rx1) vals.push(lum[y * w + x])
      }
      vals.sort((a, b) => a - b)
      bgRow[y] = vals.length ? vals[vals.length >> 1] : 128
    }

    let mask = new Uint8Array(w * h)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (select(lum[i], d[i * 4], d[i * 4 + 2], bgRow[y], X0 + x, Y0 + y)) mask[i] = 1
    }
    for (let k = 0; k < dilate; k++) {
      const next = new Uint8Array(mask)
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x
        if (mask[i - 1] || mask[i + 1] || mask[i - w] || mask[i + w]) next[i] = 1
      }
      mask = next
    }
    // Never touch the outer margin (it is the boundary condition).
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) mask[y * w + x] = 0
    }

    // 3x3 blur of the original, used to split detail from base colour.
    const blur = new Float32Array(w * h * 3)
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let s = 0
        for (let yy = -1; yy <= 1; yy++) for (let xx = -1; xx <= 1; xx++) s += d[((y + yy) * w + x + xx) * 4 + c]
        blur[(y * w + x) * 3 + c] = s / 9
      }
    }

    const field = [0, 1, 2].map(c => {
      const f = new Float32Array(w * h)
      for (let i = 0; i < w * h; i++) f[i] = mask[i] ? bgRow[(i / w) | 0] : d[i * 4 + c]
      return f
    })
    for (let iter = 0; iter < 500; iter++) {
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x
        if (!mask[i]) continue
        for (let c = 0; c < 3; c++) {
          const f = field[c]
          f[i] = (f[i - 1] + f[i + 1]) * wx + (f[i - w] + f[i + w]) * wy
        }
      }
    }

    // Copy mirrored high-frequency detail from the nearest clean pixels in the row.
    const out = new Uint8ClampedArray(d)
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      if (!mask[i]) continue
      let l = x, r = x
      while (l > 0 && mask[y * w + l]) l--
      while (r < w - 1 && mask[y * w + r]) r++
      const dl = x - l, dr = r - x
      const src = dl <= dr ? l - dl : r + dr
      const sx = Math.min(w - 2, Math.max(1, src))
      const j = y * w + sx
      const ok = !mask[j]
      for (let c = 0; c < 3; c++) {
        const detail = ok ? d[j * 4 + c] - blur[j * 3 + c] : 0
        out[i * 4 + c] = field[c][i] + detail * 0.9
      }
    }
    // Feather: pixels touching the mask blend 50/50 with the fill of a neighbour.
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      if (mask[i]) continue
      const n = [i - 1, i + 1, i - w, i + w].find(k => mask[k])
      if (n === undefined) continue
      for (let c = 0; c < 3; c++) out[i * 4 + c] = (d[i * 4 + c] + out[n * 4 + c]) / 2
    }
    img.data.set(out)
    ctx.putImageData(img, X0, Y0)
  }

  // ── backdrop shader ──────────────────────────────────────────────────────

  private buildBackdrop(): void {
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      depthWrite: false,
      depthTest: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex;
        uniform float uTime, uFlash, uScale, uWinOn;
        uniform vec2 uScreen, uOffset, uImg;
        uniform vec4 uWin;
        uniform vec3 uMoon;
        varying vec2 vUv;
        uniform vec4 uLamp, uPumpA, uPumpB;
        uniform float uLampOn, uPumpAOn, uPumpBOn;
        uniform vec4 uDoor;
        uniform float uDoorArch, uDoorOpen, uDim, uFade;
        ${NOISE_GLSL}

        // Feathered ellipse mask (1 inside, 0 outside) around a light source.
        float lightMask(vec2 px, vec4 box, float inner) {
          float r = length((px - box.xy) / box.zw);
          return 1.0 - smoothstep(inner, 1.05, r);
        }
        // A jack-o'-lantern whose candle goes out: the carved face goes black,
        // the rind and the leaves it lit drop to a dim cold tone.
        vec3 pumpkinLight(vec3 col, float lum0, float lit, vec2 px, vec4 box, float on) {
          float core = smoothstep(0.5, 0.8, lum0) * (1.0 - smoothstep(0.55, 0.9, length((px - box.xy) / box.zw)));
          float m = max(lightMask(px, box, 0.72) * lit, core);
          float face = smoothstep(0.32, 0.62, lum0);
          vec3 rind = col * vec3(0.26, 0.2, 0.2);
          vec3 dead = mix(rind, vec3(0.035, 0.022, 0.018), face);
          col = mix(col, dead, m * clamp(1.0 - on, 0.0, 1.0));
          return col + col * m * max(on - 1.0, 0.0);              // flare as it relights
        }

        /** Plain bilinear: for masks and small details (cheap). */
        vec3 sampleFast(vec2 px) {
          vec2 uv = vec2(px.x / uImg.x, 1.0 - px.y / uImg.y);
          return texture2D(uTex, clamp(uv, 0.001, 0.999)).rgb;
        }
        /**
         * Catmull-Rom bicubic in 9 bilinear taps: when the camera pushes in on the
         * door, the painting stays smooth instead of showing the bilinear grid.
         * (The texture is the painting at TEX_UP times its size.)
         */
        vec3 sampleAt(vec2 px) {
          vec2 ts = uImg * ${TEX_UP.toFixed(1)};
          vec2 uv = clamp(vec2(px.x / uImg.x, 1.0 - px.y / uImg.y), 0.001, 0.999);
          vec2 p = uv * ts - 0.5, tc = floor(p) + 0.5, f = p - floor(p);
          vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
          vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
          vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
          vec2 w3 = f * f * (-0.5 + 0.5 * f);
          vec2 w12 = w1 + w2, o12 = w2 / w12;
          vec2 t0 = (tc - 1.0) / ts, t3 = (tc + 2.0) / ts, t12 = (tc + o12) / ts;
          vec3 c = texture2D(uTex, vec2(t0.x, t0.y)).rgb * w0.x * w0.y + texture2D(uTex, vec2(t12.x, t0.y)).rgb * w12.x * w0.y + texture2D(uTex, vec2(t3.x, t0.y)).rgb * w3.x * w0.y
                 + texture2D(uTex, vec2(t0.x, t12.y)).rgb * w0.x * w12.y + texture2D(uTex, vec2(t12.x, t12.y)).rgb * w12.x * w12.y + texture2D(uTex, vec2(t3.x, t12.y)).rgb * w3.x * w12.y
                 + texture2D(uTex, vec2(t0.x, t3.y)).rgb * w0.x * w3.y + texture2D(uTex, vec2(t12.x, t3.y)).rgb * w12.x * w3.y + texture2D(uTex, vec2(t3.x, t3.y)).rgb * w3.x * w3.y;
          return max(c, 0.0);
        }
        float grainHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
        float warmth(vec3 c) { return smoothstep(0.30, 0.65, c.r) * smoothstep(0.10, 0.32, c.r - c.b); }
        float skyness(vec3 c, vec2 px) {
          float bright = smoothstep(0.20, 0.48, luma(c));
          float cool = 1.0 - smoothstep(0.06, 0.2, c.r - c.b);
          return bright * cool * (1.0 - smoothstep(429.9, 558.8, px.y));
        }

        void main() {
          // screen pixel (y down) → painting pixel
          vec2 screenPx = vec2(vUv.x * uScreen.x, (1.0 - vUv.y) * uScreen.y);
          vec2 px = (screenPx - uOffset) / uScale;

          // 1) painted clouds drift: warp only the sky
          vec3 base = sampleFast(px);
          float sky0 = skyness(base, px);
          vec2 warp = vec2(fbm(px / 129.0 + vec2(uTime * 0.06, 0.0)) - 0.5,
                           fbm(px / 129.0 + vec2(3.0, uTime * 0.04)) - 0.5) * 12.9;
          vec3 col = sampleAt(px + warp * sky0);
          float sky = skyness(col, px);
          float warm = warmth(col);

          // 2) storm clouds rolling across the sky and in front of the moon.
          //    Two layers with parallax: big slow banks (~14 px/s) and fast,
          //    low scud (~30 px/s). Each is lit from the moon side so it gets a
          //    silver lining, and lightning lights it from inside.
          float dMoon = distance(px, uMoon.xy);
          float moonProx = smoothstep(uMoon.z * 3.2, uMoon.z * 0.7, dMoon);
          vec2 toMoon = (uMoon.xy - px) / max(dMoon, 1.0);

          vec2 q1 = px / vec2(343.9, 150.4) + vec2(uTime * 0.058, 0.0);
          float w1 = fbm(q1 * 0.6 + vec2(0.0, uTime * 0.015));
          float d1 = fbm(q1 + w1 * 0.9);
          float d1s = fbm(q1 + toMoon * 0.09 + w1 * 0.9);   // sample toward the moon
          float cover1 = smoothstep(0.46, 0.72, d1);

          vec2 q2 = px / vec2(214.9, 65.9) + vec2(uTime * 0.2, 0.0);
          float d2 = fbm(q2 + 7.3 + fbm(q2 * 0.5 + 2.0) * 0.6);
          float cover2 = smoothstep(0.55, 0.8, d2);

          float edgeLit = clamp((d1 - d1s) * 9.0, 0.0, 1.0);   // side facing the moon
          vec3 cloudDark = vec3(0.055, 0.065, 0.085);
          vec3 cloudMid = vec3(0.24, 0.27, 0.32);
          vec3 silver = vec3(0.86, 0.89, 0.93);
          vec3 c1col = mix(cloudDark, cloudMid, moonProx * 0.8);
          c1col = mix(c1col, silver, edgeLit * (0.25 + 0.75 * moonProx) * (1.0 - smoothstep(0.62, 0.85, d1)));
          vec3 c2col = mix(vec3(0.09, 0.1, 0.12), vec3(0.42, 0.45, 0.5), moonProx);
          float flashIn = uFlash * (0.6 + 0.8 * d1);
          c1col += vec3(0.55, 0.62, 0.8) * flashIn;
          c2col += vec3(0.45, 0.5, 0.65) * flashIn;

          float a1 = cover1 * 0.88;
          float a2 = cover2 * 0.6;
          col = mix(col, c1col, a1 * sky);
          col = mix(col, c2col, a2 * sky);
          // Moonlight bleeding through thin cloud near the disc.
          col += vec3(0.16, 0.17, 0.19) * moonProx * (1.0 - cover1) * cover2 * sky;

          // 3) ground fog drifting over the path
          float fogBand = smoothstep(544.5, 673.4, px.y) * (1.0 - smoothstep(859.7, 1003.0, px.y));
          float fog = smoothstep(0.45, 0.85, fbm(px / vec2(300.9, 54.4) + vec2(uTime * 0.05, 0.0)));
          col = mix(col, vec3(0.58, 0.63, 0.70), fog * fogBand * 0.26 * (1.0 - warm * 0.75));

          // 4) Firelight is steady (no moving noise, so nothing "waves").
          //    One tree lantern and one jack-o'-lantern blink on their own.
          float lum0 = luma(col);
          float litLoose = smoothstep(0.04, 0.22, col.r - col.b) * smoothstep(0.12, 0.35, col.r);
          {
            // Tree lantern: glass and the glow it throws on the bark go dark.
            // Wide, gradual falloff: the glow on the branches fades out with
            // distance instead of ending at a hard ring.
            float glassPx = smoothstep(0.38, 0.7, lum0) * (1.0 - smoothstep(0.8, 1.0, length((px - uLamp.xy) / uLamp.zw)));
            // the flame's white core is lit too (it has little red over blue, so litLoose misses it)
            float m = max(lightMask(px, uLamp, 0.78) * litLoose, glassPx);
            vec3 bark = vec3(lum0) * vec3(0.5, 0.53, 0.64);          // moonlit, no firelight
            vec3 dead = mix(bark, vec3(0.06, 0.055, 0.06), glassPx);
            col = mix(col, dead, m * clamp(1.0 - uLampOn, 0.0, 1.0));
            col += col * m * max(uLampOn - 1.0, 0.0);              // brief flare on relight
          }
          col = pumpkinLight(col, lum0, litLoose, px, uPumpA, uPumpAOn);
          col = pumpkinLight(col, lum0, litLoose, px, uPumpB, uPumpBOn);

          // 5) the blinking upstairs window
          vec2 wl = (px - uWin.xy) / (uWin.zw - uWin.xy);
          // feathered edges, and only the lit glass goes dark (not the frame)
          float inWin = smoothstep(-0.04, 0.06, wl.x) * smoothstep(1.04, 0.94, wl.x)
                      * smoothstep(-0.04, 0.06, wl.y) * smoothstep(1.04, 0.94, wl.y);
          // lit glass = warm OR bright (the centre of a lit pane is almost white); the glow it throws on the frame dims too
          float hotPane = smoothstep(0.34, 0.6, luma(col)) * smoothstep(0.02, 0.1, col.r - col.b);
          float glass = inWin * max(warm, hotPane);
          float halo = smoothstep(-0.45, 0.0, wl.x) * smoothstep(1.45, 1.0, wl.x) * smoothstep(-0.35, 0.0, wl.y) * smoothstep(1.35, 1.0, wl.y);
          // the orange glow on the frame round it is dimmer than the glass, so a looser warmth test
          float rimWarm = smoothstep(0.14, 0.4, col.r) * smoothstep(0.04, 0.18, col.r - col.b);
          col = mix(col, col * vec3(0.4, 0.36, 0.44), halo * rimWarm * (1.0 - uWinOn) * 0.85);
          col = mix(col, col * vec3(0.07, 0.06, 0.08), glass * (1.0 - uWinOn));

          // Ghostly booms: every warm light in the house sags for a moment.
          col = mix(col, col * vec3(0.32, 0.3, 0.38), warm * uDim * 0.85);

          // 5b) the front door swings inward (hinge on the left).
          if (uDoorOpen > 0.0) {
            vec2 dsz = uDoor.zw - uDoor.xy;
            vec2 dl = (px - uDoor.xy) / dsz;
            float archF = uDoorArch / dsz.y;
            float cx = dl.x * 2.0 - 1.0;
            float topY = archF * (1.0 - sqrt(max(0.0, 1.0 - cx * cx)));
            float inDoor = step(0.0, dl.x) * step(dl.x, 1.0) * step(topY, dl.y) * step(dl.y, 1.0);
            if (inDoor > 0.0) {
              float ang = uDoorOpen * 1.38;
              float leafW = cos(ang);                // projected width of the leaf
              // The dark hall behind: near black, a dim amber glow deep inside
              // (a candle under the chandelier), cold moonlight on the floor.
              vec3 room = vec3(0.004, 0.004, 0.006);
              // a far candle under the chandelier, and its faint pool of light
              vec2 gq = (dl - vec2(0.62, 0.5)) * vec2(1.0, 1.4);
              room += vec3(0.55, 0.3, 0.1) * exp(-dot(gq, gq) * 30.0) * 0.8;
              vec2 fq = (dl - vec2(0.62, 0.86)) * vec2(0.7, 3.0);
              room += vec3(0.18, 0.1, 0.04) * exp(-dot(fq, fq) * 6.0);
              // hall floorboards catching moonlight through the door
              room += vec3(0.06, 0.07, 0.09) * smoothstep(0.8, 1.0, dl.y);
              room *= 0.92 + 0.16 * hash(floor(px * 3.0));
              vec3 c = room;
              // Door thickness: a thin edge strip at the free side of the leaf.
              float edgeW = sin(ang) * 0.09;
              if (dl.x < leafW) {
                float su = dl.x / max(leafW, 0.001);
                // Perspective: the free edge recedes, so it looks shorter.
                float shrink = sin(ang) * 0.09 * su;
                float sv = (dl.y - shrink * 0.5) / (1.0 - shrink);
                float leafTop = archF * (1.0 - sqrt(max(0.0, 1.0 - (su * 2.0 - 1.0) * (su * 2.0 - 1.0))));
                float onLeaf = step(leafTop, sv) * step(sv, 1.0);
                vec3 leaf = sampleFast(uDoor.xy + vec2(su, sv) * dsz);
                leaf *= mix(1.0, 0.7, uDoorOpen);   // turning away from the light
                // the porch lamp rakes across the panels as it turns
                leaf += vec3(0.16, 0.08, 0.03) * sin(ang) * (1.0 - su) * 0.6;
                c = mix(room, leaf, onLeaf);
              } else if (dl.x < leafW + edgeW) {
                // door edge, lit warm by the porch lamp
                c = vec3(0.34, 0.19, 0.09) * (1.0 - 0.35 * uDoorOpen);
              }
              col = c;
            }
          }

          // 6) lightning lights the whole painting, the sky most
          float skyArea = 1.0 - smoothstep(315.2, 888.4, px.y);
          col += uFlash * (col * 1.1 + vec3(0.20, 0.24, 0.32) * (0.35 + 0.65 * skyArea));

          // gentle vignette
          vec2 v = vUv - 0.5;
          col *= 1.0 - dot(v, v) * 0.42;
      // a gentle shadow lift (black stays black); overall a touch below the painting, so the night reads as night
      col = pow(max(col, 0.0), vec3(0.9)) * 0.97;
          // film grain, finer than the painting's own pixels: it grows as the camera
          // pushes in (uScale = screen px per painting px), so the close-up reads as film, not blocks
          float mag = smoothstep(1.12, 2.37, uScale);
          float gr = grainHash(floor(vUv * uScreen) + fract(uTime * 23.0) * 97.0) - 0.5;
          col += gr * (0.012 + 0.03 * mag) * (0.35 + luma(col));
          col *= 1.0 - uFade;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
    this.backdrop = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material)
    this.backdrop.renderOrder = -10
    this.backdrop.frustumCulled = false
    this.scene.add(this.backdrop)
  }

  // ── Arjun ────────────────────────────────────────────────────────────────

  private buildArjun(): void {
    this.scene.add(this.arjun)

    // Lights used only by Arjun (the painting itself is not lit by three.js).
    // Side-back lights give him rim highlights like the painted figure:
    // cool moonlight on one edge, warm house/pumpkin glow on the other.
    this.scene.add(new THREE.AmbientLight(0x2c3446, 0.9))
    this.rimLight.color.set(0xa9c0ff)
    this.rimLight.position.set(-1, 0.6, -0.25)
    this.scene.add(this.rimLight)
    const warmRim = new THREE.DirectionalLight(0xff9a4a, 1.6)
    warmRim.position.set(1, 0.35, -0.2)
    this.scene.add(warmRim)
    // Soft front fill (moonlight bounced off the wet path) so the face is
    // modelled by light instead of being split into a blue and an orange half.
    const fill = new THREE.DirectionalLight(0x8b8a96, 1.1)
    fill.position.set(0.35, 0.25, 1)
    this.scene.add(fill)

    const glowTex = this.radialTexture()
    this.lanternHalo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xff9a3c, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    }))
    this.lanternHalo.renderOrder = 5
    this.scene.add(this.lanternHalo)
    this.groundGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xff7a26, transparent: true, opacity: 0.45,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    }))
    this.groundGlow.renderOrder = -5
    this.scene.add(this.groundGlow)
  }

  private radialTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.25, 'rgba(255,255,255,0.45)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
    return new THREE.CanvasTexture(c)
  }

  // ── bats ─────────────────────────────────────────────────────────────────

  private buildBats(): void {
    const wingShape = new THREE.Shape()
    const pts: Array<[number, number]> = [
      [0, 0.04], [0.16, 0.15], [0.34, 0.2], [0.5, 0.11], [0.44, 0.0],
      [0.36, 0.05], [0.29, -0.06], [0.21, 0.0], [0.13, -0.07], [0.05, -0.02],
    ]
    wingShape.moveTo(pts[0][0], pts[0][1])
    pts.slice(1).forEach(([x, y]) => wingShape.lineTo(x, y))
    wingShape.closePath()
    const wingGeo = new THREE.ShapeGeometry(wingShape)
    const mat = new THREE.MeshBasicMaterial({ color: 0x050407, side: THREE.DoubleSide, depthTest: false })
    const bodyGeo = new THREE.SphereGeometry(0.06, 10, 8)

    const make = (kind: Bat['kind'], i: number): Bat => {
      const root = new THREE.Group()
      const body = new THREE.Mesh(bodyGeo, mat)
      body.scale.set(0.75, 1.3, 0.75)
      root.add(body)
      const earL = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 4), mat)
      earL.position.set(-0.025, 0.09, 0)
      const earR = earL.clone()
      earR.position.x = 0.025
      root.add(earL, earR)
      const wingR = new THREE.Group()
      wingR.add(new THREE.Mesh(wingGeo, mat))
      const wingL = new THREE.Group()
      const left = new THREE.Mesh(wingGeo, mat)
      left.scale.x = -1
      wingL.add(left)
      root.add(wingL, wingR)
      root.renderOrder = 8
      this.scene.add(root)

      const r = (a: number, b: number) => a + Math.random() * (b - a)
      const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1
      if (kind === 'orbit') {
        return { root, wingL, wingR, kind, size: r(14, 24) * S, speed: r(0.25, 0.5) * dir, phase: (i / 5) * Math.PI * 2, rx: r(130, 230) * S, ry: r(35, 75) * S, y: MOON.y + r(-10, 30) * S, dir, flap: r(9, 13) }
      }
      if (kind === 'cross') {
        return { root, wingL, wingR, kind, size: r(10, 26) * S, speed: r(55, 110) * S, phase: r(0, 1400) * S, rx: 0, ry: r(8, 22) * S, y: r(30, 270) * S, dir, flap: r(10, 15) }
      }
      return { root, wingL, wingR, kind, size: r(55, 80) * S, speed: r(260, 340) * S, phase: r(0, 4000) * S, rx: 0, ry: r(30, 60) * S, y: r(60, 190) * S, dir, flap: r(7, 9) }
    }
    // The painted bats were removed, so all bats in the sky are these animated ones.
    for (let i = 0; i < 7; i++) this.bats.push(make('orbit', i))
    for (let i = 0; i < 10; i++) this.bats.push(make('cross', i))
    for (let i = 0; i < 2; i++) this.bats.push(make('swoop', i))
  }

  private updateBats(t: number): void {
    this.bats.forEach((bat, index) => {
      let x: number
      let y: number
      let heading = bat.dir
      if (bat.kind === 'orbit') {
        const a = t * bat.speed + bat.phase
        x = MOON.x + Math.cos(a) * bat.rx
        y = bat.y + Math.sin(a) * bat.ry + Math.sin(t * 2.2 + index) * 6 * S
        heading = -Math.sin(a) * Math.sign(bat.speed) > 0 ? 1 : -1
      } else {
        // Fly across the full painting width, then re-enter after a pause.
        const span = IMG_W + (400 + (bat.kind === 'swoop' ? 3500 : 300)) * S
        const p = (t * bat.speed + bat.phase) % span
        x = bat.dir > 0 ? -200 * S + p : IMG_W + 200 * S - p
        y = bat.y + Math.sin(t * 1.7 + index) * bat.ry + (bat.kind === 'swoop' ? Math.sin(p / (260 * S)) * 40 * S : 0)
      }
      const flap = Math.sin(t * bat.flap + index)
      bat.wingL.rotation.y = flap * 1.05
      bat.wingR.rotation.y = -flap * 1.05
      bat.wingL.rotation.z = -flap * 0.35
      bat.wingR.rotation.z = flap * 0.35
      const s = bat.size * this.mapScale
      bat.root.scale.set(s, s, s)
      bat.root.rotation.z = heading * 0.18 + flap * 0.05
      const sp = this.toScreen(x, y + flap * 1.5)
      bat.root.position.set(sp.x, sp.y, 100)
    })
  }

  // ── rain & lightning bolt ────────────────────────────────────────────────

  private buildRain(): void {
    const count = 420
    this.rainData = new Float32Array(count * 3) // x, y, length (screen px)
    const positions = new Float32Array(count * 6)
    for (let i = 0; i < count; i++) {
      this.rainData[i * 3] = Math.random()
      this.rainData[i * 3 + 1] = Math.random()
      this.rainData[i * 3 + 2] = 12 + Math.random() * 18
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      color: 0xb8cadb, transparent: true, opacity: 0.22, depthTest: false,
    }))
    this.rain.renderOrder = 9
    this.rain.frustumCulled = false
    this.scene.add(this.rain)
  }

  private updateRain(delta: number): void {
    if (!this.rain || !this.rainData) return
    const pos = this.rain.geometry.getAttribute('position') as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    const w = this.width
    const h = this.height
    for (let i = 0; i < this.rainData.length / 3; i++) {
      let fy = this.rainData[i * 3 + 1] + delta * 1.25
      let fx = this.rainData[i * 3] + delta * 0.12
      if (fy > 1.05) { fy -= 1.1; fx = Math.random() }
      if (fx > 1) fx -= 1
      this.rainData[i * 3] = fx
      this.rainData[i * 3 + 1] = fy
      const len = this.rainData[i * 3 + 2]
      const x = fx * w
      const y = h - fy * h
      arr[i * 6] = x
      arr[i * 6 + 1] = y
      arr[i * 6 + 2] = 200
      arr[i * 6 + 3] = x - len * 0.18
      arr[i * 6 + 4] = y + len
      arr[i * 6 + 5] = 200
    }
    pos.needsUpdate = true
    ;(this.rain.material as THREE.LineBasicMaterial).opacity = 0.2 + this.uniforms.uFlash.value * 0.5
  }

  private buildBolt(): void {
    this.bolt = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        color: 0xe8f0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
        depthTest: false, side: THREE.DoubleSide,
      }),
    )
    this.bolt.renderOrder = -6
    this.bolt.frustumCulled = false
    this.scene.add(this.bolt)
  }

  /** Builds a jagged bolt (as a ribbon of quads) in one of the open sky areas. */
  private regenerateBolt(): void {
    if (!this.bolt) return
    const left = Math.random() < 0.5
    let x = (left ? 150 + Math.random() * 140 : 620 + Math.random() * 200) * S
    let y = -10
    const endY = (190 + Math.random() * 110) * S
    const verts: number[] = []
    const segment = (ax: number, ay: number, bx: number, by: number, width: number) => {
      const a = this.toScreen(ax, ay)
      const b = this.toScreen(bx, by)
      const dx = b.x - a.x
      const dy = b.y - a.y
      const len = Math.hypot(dx, dy) || 1
      const nx = (-dy / len) * width * this.mapScale
      const ny = (dx / len) * width * this.mapScale
      verts.push(
        a.x + nx, a.y + ny, -50, a.x - nx, a.y - ny, -50, b.x + nx, b.y + ny, -50,
        b.x + nx, b.y + ny, -50, a.x - nx, a.y - ny, -50, b.x - nx, b.y - ny, -50,
      )
    }
    while (y < endY) {
      const nx = x + (Math.random() - 0.5) * 34
      const ny = y + 12 + Math.random() * 20
      segment(x, y, nx, ny, 1.6)
      if (Math.random() < 0.16) {
        // short side branch
        let bx = nx
        let by = ny
        for (let k = 0; k < 4; k++) {
          const cx = bx + (Math.random() - 0.3) * 26 * (left ? 1 : -1)
          const cy = by + 8 + Math.random() * 14
          segment(bx, by, cx, cy, 0.8)
          bx = cx
          by = cy
        }
      }
      x = nx
      y = ny
    }
    this.bolt.geometry.dispose()
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
    this.bolt.geometry = geo
  }

  // ── mapping & resize ─────────────────────────────────────────────────────

  private updateMapping(t: number): void {
    // Cover-fit the painting, with a very slow cinematic push-in.
    let zoom = 1.02 + 0.025 * (0.5 - 0.5 * Math.cos(t * 0.06))
    // Keep the bungalow/figure column centred (between the door and Arjun).
    let focusX = HOUSE_X
    let focusY = IMG_H / 2
    const et = this.enterTime()
    if (et !== null) {
      // Push in toward the front door while Arjun walks up, hold while the
      // door opens, then follow him through the doorway.
      const sm = THREE.MathUtils.smootherstep
      const k1 = sm(et, 0, ENTER.zoomEnd)
      const k2 = sm(et, ENTER.zoomEnd, ENTER.fadeStart) * 0.12
      const k3 = sm(et, ENTER.stepIn, ENTER.end)
      // a shallower push-in (was 1 + 1.25 k1): the painting is only 1072 px wide, and at
      // more than ~2.7x its pixels show. The step through the door rushes in less (k3), under the fade.
      zoom *= 1 + 0.75 * k1 + k2 + 1.2 * k3
      const doorX = (DOOR.x0 + DOOR.x1) / 2
      const doorY = DOOR.y0 + (DOOR.y1 - DOOR.y0) * 0.45
      const k = Math.min(1, k1 + k3)
      focusX = THREE.MathUtils.lerp(HOUSE_X, doorX, k)
      focusY = THREE.MathUtils.lerp(IMG_H / 2, doorY, k)
    }
    const s = Math.max(this.width / IMG_W, this.height / IMG_H) * zoom
    this.mapScale = s
    let ox = this.width / 2 - focusX * s
    ox = Math.min(0, Math.max(this.width - IMG_W * s, ox))
    let oy = this.height / 2 - focusY * s
    oy = Math.min(0, Math.max(this.height - IMG_H * s, oy))
    this.mapOffset.set(ox, oy)
    this.uniforms.uScale.value = s
    this.uniforms.uOffset.value.set(ox, oy)
  }

  /** Painting pixel (y down) → overlay world position (y up). */
  private toScreen(x: number, y: number): THREE.Vector2 {
    return new THREE.Vector2(
      this.mapOffset.x + x * this.mapScale,
      this.height - (this.mapOffset.y + y * this.mapScale),
    )
  }

  resize(): void {
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.renderer.setSize(this.width, this.height)
    this.camera.left = 0
    this.camera.right = this.width
    this.camera.top = this.height
    this.camera.bottom = 0
    this.camera.updateProjectionMatrix()
    this.uniforms.uScreen.value.set(this.width, this.height)
    if (this.backdrop) {
      this.backdrop.scale.set(this.width, this.height, 1)
      this.backdrop.position.set(this.width / 2, this.height / 2, -500)
    }
    if (this.fadePlane) {
      this.fadePlane.scale.set(this.width, this.height, 1)
      this.fadePlane.position.set(this.width / 2, this.height / 2, 900)
    }
  }

  // ── main loop ────────────────────────────────────────────────────────────

  private loop = (): void => {
    if (this.disposed || !this.active) return
    this.frameId = requestAnimationFrame(this.loop)
    const delta = Math.min(this.clock.getDelta(), 0.05)
    const t = this.clock.elapsedTime
    this.uniforms.uTime.value = t

    this.updateMapping(t)
    this.updateArjun(t, delta)
    this.updateBats(t)
    this.updateRain(delta)
    this.updateWindow(delta)
    const u = this.uniforms
    u.uLampOn.value = this.updateBlinker(this.lampBlink, LANTERN_BLINK, delta, 0.6, 1.0, u.uLampOn.value)
    u.uPumpAOn.value = this.updateBlinker(this.pumpABlink, PUMPKIN_BLINK, delta, 0.8, 1.0, u.uPumpAOn.value)
    u.uPumpBOn.value = this.updateBlinker(this.pumpBBlink, PUMPKIN_BLINK, delta, 1.0, 1.2, u.uPumpBOn.value)
    this.updateLightning(delta)
    this.updateEnter(delta)

    this.renderer.render(this.scene, this.camera)
  }

  private updateArjun(t: number, delta: number): void {
    let fx = ARJUN_FEET.x, fy = ARJUN_FEET.y
    let heightPx = ARJUN_HEIGHT
    const et = this.enterTime()
    let phase = 0
    let speed = 0       // 0..1 of cruising speed
    if (et !== null) {
      // Up the path to the door step, then (once the door is open) a turn
      // and a few steps into the doorway. Position, speed and the gait
      // phase all come from the distance walked on the ground, so the
      // feet never slide.
      const a = this.walkSeg(WALK_PATH, et - ENTER.walkStart, ENTER.walkEnd - ENTER.walkStart)
      const b = this.walkSeg(STEP_IN_PATH, et - ENTER.stepIn, ENTER.stepInEnd - ENTER.stepIn)
      const seg = et >= ENTER.stepIn ? b : a
      fx = seg.x
      fy = seg.y
      speed = seg.speed
      phase = Math.PI * (a.dist + b.dist) / STEP_LEN
      if (speed > 0.02) {
        const target = seg.heading
        this.walkHeading += (target - this.walkHeading) * Math.min(1, delta * 3.5)
      }
      heightPx = ARJUN_HEIGHT * heightAt(fy) / heightAt(ARJUN_FEET.y)
      this.setArjunDarkness(THREE.MathUtils.smoothstep(et, ENTER.stepIn + 0.5, ENTER.stepInEnd))
    }
    const heading = this.walkHeading
    const feet = this.toScreen(fx, fy)
    const unit = (heightPx / 0.975) * this.mapScale // model height ≈ 0.975 units
    this.arjun.position.set(feet.x, feet.y, 0)
    this.arjun.scale.setScalar(unit)
    this.lanternLight.distance = unit * 0.9

    // Faces the viewer, then turns around to look at the bungalow.
    const turnStart = 2.2
    const turn = THREE.MathUtils.clamp((t - turnStart) / 1.9, 0, 1)
    const eased = turn * turn * (3 - 2 * turn)
    let rotY = eased * Math.PI
    if (et !== null) {
      // Enter pressed early: finish turning to the house quickly, then
      // steer along the path.
      const k = THREE.MathUtils.smoothstep(et, 0, 0.8)
      rotY = THREE.MathUtils.lerp(this.enterFrom.rot, Math.PI, k) + heading * k
    }
    this.arjunInner.rotation.y = rotY
    // small weight shift while turning, breathing afterwards
    this.arjunInner.position.y = Math.sin(turn * Math.PI) * 0.006 + Math.sin(t * 1.4) * 0.002
    this.arjunInner.rotation.z = Math.sin(turn * Math.PI) * 0.025

    this.arjunModel.updateGait(phase, speed, delta)

    // Near-steady flame: a slow, slight breathing instead of a fast flicker.
    const flicker = (0.97 + Math.sin(t * 1.3) * 0.015 + Math.sin(t * 3.7) * 0.01) * (1 - this.darkK * 0.95)
    this.lanternLight.intensity = 5 * flicker
    if (this.lanternGlass) (this.lanternGlass.material as THREE.MeshBasicMaterial).color.setRGB(1, 0.72 * flicker + 0.1, 0.38 * flicker)

    if (this.lanternGlass && this.lanternHalo && this.groundGlow) {
      const p = new THREE.Vector3()
      this.lanternGlass.getWorldPosition(p)
      this.lanternHalo.position.set(p.x, p.y, 50)
      const halo = unit * 0.36 * flicker
      this.lanternHalo.scale.set(halo, halo, 1)
      this.groundGlow.position.set(p.x, feet.y + unit * 0.02, -20)
      this.groundGlow.scale.set(unit * 1.1 * flicker, unit * 0.32, 1)
    }
    this.rimLight.intensity = 2.2 + this.uniforms.uFlash.value * 6
  }

  // ── ENTER THE BUNGALOW ───────────────────────────────────────────────────

  private darkK = 0
  private walkTables = new Map<number[][], { pts: THREE.Vector2[]; ground: THREE.Vector2[]; cum: number[] }>()

  /** Painting px → ground position in units of Arjun's height (x right, z away). */
  private ground(x: number, y: number): THREE.Vector2 {
    const h = heightAt(y)
    return new THREE.Vector2((x - HOUSE_X) / h, FOCAL / h)
  }

  /**
   * Walk along `path` for `T` seconds starting at τ = 0: accelerate, cruise,
   * slow to a stop. Returns position (painting px), distance on the ground
   * (Arjun heights), speed (0..1 of cruise) and heading (rad, + = left).
   */
  private walkSeg(path: number[][], tau: number, T: number) {
    let tab = this.walkTables.get(path)
    if (!tab) {
      const curve = new THREE.CatmullRomCurve3(path.map(([x, y]) => new THREE.Vector3(x, y, 0)))
      const pts = curve.getSpacedPoints(240).map(p => new THREE.Vector2(p.x, p.y))
      const ground = pts.map(p => this.ground(p.x, p.y))
      const cum = [0]
      for (let i = 1; i < ground.length; i++) cum.push(cum[i - 1] + ground[i].distanceTo(ground[i - 1]))
      tab = { pts, ground, cum }
      this.walkTables.set(path, tab)
    }
    const D = tab.cum[tab.cum.length - 1]
    const ta = Math.min(ACCEL, T / 2)
    const v = D / (T - ta)
    const t = THREE.MathUtils.clamp(tau, 0, T)
    let dist: number, sp: number
    if (t < ta) { dist = (v * t * t) / (2 * ta); sp = t / ta }
    else if (t < T - ta) { dist = v * (t - ta / 2); sp = 1 }
    else { dist = D - (v * (T - t) * (T - t)) / (2 * ta); sp = (T - t) / ta }
    if (tau <= 0 || tau >= T) sp = 0
    // locate on the arc-length table
    let i = 1
    while (i < tab.cum.length - 1 && tab.cum[i] < dist) i++
    const k = (dist - tab.cum[i - 1]) / Math.max(1e-6, tab.cum[i] - tab.cum[i - 1])
    const p = tab.pts[i - 1].clone().lerp(tab.pts[i], THREE.MathUtils.clamp(k, 0, 1))
    const g0 = tab.ground[i - 1], g1 = tab.ground[i]
    const heading = Math.atan2(-(g1.x - g0.x), g1.y - g0.y)
    return { x: p.x, y: p.y, dist, speed: sp, heading }
  }

  /** Arjun disappears into the dark hall: his colours and lantern fade to black. */
  private setArjunDarkness(k: number): void {
    this.darkK = k
    this.arjunModel.setDarkness(k)
  }

  /** Seconds into the entrance sequence, on the door recording's clock; null if not entering. */
  private enterTime(): number | null {
    if (this.enterStart === null) return null
    if (this.enterUsesAudio && this.ctx) return this.ctx.currentTime - this.enterStart
    return performance.now() / 1000 - this.enterStart
  }

  /**
   * ENTER THE BUNGALOW. Must be called from the click (it may create the
   * AudioContext). Plays the door recording and drives the scene from its
   * clock: lights sag on the two booms, the door opens with the creak, and
   * Arjun walks up and goes in. `onDone` fires after the fade to black.
   */
  enter(onDone: () => void): void {
    if (this.enterStart !== null) return
    this.enterDone = onDone
    this.enterFrom.rot = this.arjunInner.rotation.y
    this.nextFlash = 1e9                         // no lightning over the door sounds
    this.nextBlink = 1e9                         // the upstairs window stays lit
    if (this.blinkT >= 0) { this.blinkT = -1; this.uniforms.uWinOn.value = 1 }
    if (!this.ctx) void this.enableAudio()
    const ctx = this.ctx
    const begin = (buffer: AudioBuffer | null) => {
      if (this.disposed || this.enterStart !== null) return
      if (ctx && buffer && this.master) {
        const when = ctx.currentTime + 0.05
        const src = ctx.createBufferSource()
        src.buffer = buffer
        const gain = ctx.createGain()
        gain.gain.value = 1.0
        src.connect(gain).connect(this.master)
        src.start(when)
        this.enterStart = when + (ctx.outputLatency || ctx.baseLatency || 0)
        this.enterUsesAudio = true
      } else {
        this.enterStart = performance.now() / 1000
        this.enterUsesAudio = false
      }
    }
    if (this.doorClip || !ctx) begin(this.doorClip)
    else {
      this.loadDoorClip(ctx).then(b => begin(b), () => begin(null))
      // Never hang: if decoding is slow, run on the wall clock.
      window.setTimeout(() => begin(null), 2500)
    }
  }

  private doorLoading: Promise<AudioBuffer> | null = null

  private loadDoorClip(ctx: AudioContext): Promise<AudioBuffer> {
    if (!this.doorLoading) this.doorLoading = this.decodeDoorClip(ctx)
    return this.doorLoading
  }

  /** Joins the DOOR_KEEP ranges of `src` (equal-power 60 ms crossfade at each join). */
  private spliceClip(ctx: AudioContext, src: AudioBuffer): AudioBuffer {
    const sr = src.sampleRate
    const fade = Math.round(sr * 0.06)
    const ranges = DOOR_KEEP.map(([a, b]) => [Math.round(a * sr), Math.min(src.length, Math.round(b * sr))])
    const gains = DOOR_KEEP.map(r => r[2])
    const total = ranges.reduce((n, [a, b]) => n + (b - a), 0) - fade * (ranges.length - 1)
    const out = ctx.createBuffer(src.numberOfChannels, total, sr)
    for (let c = 0; c < src.numberOfChannels; c++) {
      const from = src.getChannelData(c)
      const to = out.getChannelData(c)
      let w = 0
      ranges.forEach(([a, b], r) => {
        for (let i = a; i < b; i++, w++) {
          const j = i - a
          let g = 1
          const fin = r === 0 ? fade * 4 : fade                                   // the very start fades in slowly
          if (j < fin) g = Math.sin((j / fin) * Math.PI / 2)
          if (r < ranges.length - 1 && b - i <= fade) g = Math.cos(((fade - (b - i)) / fade) * Math.PI / 2)
          if (w < total) to[w] += from[i] * g * gains[r]
        }
        if (r < ranges.length - 1) w -= fade                                    // overlap
      })
    }
    return out
  }

  private async decodeDoorClip(ctx: AudioContext): Promise<AudioBuffer> {
    const raw = await ctx.decodeAudioData(await (await fetch(DOOR_CLIP)).arrayBuffer())
    const buffer = this.spliceClip(ctx, raw)
    this.doorClip = buffer
    this.doorEnv = this.loudnessEnvelope(buffer)
    // Door-leaf progress = cumulative energy of the creak, so the door moves
    // when (and as much as) the hinge is heard.
    const env = this.doorEnv
    const i0 = Math.floor(ENTER.creakStart / THUNDER_ENV_STEP)
    const i1 = Math.min(env.length, Math.ceil(ENTER.creakEnd / THUNDER_ENV_STEP))
    const cum = new Float32Array(env.length)
    let acc = 0
    for (let i = 0; i < env.length; i++) {
      if (i >= i0 && i < i1) acc += env[i] * env[i]
      cum[i] = acc
    }
    for (let i = 0; i < env.length; i++) cum[i] /= acc || 1
    this.doorCreak = cum
    return buffer
  }

  private updateEnter(delta: number): void {
    const et = this.enterTime()
    if (et === null) return
    const u = this.uniforms
    const idx = Math.floor(et / THUNDER_ENV_STEP)
    // Ghostly drone: the house's warm lights sag twice, slowly, like a breath.
    let dim = 0
    if (et > 0.4 && et < ENTER.boomsEnd) dim = 0.75 * Math.pow(Math.max(0, Math.sin(((et - 0.4) / 1.7) * Math.PI)), 2)
    u.uDim.value += (dim - u.uDim.value) * Math.min(1, delta * 18)
    // Door: follows the creak's energy (or a timed ease without audio).
    let open: number
    if (this.doorCreak && this.enterUsesAudio) {
      open = et <= 0 ? 0 : this.doorCreak[Math.min(this.doorCreak.length - 1, Math.max(0, idx))]
    } else {
      open = THREE.MathUtils.smoothstep(et, ENTER.creakStart, ENTER.creakEnd)
    }
    u.uDoorOpen.value = THREE.MathUtils.smoothstep(open, 0, 1) * 0.93
    // Fade to black, then hand over to the game.
    const fade = THREE.MathUtils.smoothstep(et, ENTER.fadeStart, ENTER.end)
    u.uFade.value = fade
    if (this.fadePlane) (this.fadePlane.material as THREE.MeshBasicMaterial).opacity = fade
    if (et >= ENTER.end + 0.15 && !this.enterFinished) {
      this.enterFinished = true
      this.enterDone?.()
    }
  }

  private fadePlane: THREE.Mesh | null = null

  private buildFadePlane(): void {
    this.fadePlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false }),
    )
    this.fadePlane.renderOrder = 100
    this.fadePlane.frustumCulled = false
    this.scene.add(this.fadePlane)
  }

  /**
   * Plays a blink schedule every `base + random * spread` seconds and returns
   * the light level. The level eases toward the target over ~40 ms, the way a
   * flame or filament dims, rather than snapping in a single frame.
   */
  private updateBlinker(
    state: { t: number; wait: number; next: number },
    keys: Array<[number, number]>,
    delta: number, base: number, spread: number, current: number,
  ): number {
    let target = 1
    if (state.t < 0) {
      state.wait += delta
      if (state.wait >= state.next) {
        state.wait = 0
        state.next = base + Math.random() * spread
        state.t = 0
      }
    }
    if (state.t >= 0) {
      state.t += delta
      const end = keys[keys.length - 1][0]
      for (const [at, level] of keys) if (state.t >= at) target = level
      if (state.t > end + 0.3) state.t = -1
    }
    return current + (target - current) * Math.min(1, delta * 25)
  }

  /** The upstairs window light stutters off and back on every few seconds. */
  private updateWindow(delta: number): void {
    if (this.blinkT < 0) {
      this.blinkTimer += delta
      if (this.blinkTimer < this.nextBlink) return
      this.blinkTimer = 0
      this.nextBlink = 6 + Math.random() * 3
      this.blinkT = 0
    }
    this.blinkT += delta
    const t = this.blinkT
    // Light: stutter off, back on, hold, stutter, steady.
    const on =
      t < 0.12 ? 0 : t < 0.2 ? 1 : t < 0.42 ? 0 : t < 1.6 ? 1 :
      t < 1.7 ? 0 : t < 1.78 ? 1 : t < 1.93 ? 0 : 1
    this.uniforms.uWinOn.value = on
    if (t > 2.1) {
      this.blinkT = -1
      this.uniforms.uWinOn.value = 1
    }
  }

  private updateLightning(delta: number): void {
    if (this.flashT < 0) {
      this.flashTimer += delta
      if (this.flashTimer < this.nextFlash) return
      this.flashTimer = 0
      this.nextFlash = 6 + Math.random() * 2 - 1   // continuous thunder: ~6 s quiet gap (5–7 s)
      this.flashT = 0
      this.regenerateBolt()
      // Close strike: the clap is heard at the same moment as the flash.
      this.thunderHeardAt = this.playThunder()
    }
    this.flashT += delta

    let flash: number
    let t: number
    const ctx = this.ctx
    if (this.thunderHeardAt !== null && ctx && this.thunderEnv) {
      // Audio clock drives the light, so each burst of the clap lights the
      // scene exactly when it is heard (separate strokes = separate flashes).
      t = ctx.currentTime - this.thunderHeardAt
      const env = this.thunderEnv
      const i = Math.floor(t / THUNDER_ENV_STEP)
      const level = t < 0 || i >= env.length ? 0 : Math.max(env[i], i > 0 ? env[i - 1] * 0.6 : 0)
      flash = Math.pow(level, 1.6) * Math.exp(-Math.max(t, 0) * 0.8)
    } else {
      // No sound yet (before the first click): scripted multi-stroke flash.
      t = this.flashT
      flash =
        t < 0.07 ? 1 : t < 0.13 ? 0.15 : t < 0.24 ? 0.85 : t < 0.3 ? 0.25 :
        t < 0.36 ? 0.6 : 0.6 * Math.exp(-(t - 0.36) * 5)
    }
    this.uniforms.uFlash.value = flash * 0.9
    if (this.bolt) (this.bolt.material as THREE.MeshBasicMaterial).opacity = t < 0.9 && flash > 0.3 ? flash : 0
    if (t > 1.6) {
      this.flashT = -1
      this.thunderHeardAt = null
      this.uniforms.uFlash.value = 0
      if (this.bolt) (this.bolt.material as THREE.MeshBasicMaterial).opacity = 0
    }
  }

  // ── audio ────────────────────────────────────────────────────────────────

  /** Must be called from a user gesture (browser autoplay rules). */
  async enableAudio(): Promise<void> {
    if (this.ctx) return
    const ctx = gameAudio()
    if (ctx.state !== 'running') void ctx.resume().catch(() => undefined)
    this.ctx = ctx
    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -14
    compressor.knee.value = 10
    compressor.ratio.value = 3
    this.master = ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 1
    this.master.connect(compressor)
    compressor.connect(ctx.destination)

    // Short outdoor reverb: the howl reflects off the treeline.
    this.forestVerb = ctx.createConvolver()
    {
      const noise = this.verbNoise ??= LandingScene.impulseNoise(48000, 2.6, 2.8)
      const ir = ctx.createBuffer(2, noise[0].length, 48000)
      noise.forEach((d, c) => ir.copyToChannel(d as Float32Array<ArrayBuffer>, c))
      this.forestVerb.buffer = ir
    }
    const verbReturn = ctx.createGain()
    verbReturn.gain.value = 0.55
    this.forestVerb.connect(verbReturn)
    verbReturn.connect(this.master)

    audioManager.unmute()
    audioManager.setMasterVolume(0.6)
    audioManager.playWind()
    audioManager.playRain()

    const load = async (url: string) => ctx.decodeAudioData(await (await fetch(url)).arrayBuffer())
    const [thunder, wolves] = await Promise.all([load(THUNDER_HIT), Promise.all(WOLF_CLIPS.map(load))])
    if (this.disposed) return
    this.thunderHit = thunder
    this.thunderEnv = this.loudnessEnvelope(thunder)
    this.wolfClips = wolves

    // Wolf howl soon after sound starts, then every 12 seconds.
    this.wolfTimeout = window.setTimeout(() => this.playWolf(), 1500)
    this.wolfInterval = window.setInterval(() => this.playWolf(), 12000)
    // Bring the next strike forward so the storm is heard right away
    // (not while the entrance sequence is playing).
    if (this.enterStart === null) this.nextFlash = Math.min(this.nextFlash, this.flashTimer + 1.2)
    // Ready the door recording so ENTER THE BUNGALOW starts instantly.
    void this.loadDoorClip(ctx).catch(() => undefined)
  }

  private forestVerb: ConvolverNode | null = null
  private thunderHit: AudioBuffer | null = null
  /** Loudness of the thunder clip per THUNDER_ENV_STEP, 0..1. */
  private thunderEnv: Float32Array | null = null
  /** Audio-clock time at which the current clap reaches the speakers. */
  private thunderHeardAt: number | null = null
  private wolfClips: AudioBuffer[] = []
  private wolfIndex = 0

  /** RMS loudness per 10 ms, mapped from the top 18 dB of the clip to 0..1. */
  private loudnessEnvelope(buffer: AudioBuffer): Float32Array {
    const step = Math.round(buffer.sampleRate * THUNDER_ENV_STEP)
    const n = Math.ceil(buffer.length / step)
    const db = new Float32Array(n)
    const chans = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c))
    let top = -120
    for (let k = 0; k < n; k++) {
      let s = 0
      const end = Math.min(buffer.length, (k + 1) * step)
      for (let i = k * step; i < end; i++) for (const ch of chans) s += ch[i] * ch[i]
      db[k] = 10 * Math.log10(s / ((end - k * step) * chans.length) + 1e-12)
      top = Math.max(top, db[k])
    }
    return db.map(v => THREE.MathUtils.clamp((v - (top - 18)) / 18, 0, 1))
  }


  /** Plays part of a clip with click-free fades. */
  private playClip(buffer: AudioBuffer, gain: number, chain: (src: AudioNode) => AudioNode, rate = 1): void {
    const ctx = this.ctx
    if (!ctx || !this.master || this.disposed) return
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.playbackRate.value = rate
    const env = ctx.createGain()
    const now = ctx.currentTime
    const dur = buffer.duration / rate
    env.gain.setValueAtTime(0, now)
    env.gain.linearRampToValueAtTime(gain, now + 0.08)
    env.gain.setValueAtTime(gain, now + dur - 0.6)
    env.gain.linearRampToValueAtTime(0, now + dur)
    src.connect(env)
    chain(env).connect(this.master)
    src.start(now)
    src.stop(now + dur + 0.05)
  }

  /**
   * Plays the thunder clap with its sharp attack intact (5 ms ramp, no long
   * fade-in) and a fade over the last second. Returns the audio-clock time
   * the sound reaches the speakers, or null if audio isn't running.
   */
  private playThunder(): number | null {
    const ctx = this.ctx
    const buffer = this.thunderHit
    if (!ctx || !buffer || !this.master || ctx.state !== 'running' || this.disposed) return null
    const when = ctx.currentTime + 0.03
    const dur = buffer.duration
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const env = ctx.createGain()
    env.gain.setValueAtTime(0, when)
    env.gain.linearRampToValueAtTime(1.1, when + 0.005)
    env.gain.setValueAtTime(1.1, when + dur - 1.0)
    env.gain.linearRampToValueAtTime(0, when + dur)
    // Weight in the low end: thunder is felt as much as heard.
    const low = ctx.createBiquadFilter()
    low.type = 'lowshelf'
    low.frequency.value = 140
    low.gain.value = 4
    src.connect(env).connect(low).connect(this.master)
    src.start(when)
    src.stop(when + dur + 0.05)
    return when + (ctx.outputLatency || ctx.baseLatency || 0)
  }

  private playWolf(): void {
    const ctx = this.ctx
    if (!ctx || !this.wolfClips.length) return
    const clip = this.wolfClips[this.wolfIndex++ % this.wolfClips.length]
    this.playClip(clip, 0.85, node => {
      // Distance: soften the top end, place it somewhere in the treeline,
      // and send some to the forest reverb.
      const air = ctx.createBiquadFilter()
      air.type = 'lowpass'
      air.frequency.value = 5200
      const pan = ctx.createStereoPanner()
      pan.pan.value = (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.45)
      node.connect(air)
      air.connect(pan)
      if (this.forestVerb) {
        const send = ctx.createGain()
        send.gain.value = 0.5
        air.connect(send)
        send.connect(this.forestVerb)
      }
      return pan
    })
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    soundState.muted = muted
    if (this.master) this.master.gain.value = muted ? 0 : 1
    if (muted) audioManager.mute()
    else {
      audioManager.unmute()
      audioManager.setMasterVolume(0.8)
    }
  }

  /**
   * Plays a recording through the landing's own mix (so the global mute
   * applies), with a 5 ms attack. Does nothing until sound has been enabled.
   */
  async playRecording(url: string, gain = 1): Promise<void> {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    let buf = this.clipCache.get(url)
    if (!buf) {
      buf = await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer())
      this.clipCache.set(url, buf)
    }
    if (this.disposed) return
    const src = ctx.createBufferSource()
    src.buffer = buf
    const g = ctx.createGain()
    const t = ctx.currentTime
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain, t + 0.005)
    src.connect(g).connect(this.master)
    src.start(t)
  }
  private clipCache = new Map<string, AudioBuffer>()
  /** Decodes a recording ahead of time, so playRecording() starts on the instant. */
  async preloadClip(url: string): Promise<void> {
    const ctx = this.ctx
    if (!ctx || this.clipCache.has(url)) return
    try { this.clipCache.set(url, await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer())) } catch { /* played without it */ }
  }

  /** Dev helper so the effects can be checked on demand. */
  debugTrigger(effect: 'flash' | 'blink'): void {
    if (effect === 'flash') this.nextFlash = this.flashTimer
    else this.nextBlink = this.blinkTimer
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.frameId)
    if (this.wolfInterval !== null) window.clearInterval(this.wolfInterval)
    if (this.wolfTimeout !== null) window.clearTimeout(this.wolfTimeout)
    audioManager.stopWind()
    audioManager.stopRain()
    releaseAudio(this.ctx, this.master ? [this.master] : [])
    this.scene.traverse(obj => {
      const mesh = obj as THREE.Mesh
      if (mesh.geometry) mesh.geometry.dispose()
      const mats = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : []
      mats.forEach(m => m.dispose())
    })
    this.uniforms.uTex.value?.dispose()
    this.renderer.dispose()
  }
}
