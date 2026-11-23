// Inside the bungalow. One continuous scene:
//
// 1. Intro (≈11.5 s): the front doors slam shut behind Arjun; cut to the
//    grand hall with the broken staircase; "Welcome back… I've waited"; the
//    witch's laugh. The Stage 1 title appears over the hall (React).
// 2. Stage 1 — The Hall of Watching Eyes, played in the same hall: four
//    portraits on the bookcase, the journal page on the pedestal, the locked
//    study door, three candles that are Arjun's lives.
// 3. On failure the laugh returns, the witch rushes out of the dark at Arjun,
//    he screams, the screen shatters and is spattered with blood.
//
// Sound is scheduled on the AudioContext clock and the intro visuals read the
// same clock, so picture and sound stay in sync.

import * as THREE from 'three'
import { soundState } from './LandingScene'
import { ArjunModel } from '../three/ArjunModel'
import { gameAudio, releaseAudio } from '../game/audioUnlock'
import { DOOR_SHADER } from './hall/doorShader'
import { HALL_SHADER } from './hall/hallShader'
import { JOURNAL, PORTRAITS } from '../stage1/stage1Data'
import { HOME_WALL, type SceneSetup, type Scratch } from '../stage1/riddles'
import type { PortraitId } from '../stage1/stage1Data'
import { CLOCK_FACE_URL, overlayAtlas, scratchCell, type CellPainter } from './hall/riddleArt'
import { ROOMS, deathPlaces, type RoomDef } from './room/rooms'
import { glyphPainter } from './room/roomArt'
import type { RoomEvent, RoomOverlay, RoomSetup } from '../riddles/types'

const DOOR_PHOTO = { url: '/hall/entrance-hall.jpg', w: 1280, h: 852 }
/** The double front door in the photo (both leaves), px. */
const DOOR = { x0: 141, y0: 502, x1: 285, y1: 693 }
/** Stage 1 objects in the hall painting (px). */
const STUDY_DOOR = { x0: 603, y0: 452, x1: 645, y1: 548 }
/** The stopped wall clock: on the misty wall between the study door and Arjun (painting px). */
const CLOCK = { x: 742, y: 392, r: 21 }
/** The dark stone newel at the foot of the stair banister (painting px). */
const NEWEL = { x0: 420, y0: 583, x1: 456, y1: 616 }
/** Scratched letter heights, painting px: tiny on frames and the clock rim
 *  (only readable up close), larger on the door and the newel. */
// door and newel can't be inspected, so their letters and numbers must read from across the hall
const SCRATCH_H = { frame: 5.5, clock: 3.2, journal: 7, door: 16, banister: 15 }
/** A blink: how long the lids stay down (s), and how far the cursor must be from the frame (screen px). */
const BLINK = { dur: 0.25, far: 150, gapMin: 3, gapMax: 6 }
const JOURNAL_QUAD: Quad = [[640, 544], [694, 541], [704, 559], [634, 563]]
/** Cut-out witch (head, hands, robe to the hips) with alpha; see README credits. */
const WITCH_IMG = '/stage1/witch-reaching.webp'

const CLIPS = {
  slam: '/audio/door-slam.mp3',
  voice: '/audio/voice-welcome-back.mp3',
  laugh: '/audio/witch-laugh.mp3',
  thunder: '/audio/thunder-hit.mp3',
  scream: '/audio/arjun-scream.mp3',
  shatter: '/audio/glass-shatter.mp3',
  heartbeat: '/audio/heartbeat.mp3',
  bell: '/audio/bell-toll.mp3',
  whispers: '/audio/library-whispers.mp3',
  bookFall: '/audio/book-fall.wav',
  snuff: '/audio/candle-snuff.wav',
  }
type ClipName = keyof typeof CLIPS
/** Clips only the hall plays, and clips only the painted rooms play (each loads just its own). */
const HALL_ONLY: ClipName[] = ['voice'] // the death needs thunder and the slam everywhere
const ROOM_ONLY: ClipName[] = ['bell', 'whispers', 'bookFall', 'snuff']
/** The whispers recording is played from 0 for this long only: it grows loud and wordy after 6 s. */
const WHISPER_KEEP = 6

/** Intro timeline, seconds. */
export const HALL = {
  doorIn: 0.3,
  thunder: 0.08,
  closeStart: 0.42,
  closeEnd: 0.68,
  cutOut: 1.25,
  cut: 1.5,
  hallIn: 0.35,
  voice: 2.1,
  voiceLen: 6.6,
  laughLen: 2.5,
}
export const LAUGH_AT = HALL.voice + HALL.voiceLen
export const TITLE_AT = LAUGH_AT + HALL.laughLen + 0.25
const ENV_STEP = 0.01

/** Death sequence timeline, seconds from fail(). */
// She appears on the stairs, glides down and looms beside Arjun, claws out; he
// screams; she seizes him (a hard cut to the two of them); she drags him up off
// his feet; then her face rushes at the lens and the glass shatters.
// witchIn: she drops from above the frame; arrive: she has landed in front of
// him; he looks up at her, then screams; dark: everything goes black while he
// screams; grab: out of the black, she has him.
const DEATH = { witchIn: 0.9, arrive: 1.3, scream: 1.55, dark: 2.45, grab: 3.1, lunge: 4.05, impact: 4.35, gameOver: 5.25, exit: 9.5 }
/** How long the blackout takes to fall (s), and how long the grab takes to come out of it. */
const BLACKOUT = { fall: 0.3, rise: 0.55 }
/**
 * The witch-grip painting (1024 x 1536, AI-generated, see README) placed over
 * the hall: its witch-face point GRIP.anchor (image px) goes to GRIP.face
 * (hall painting px) at GRIP.scale hall px per image px. Measured so the man's
 * hat and shoulders sit where the 3D Arjun's are.
 */
// Where her face goes and the scale, and where the witch looms, follow
// Arjun in each room: see deathPlaces() in room/rooms.ts (the hall's measured
// values: face (735, 166) at 0.58 hall px per image px; loom (712, 205)).
const GRIP = { url: '/stage1/witch-grip.webp', size: [1024, 1536], anchor: [515, 300] }

type Quad = [[number, number], [number, number], [number, number], [number, number]]
type Uniforms = Record<string, THREE.IUniform>
type Mode = 'intro' | 'play' | 'won' | 'dying'

export type HallTarget =
  | { kind: 'portrait'; index: number }
  | { kind: 'journal' }
  | { kind: 'door' }
  | { kind: 'clock' }
  | { kind: 'object'; id: string }

export type HallEvent = 'title' | 'gameover' | 'exit'

/** One overlay drawn onto the painting (see the shader's overlay()). */
export interface Overlay {
  x: number; y: number; w: number; h: number
  angle?: number
  /** 0 scratch, 1 ink, 2 tint, 3 shade, 4 dust, 5 glow */
  mode: 0 | 1 | 2 | 3 | 4 | 5
  strength?: number
  paint: CellPainter
}

/** What a riddle in a painted room (not the hall) lays out. */
export interface RoomLayout {
  overlays: Overlay[]
  /** Lamp strengths by index into the room's lamps (missing = as painted). */
  lamps?: Record<number, number>
  /** Hands on the room's own painted clock. */
  clock?: { x: number; y: number; r: number; hour: number; minute: number }
}

/** Intro of a painted room (fade in), seconds. */
const ROOM_INTRO = { fadeIn: 1.2, sound: 0.5, title: 3.4 }

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }
`

export class HallScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, -1, 1)
  private frameId = 0
  private disposed = false
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private clips: Partial<Record<ClipName, AudioBuffer>> = {}
  private introSources: AudioBufferSourceNode[] = []
  private startAt: number | null = null
  private usesAudio = false
  private laughEnv: Float32Array | null = null
  private titleShown = false
  private doorMesh: THREE.Mesh | null = null
  private hallMesh: THREE.Mesh | null = null
  private lastFrame = performance.now()

  // Arjun (the same model as on the landing page)
  private arjun = new ArjunModel()
  private figScene = new THREE.Scene()
  private figCamera = new THREE.OrthographicCamera(0, 1, 1, 0, -4000, 4000)
  private moonRim = new THREE.DirectionalLight(0x7fe8dc, 2.6)
  private lampRim = new THREE.DirectionalLight(0xffa657, 1.5)
  private ambient = new THREE.AmbientLight(0x1f4a48, 1.1)
  private halo: THREE.Sprite | null = null
  private haloScene = new THREE.Scene()
  private figRT: THREE.WebGLRenderTarget | null = null
  /** Painting px → screen px mapping of the hall shot. */
  private map = { s: 1, ox: 0, oy: 0 }

  // ── game state (visual side; the rules live in the React component) ──
  private mode: Mode = 'intro'
  private playT = 0                 // seconds of play
  private modeT = 0                 // seconds since the current mode began
  private pointer = new THREE.Vector2(-1, -1)
  private hover: HallTarget | null = null
  private inspecting: number | null = null
  private cam = { zoom: 1.14, fx: 560, fy: 400 }
  private quads: Quad[] = PORTRAITS.map(p => p.quad.map(c => [...c]) as Quad)
  private candles = [1, 1, 1, 1, 1]
  /** Candles that were never lit this run: short, cold stubs. */
  private stubs = [false, false, false, false, false]
  private inspectingClock = false
  // blinking portraits and the glass sheen (riddle 3)
  private blinkers = new Set<number>()
  private blinkNext = [0, 0, 0, 0]
  private blinkT = [-1, -1, -1, -1]
  private glintIdx = -1
  private glintNext = 6
  private glintT = -1
  private candleTarget = [1, 1, 1, 1, 1]
  private smoke = [0, 0, 0, 0, 0]
  private wax = 1
  private redEyes = 0
  private lightDip = 0
  private fallT = -1                // the collector's portrait falling after the solve
  private wonT = -1
  private reducedMotion = false     // honour prefers-reduced-motion: no shake, a gentler witch
  private onEvent: (e: HallEvent) => void

  private door: Uniforms = {
    uTex: { value: null }, uTime: { value: 0 }, uScreen: { value: new THREE.Vector2(1, 1) },
    uImg: { value: new THREE.Vector2(DOOR_PHOTO.w, DOOR_PHOTO.h) }, uScale: { value: 1 },
    uOffset: { value: new THREE.Vector2() }, uDoor: { value: new THREE.Vector4(DOOR.x0, DOOR.y0, DOOR.x1, DOOR.y1) },
    uOpen: { value: 1 }, uFlash: { value: 0 }, uLight: { value: 1 }, uDust: { value: 0 }, uFade: { value: 1 },
  }

  private hall: Uniforms = {
    uTex: { value: null }, uTime: { value: 0 }, uScreen: { value: new THREE.Vector2(1, 1) },
    uImg: { value: new THREE.Vector2(1, 1) }, uScale: { value: 1 },
    uOffset: { value: new THREE.Vector2() }, uFlash: { value: 0 }, uLight: { value: 1 },
    uLamp: { value: 1 }, uFade: { value: 1 }, uFig: { value: null },
    uLampPos: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
    uLampCol: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
    uWin0: { value: new THREE.Vector4(1, 0, 0, 0) }, uWin1: { value: new THREE.Vector4(1, 0, 0, 0) },
    uWinSoft: { value: new THREE.Vector2(40, 40) }, uShaft: { value: new THREE.Vector3() },
    uMist: { value: new THREE.Vector4() }, uFlashE: { value: new THREE.Vector4(0, 0, 1, 1) },
    uOvTex: { value: null }, uOvA: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) },
    uOvB: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) }, uOvN: { value: 0 },
 uSwing: { value: new THREE.Vector3() }, uSwingRect: { value: new THREE.Vector4(1, 0, 0, 0) },
    uP0: { value: null }, uP1: { value: null }, uP2: { value: null }, uP3: { value: null },
    uH0: { value: new THREE.Matrix3() }, uH1: { value: new THREE.Matrix3() },
    uH2: { value: new THREE.Matrix3() }, uH3: { value: new THREE.Matrix3() },
    uEyes0: { value: new THREE.Vector4() }, uEyes1: { value: new THREE.Vector4() },
    uEyes2: { value: new THREE.Vector4() }, uEyes3: { value: new THREE.Vector4() },
    uEyeR: { value: new THREE.Vector4() }, uLookX: { value: new THREE.Vector4() }, uLookY: { value: new THREE.Vector4() },
    uHover: { value: new THREE.Vector4() }, uShow: { value: new THREE.Vector4(1, 1, 1, 1) },
    uRedEyes: { value: 0 }, uPlay: { value: 0 },
    uJTex: { value: null }, uJH: { value: new THREE.Matrix3() }, uJHover: { value: 0 }, uJShow: { value: 1 },
    uDoorRect: { value: new THREE.Vector4(STUDY_DOOR.x0, STUDY_DOOR.y0, STUDY_DOOR.x1, STUDY_DOOR.y1) },
    uDoorHover: { value: 0 }, uDoorOpen: { value: 0 }, uSymbol: { value: 0 }, uRattle: { value: 0 },
    uCandleLit: { value: [1, 1, 1, 1, 1] }, uCandleWax: { value: [1, 1, 1, 1, 1] },
    uCandleSmoke: { value: [0, 0, 0, 0, 0] }, uDoorCandle: { value: 0 },
    uBlink: { value: new THREE.Vector4() }, uGlint: { value: new THREE.Vector4() },
    uClockTex: { value: null }, uClock: { value: new THREE.Vector4(CLOCK.x, CLOCK.y, CLOCK.r, 0) },
    uClockHands: { value: new THREE.Vector2() },
    uShadow: { value: new THREE.Vector2() },
    uFocus: { value: new THREE.Vector4() }, uFocusK: { value: 0 }, uTorch: { value: new THREE.Vector4(0, 0, 150, 0) },
    uWitchTex: { value: null }, uWitch: { value: 0.1 }, uWitchA: { value: 0 },
    uWitchPos: { value: new THREE.Vector2(0.3, 0.6) }, uShatter: { value: 0 }, uBlood: { value: 0 },
    uWitchFront: { value: 0 }, uReach: { value: 0 }, uWitchForm: { value: 0 },
    uGripTex: { value: null }, uGripA: { value: 0 }, uGripC: { value: new THREE.Vector2() }, uGripS: { value: 1 },
    uImpact: { value: new THREE.Vector2(0.46, 0.55) },
  }

  /** The painted room this scene shows: the hall (Level 1), the library or the crypt. */
  private room: RoomDef
  private isHall: boolean
  /** When the stage title appears, on the intro clock. */
  private titleAt: number

  constructor(canvas: HTMLCanvasElement, onEvent: (e: HallEvent) => void, roomId: 'hall' | 'library' | 'crypt' = 'hall') {
    this.room = ROOMS[roomId]
    this.isHall = roomId === 'hall'
    this.titleAt = this.isHall ? TITLE_AT : ROOM_INTRO.title
    this.applyRoom()
    this.onEvent = onEvent
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
  }

  /** The room's painting size, lamps, windows, shafts, mist and lightning focus, into the shader. */
  private applyRoom(): void {
    const r = this.room, h = this.hall
    ;(h.uImg.value as THREE.Vector2).set(r.art.w, r.art.h)
    const pos = h.uLampPos.value as THREE.Vector4[], col = h.uLampCol.value as THREE.Vector4[]
    for (let i = 0; i < 8; i++) {
      const l = r.lamps[i]
      if (l) { pos[i].set(l.x, l.y, l.rx, l.ry); col[i].set(l.color[0], l.color[1], l.color[2], l.k) } else { pos[i].set(-9999, -9999, 1, 1); col[i].set(0, 0, 0, 0) }
    }
    this.lampK = r.lamps.map(l => l.k)
    const win = (i: number) => r.windows[i] ? new THREE.Vector4(...r.windows[i]) : new THREE.Vector4(1, 0, 0, 0)
    ;(h.uWin0.value as THREE.Vector4).copy(win(0))
    ;(h.uWin1.value as THREE.Vector4).copy(win(1))
    ;(h.uWinSoft.value as THREE.Vector2).set(...r.winSoft)
    ;(h.uShaft.value as THREE.Vector3).set(r.shafts?.[0] ?? 0, r.shafts?.[1] ?? 0, r.shafts ? 1 : 0)
    ;(h.uMist.value as THREE.Vector4).set(...r.mist)
    ;(h.uFlashE.value as THREE.Vector4).set(...r.flash)
    this.cam = { ...r.cam.introFrom }
  }
  /** Each lamp's painted strength (the stage can put lamps out). */
  private lampK: number[] = []

  /** The play and death shader variants for this room. */
  private playDefines(): Record<string, string> {
    return this.isHall ? { HALL_PLAY: '', ROOM_PLAY: '', OV_N: '8' } : { ROOM_PLAY: '', OV_N: '16' }
  }

  async start(): Promise<void> {
    const loader = new THREE.TextureLoader()
    if (!this.isHall) return this.startRoom(loader)
    const urls = [DOOR_PHOTO.url, this.room.art.url, WITCH_IMG, GRIP.url, CLOCK_FACE_URL, ...PORTRAITS.map(p => p.image)]
    // The clock face is the one optional image: if it fails, a plain enamel
    // dial stands in (the hands are drawn anyway), and the hall still starts.
    const plainDial = () => {
      const t = new THREE.DataTexture(new Uint8Array([170, 160, 132, 255]), 1, 1)
      t.needsUpdate = true
      return t
    }
    const tex = await Promise.all(urls.map(u => (u === CLOCK_FACE_URL ? loader.loadAsync(u).catch(plainDial) : loader.loadAsync(u))))
    if (this.disposed) return
    for (const t of tex) {
      t.colorSpace = THREE.NoColorSpace
      t.minFilter = THREE.LinearFilter
      t.generateMipmaps = false
    }
    const [doorTex, hallTex, witchTex, gripTex, clockTex, ...portraits] = tex
    // the clock is seen small across the hall and large up close
    clockTex.generateMipmaps = true
    clockTex.minFilter = THREE.LinearMipmapLinearFilter
    clockTex.anisotropy = 8
    this.hall.uClockTex.value = clockTex
    // the grip is seen huge during the lunge: mipmaps keep it clean when small
    gripTex.generateMipmaps = true
    gripTex.minFilter = THREE.LinearMipmapLinearFilter
    this.hall.uGripTex.value = gripTex
    // portraits are seen small and large: mipmaps keep them clean
    portraits.forEach(t => { t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 8 })
    this.door.uTex.value = doorTex
    this.hall.uTex.value = hallTex
    this.hall.uWitchTex.value = witchTex
    this.portraitTex = portraits
    this.hangWall(HOME_WALL)
    this.hall.uJTex.value = this.journalTexture()
    this.hall.uJH.value = inverseHomography(JOURNAL_QUAD)
    this.updateQuads()
    this.doorMesh = this.addQuad(this.door, DOOR_SHADER)
    this.hallMesh = this.addQuad(this.hall, HALL_SHADER)
    this.hallMats.intro = this.hallMesh.material as THREE.ShaderMaterial
    this.buildFigure()
    this.resize()
    this.loop()
    // Shaders compile off the main thread (KHR_parallel_shader_compile) while
    // the audio decodes; the intro starts once both are done. The Stage 1 and
    // death variants follow in the background during the intro.
    const ready = this.precompile()
    await this.startAudio(ready)
  }

  /** The hall shader per mode (see hallShader.ts). */
  private hallMats: { intro: THREE.ShaderMaterial | null; play: THREE.ShaderMaterial | null; death: THREE.ShaderMaterial | null } =
    { intro: null, play: null, death: null }

  private async precompile(): Promise<void> {
    const r = this.renderer
    const mk = (defines: Record<string, string>) => new THREE.ShaderMaterial({
      uniforms: this.hall, vertexShader: VERTEX, fragmentShader: HALL_SHADER, defines, depthTest: false, depthWrite: false,
    })
    const quad = new THREE.PlaneGeometry(1, 1)
    const stage = (mats: THREE.Material[]) => {
      const s = new THREE.Scene()
      mats.forEach(m => { const q = new THREE.Mesh(quad, m); q.frustumCulled = false; s.add(q) })
      return s
    }
    // what the intro draws: the door shot (the hall only), the room, and Arjun
    const intro = stage([...(this.doorMesh ? [this.doorMesh.material as THREE.Material] : []), this.hallMats.intro!])
    try {
      // Arjun is drawn into his render target (linear output), so his
      // materials must be compiled with that target bound, or three.js builds
      // different programs on the first real frame. compileAsync starts the
      // compile synchronously, so the target only needs to be bound for the call.
      r.setRenderTarget(this.ensureFigRT())
      const fig = r.compileAsync(this.figScene, this.figCamera)
      r.setRenderTarget(null)
      await Promise.all([r.compileAsync(intro, this.camera), fig, r.compileAsync(this.haloScene, this.figCamera)])
    } catch { /* compiled on first draw instead */ }
    if (this.disposed) return
    // the clock too: it is needed as soon as play begins, which SKIP can make
    // happen while the death shader is still compiling (an upload then stalls)
    await this.upload([this.door.uTex.value, this.hall.uTex.value, this.hall.uClockTex.value])
    if (this.disposed) return
    // the play and death variants, one after the other, in the background
    void (async () => {
      const play = mk(this.playDefines())
      const death = mk({ ...this.playDefines(), HALL_DEATH: '' })
      this.pendingMats = { play, death }
      try { await r.compileAsync(stage([play]), this.camera) } catch { /* first draw */ }
      if (this.disposed) return
      this.hallMats.play = play
      // the portraits and the journal page: upload now, not when play begins
      await this.upload(['uP0', 'uP1', 'uP2', 'uP3', 'uJTex'].map(k => this.hall[k].value))
      if (this.disposed) return
      try { await r.compileAsync(stage([death]), this.camera) } catch { /* first draw */ }
      if (this.disposed) return
      this.hallMats.death = death
      // the witch and her grip: upload now, not when she strikes
      await this.upload([this.hall.uWitchTex.value, this.hall.uGripTex.value])
    })()
  }

  /** Uploads textures to the GPU one per frame, so no single frame stalls. */
  private async upload(textures: unknown[]): Promise<void> {
    for (const t of textures) {
      if (this.disposed) return
      if (t instanceof THREE.Texture) this.renderer.initTexture(t)
      await new Promise(r => requestAnimationFrame(r))
    }
  }

  /** The hall material for the current mode (compiled synchronously only if the background compile hasn't finished). */
  private hallMaterial(): THREE.ShaderMaterial {
    const m = this.hallMats
    const make = (defines: Record<string, string>) => new THREE.ShaderMaterial({
      uniforms: this.hall, vertexShader: VERTEX, fragmentShader: HALL_SHADER, defines, depthTest: false, depthWrite: false,
    })
    // still compiling: use the same material (its first draw waits for the
    // compile already under way instead of starting a second one)
    const p = this.pendingMats
    if (this.mode === 'intro') return m.intro!
    if (this.mode === 'dying') return (m.death ??= p?.death ?? make({ ...this.playDefines(), HALL_DEATH: '' }))
    return (m.play ??= p?.play ?? make(this.playDefines()))
  }

  /**
   * A painted room (the library, the crypt): the painting, the witch and her
   * grip; no door shot, no portraits. The same intro precompile as the hall.
   */
  private async startRoom(loader: THREE.TextureLoader): Promise<void> {
    // the clock face too: a room's own clock gets the painted handless face, so
    // only one pair of hands shows (the riddle's)
    const [art, witchTex, gripTex, clockTex] = await Promise.all([this.room.art.url, WITCH_IMG, GRIP.url, CLOCK_FACE_URL].map(u => loader.loadAsync(u)))
    if (this.disposed) return
    for (const t of [art, witchTex, gripTex, clockTex]) { t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false }
    for (const t of [gripTex, clockTex]) { t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter }
    clockTex.anisotropy = 8
    this.hall.uClockTex.value = clockTex
    this.hall.uTex.value = art
    this.hall.uWitchTex.value = witchTex
    this.hall.uGripTex.value = gripTex
    this.hallMesh = this.addQuad(this.hall, HALL_SHADER)
    this.hallMats.intro = this.hallMesh.material as THREE.ShaderMaterial
    this.buildFigure()
    this.resize()
    this.loop()
    const ready = this.precompile()
    await this.startAudio(ready)
  }
  private pendingMats: { play: THREE.ShaderMaterial; death: THREE.ShaderMaterial } | null = null

  // ── public API used by the Stage 1 component ────────────────────────────

  /** Begin Stage 1 in the hall (also used to skip the intro). */
  startPlay(): void {
    if (this.mode !== 'intro') return
    this.introSources.forEach(s => { try { s.stop() } catch { /* already ended */ } })
    this.introSources = []
    if (this.startAt === null) this.startAt = performance.now() / 1000 - this.titleAt
    this.mode = 'play'
    this.modeT = 0
    this.titleShown = true
    this.hall.uFade.value = 0
  }

  /** The candle the player carries (see the helper at the top left of the stage). */
  setTorch(on: boolean): void {
    this.torchOn = on
  }
  private torchOn = false
  private torchK = 0

  setPointer(x: number, y: number): void {
    this.pointer.set(x, y)
  }

  /** What is under the screen point (x, y), if anything usable. */
  pick(x: number, y: number): HallTarget | null {
    if (this.mode !== 'play' || this.inspecting !== null || this.inspectingClock || this.inspectingObject) return null
    const { s, ox, oy } = this.map
    const px = (x - ox) / s, py = (y - oy) / s
    if (!this.isHall) {
      // the smallest object under the pointer wins (a diary on a table, not the table)
      const hit = this.room.objects
        .filter(o => px >= o.rect[0] && px <= o.rect[2] && py >= o.rect[1] && py <= o.rect[3])
        .sort((a, b) => (a.rect[2] - a.rect[0]) * (a.rect[3] - a.rect[1]) - (b.rect[2] - b.rect[0]) * (b.rect[3] - b.rect[1]))[0]
      return hit ? { kind: 'object', id: hit.id } : null
    }
    if (Math.hypot(px - CLOCK.x, py - CLOCK.y) < CLOCK.r * 1.2) return { kind: 'clock' }
    for (let i = 0; i < this.quads.length; i++) {
      if (this.hall.uShow.value.getComponent(i) < 0.5) continue
      const uv = applyH(inverseHomography(this.quads[i]), px, py)
      if (uv.x > -0.1 && uv.x < 1.1 && uv.y > -0.1 && uv.y < 1.1) return { kind: 'portrait', index: i }
    }
    const juv = applyH(this.hall.uJH.value as THREE.Matrix3, px, py)
    if (juv.x > -0.4 && juv.x < 1.4 && juv.y > -1 && juv.y < 2) return { kind: 'journal' }
    if (px > STUDY_DOOR.x0 - 6 && px < STUDY_DOOR.x1 + 6 && py > STUDY_DOOR.y0 - 6 && py < STUDY_DOOR.y1 + 4) return { kind: 'door' }
    return null
  }

  setHover(target: HallTarget | null): void {
    this.hover = target
  }

  /** Screen position (px, y down) just above a target, for its prompt. */
  anchor(target: HallTarget): { x: number; y: number } {
    let x: number, y: number
    if (target.kind === 'portrait') {
      const q = this.quads[target.index]
      x = (q[0][0] + q[1][0]) / 2
      y = Math.min(q[0][1], q[1][1]) - 10
    } else if (target.kind === 'journal') {
      x = 668; y = 528
    } else if (target.kind === 'clock') {
      x = CLOCK.x; y = CLOCK.y - CLOCK.r - 8
    } else if (target.kind === 'object') {
      const o = this.room.objects.find(z => z.id === target.id)
      x = o ? (o.rect[0] + o.rect[2]) / 2 : 0
      y = o ? o.rect[1] - 8 : 0
    } else {
      x = (STUDY_DOOR.x0 + STUDY_DOOR.x1) / 2; y = STUDY_DOOR.y0 - 30
    }
    const { s, ox, oy } = this.map
    return { x: ox + x * s, y: oy + y * s }
  }

  /**
   * Where a hint ring goes (screen px): on the place a letter can be cut, not
   * where the prompt sits: the bottom bar of a portrait's frame, the clock's
   * rim, the journal page, the study door, the stone post at the stairs' foot.
   */
  hintPoint(place: HallTarget | { kind: 'newel' }): { x: number; y: number } {
    let x: number, y: number
    if (place.kind === 'portrait') {
      const q = this.quads[place.index]
      // the middle of the frame's bottom bar, where scratchPlace() cuts the letter
      x = (q[2][0] + q[3][0]) / 2; y = (q[2][1] + q[3][1]) / 2 + (q[3][1] - q[0][1]) * 0.045
    } else if (place.kind === 'clock') { x = CLOCK.x; y = CLOCK.y }
    else if (place.kind === 'journal') { x = (JOURNAL_QUAD[0][0] + JOURNAL_QUAD[2][0]) / 2; y = (JOURNAL_QUAD[0][1] + JOURNAL_QUAD[2][1]) / 2 }
    else if (place.kind === 'door') { x = (STUDY_DOOR.x0 + STUDY_DOOR.x1) / 2; y = (STUDY_DOOR.y0 + STUDY_DOOR.y1) / 2 }
    else if (place.kind === 'newel') { x = (NEWEL.x0 + NEWEL.x1) / 2; y = (NEWEL.y0 + NEWEL.y1) / 2 }
    else return this.anchor(place)
    const { s, ox, oy } = this.map
    return { x: ox + x * s, y: oy + y * s }
  }

  /** Move in close to a portrait (null = step back). */
  inspect(index: number | null): void {
    this.inspecting = index
    if (index !== null) this.inspectingClock = false
  }

  /** Move in close to the wall clock (false = step back). */
  inspectClock(on: boolean): void {
    this.inspectingClock = on
    if (on) this.inspecting = null
  }

  /** Move in close to one of a painted room's objects (null = step back). */
  inspectObject(id: string | null): void {
    this.inspectingObject = id
  }
  private inspectingObject: string | null = null

  /** The room's inspectable objects (for the keyboard hotspots). */
  roomObjects(): { id: string; label: string }[] {
    return this.room.objects.map(o => ({ id: o.id, label: o.label }))
  }

  /** How far the burning candles have gone down (0..1 left). Cold stubs stay as they are. */
  setWax(waxLeft: number): void {
    this.wax = THREE.MathUtils.clamp(waxLeft, 0, 1)
  }

  /**
   * Draw this run's clues: which candles burn, the clock's time, the
   * scratched letters and which portraits blink (see stage1/riddles.ts).
   */
  setRiddle(setup: SceneSetup): void {
    setup.candles.forEach((lit, i) => {
      this.candleTarget[i] = lit ? 1 : 0
      this.candles[i] = lit ? 1 : 0
      this.stubs[i] = !lit
    })
    // the clock: hour hand moves on with the minutes, like a real movement
    const { hour, minute } = setup.clock
    const hands = this.hall.uClockHands.value as THREE.Vector2
    hands.set(((hour % 12) + minute / 60) / 12 * Math.PI * 2, (minute / 60) * Math.PI * 2)
    ;(this.hall.uClock.value as THREE.Vector4).w = 1
    // who hangs where (Who Moved? shuffles the wall), all frames straight
    this.hangWall(setup.wall)
    this.tilt = [0, 0, 0, 0]
    this.setQuadsFromSlots()
    // scratched letters, as overlays (placed on the frames as they now hang)
    this.setOverlays(setup.scratches.slice(0, 6).map(sc => {
      const p = this.scratchPlace(sc)
      return { x: p.x, y: p.y, w: p.z, h: p.z, angle: p.w, mode: 0 as const, paint: scratchCell(sc) }
    }))
    // blinking portraits and the sheen on the glass (by the slot each hangs in)
    const idx = (id: string) => this.wall.indexOf(id as PortraitId)
    this.blinkers = new Set(setup.blinkers.map(idx).filter(i => i >= 0))
    this.blinkNext = [0, 1, 2, 3].map(i => 2 + i * 0.7)
    this.blinkT = [-1, -1, -1, -1]
    this.glintIdx = setup.flicker ? idx(setup.flicker) : -1
  }

  /** Draws these overlays onto the painting (up to 16: one atlas, one shader loop). */
  setOverlays(list: Overlay[]): void {
    const ov = list.slice(0, 16)
    ;(this.hall.uOvTex.value as THREE.Texture | null)?.dispose()
    this.hall.uOvTex.value = ov.length ? overlayAtlas(ov.map(o => o.paint)) : null
    const A = this.hall.uOvA.value as THREE.Vector4[], B = this.hall.uOvB.value as THREE.Vector4[]
    ov.forEach((o, i) => { A[i].set(o.x, o.y, o.w, o.h); B[i].set(o.angle ?? 0, o.mode, o.strength ?? 1, i) })
    this.hall.uOvN.value = ov.length
  }

  /** Puts lamps out (0) or dims them, by index into the room's lamps. */
  private setLamps(k: Record<number, number>): void {
    const col = this.hall.uLampCol.value as THREE.Vector4[]
    this.lampK.forEach((base, i) => { col[i].w = base * (k[i] ?? 1) })
  }
  private restoreLamps(): void {
    this.setLamps({})
  }

  /** A painted room's clues (the library, the crypt): overlays, lamps out, the hands on its clock. */
  setRoomLayout(layout: RoomLayout): void {
    this.setOverlays(layout.overlays)
    this.setLamps(layout.lamps ?? {})
    const clock = this.hall.uClock.value as THREE.Vector4
    if (layout.clock) {
      const { x, y, r, hour, minute } = layout.clock
      clock.set(x, y, r, 1)
      ;(this.hall.uClockHands.value as THREE.Vector2).set(((hour % 12) + minute / 60) / 12 * Math.PI * 2, (minute / 60) * Math.PI * 2)
    } else clock.w = 0
  }

  // ── a painted room's riddle (riddles/*.ts) ──────────────────────────────

  private roomOv: RoomOverlay[] = []
  /** Each overlay's strength before any event, and when an event last changed it. */
  private ovBase: number[] = []
  private ovFx: ({ kind: 'ramp' | 'pulse'; t0: number } | null)[] = []
  private roomEvents: (RoomEvent & { when: number; done: boolean })[] = []
  private onCue: ((text: string) => void) | null = null
  private eventsOnAudio = false
  private swingT = -1
  private flareT = -1

  /** Lays out a room riddle's clues: its overlays, the lamps it puts out, its clock. Events wait for runEvents(). */
  setRoomRun(setup: RoomSetup): void {
    this.roomOv = setup.overlays.slice(0, 16)
    this.ovBase = this.roomOv.map(o => o.strength ?? 1)
    this.ovFx = this.roomOv.map(() => null)
    this.roomEvents = []
    this.swingT = -1
    this.flareT = -1
    this.setRoomLayout({
      overlays: this.roomOv.map(o => ({ x: o.x, y: o.y, w: o.w, h: o.h, angle: o.angle, mode: o.mode, strength: o.strength ?? 1, paint: glyphPainter(o.glyph, o.w, o.h) })),
      lamps: setup.lamps,
      clock: setup.clock,
    })
  }

  /** The clock the room's events run on: the AudioContext when sound plays, else the page clock. */
  private eventClock(now: number): number {
    return this.eventsOnAudio && this.ctx ? this.ctx.currentTime : now
  }

  /**
   * Starts a room riddle's events now: each sound is scheduled on the audio
   * clock, and its picture (the bell's swing, a flame going out, a gap on a
   * shelf) and its subtitle (onCue) follow that same clock in the frame loop.
   */
  runEvents(events: RoomEvent[], onCue: (text: string) => void): void {
    const ctx = this.ctx
    this.eventsOnAudio = !!ctx && ctx.state === 'running' && !!this.master
    const lat = this.eventsOnAudio ? (ctx!.outputLatency || ctx!.baseLatency || 0) : 0
    const now = this.eventClock(performance.now() / 1000) + 0.05
    this.onCue = onCue
    this.roomEvents = events.map(e => ({ ...e, when: now + e.at + lat, done: false }))
    if (!this.eventsOnAudio) return
    for (const e of events) {
      const at = 0.05 + e.at
      let src: AudioBufferSourceNode | null = null
 if (e.kind === 'ring') src = this.play('bell', at, 0.9, 0, true)
      else if (e.kind === 'echo') src = this.play('bell', at, 0.22, 1100, true)
      else if (e.kind === 'snuff') src = this.play('snuff', at, 0.8)
      else if (e.kind === 'fall') src = this.play('bookFall', at, 1.0, 0, true)
      else if (e.kind === 'whisper') src = this.play('whispers', at, 0.8, 0, true, undefined, WHISPER_KEEP)
 if (src) this.eventSources.push(src)
    }
  }

  /** Stops a room's pending events (the stage ended, or Arjun died). */
  private eventSources: AudioBufferSourceNode[] = []
  private stopEvents(): void {
    this.eventSources.forEach(s => { try { s.stop() } catch { /* already ended */ } })
    this.eventSources = []
    this.roomEvents = []
    this.onCue = null
  }

  /** Per frame: fire due events, animate overlay strengths, drifting letters and the bell's swing. */
  private updateRoom(now: number): void {
    if (!this.roomOv.length && !this.roomEvents.length) return
    const t = this.eventClock(now)
    for (const e of this.roomEvents) {
      if (e.done || t < e.when) continue
      e.done = true
      if (e.text) this.onCue?.(e.text)
      if (e.kind === 'ring') this.swingT = t
      if (e.kind === 'whisper') this.lightDip = Math.max(this.lightDip, 0.25)
      if (e.kind === 'flare') this.flareT = t
      for (const tag of e.targets ?? []) {
        const i = this.roomOv.findIndex(o => o.tag === tag)
        if (i >= 0) this.ovFx[i] = { kind: e.kind === 'flare' ? 'pulse' : 'ramp', t0: t }
      }
    }
    const A = this.hall.uOvA.value as THREE.Vector4[], B = this.hall.uOvB.value as THREE.Vector4[]
    this.roomOv.forEach((o, i) => {
      let k = this.ovBase[i]
      const fx = this.ovFx[i]
      if (fx) {
        const dt = t - fx.t0
        if (fx.kind === 'ramp') k = THREE.MathUtils.lerp(k, 1, THREE.MathUtils.clamp(dt / 0.25, 0, 1))
        else {
          // up in 0.3 s, held 1.6 s, down in 0.8 s
          const p = dt < 0.3 ? dt / 0.3 : dt < 1.9 ? 1 : Math.max(0, 1 - (dt - 1.9) / 0.8)
          k = THREE.MathUtils.lerp(k, 0.9, p)
        }
      }
      B[i].z = k
      if (o.drift) A[i].set(o.x + 26 * Math.sin(now * 0.31 + i * 1.7), o.y + 9 * Math.sin(now * 0.47 + i), o.w, o.h)
    })
    // a candle flares: every flame in the room leaps for a moment (one value, no waving)
    const ft = this.flareT >= 0 ? t - this.flareT : -1
    this.flareBoost = ft >= 0 && ft < 2.7 ? (ft < 0.3 ? ft / 0.3 : ft < 1.9 ? 1 : 1 - (ft - 1.9) / 0.8) * 0.35 : 0
    // the bell swings after each ring and settles
    const sw = this.hall.uSwing.value as THREE.Vector3
    if (this.room.id === 'crypt' && this.swingT >= 0) {
      const st = t - this.swingT
      sw.set(858, -70, 0.035 * Math.sin(st * Math.PI * 2 / 1.7) * Math.exp(-st * 0.7))
      ;(this.hall.uSwingRect.value as THREE.Vector4).set(745, 0, 975, 330)
    } else sw.z = 0
  }
  private flareBoost = 0

  /** Where a scratch sits in the painting: centre (px), letter cell height (px), angle. */
  private scratchPlace(sc: Scratch): THREE.Vector4 {
    const cellH = (h: number) => h / 0.62               // the letter fills 62% of its atlas cell
    if (sc.surface.startsWith('frame-')) {
      // on the bottom bar of the gilt frame, below the picture
      const i = PORTRAITS.findIndex(p => `frame-${p.id}` === sc.surface)
      const q = this.quads[i]
      const lerp = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
      const u = 0.12 + 0.76 * sc.u
      const bl = q[3], br = q[2], tl = q[0]
      const [bx, by] = lerp(bl, br, u)
      const down = (bl[1] - tl[1]) * 0.045                 // half the bottom bar's height
      return new THREE.Vector4(bx, by + down, cellH(SCRATCH_H.frame), Math.atan2(br[1] - bl[1], br[0] - bl[0]))
    }
    if (sc.surface === 'journal') {
      const q = JOURNAL_QUAD
      const u = 0.2 + 0.6 * sc.u
      const x = q[0][0] + (q[1][0] - q[0][0]) * u, y = (q[0][1] + q[3][1]) / 2
      return new THREE.Vector4(x, y, cellH(SCRATCH_H.journal), 0)
    }
    if (sc.surface === 'door') {
      const d = STUDY_DOOR
      return new THREE.Vector4(d.x0 + 8 + (d.x1 - d.x0 - 16) * sc.u, d.y0 + 30 + (d.y1 - d.y0 - 50) * sc.v, cellH(SCRATCH_H.door), 0)
    }
    if (sc.surface === 'clock') {
      // cut into the brass case on the lower half of the rim, upright so it reads
      const a = Math.PI * (0.62 + 0.76 * sc.u)
      return new THREE.Vector4(CLOCK.x + Math.sin(a) * CLOCK.r * 0.86, CLOCK.y - Math.cos(a) * CLOCK.r * 0.86, cellH(SCRATCH_H.clock), 0)
    }
    const n = NEWEL
    return new THREE.Vector4(n.x0 + (n.x1 - n.x0) * sc.u, n.y0 + (n.y1 - n.y0) * sc.v, cellH(SCRATCH_H.banister), -0.08)
  }

  // ── who hangs where ──────────────────────────────────────────────────────
  private portraitTex: THREE.Texture[] = []
  /** The portrait in each slot (SLOT_NAMES order). */
  private wall: PortraitId[] = [...HOME_WALL]
  /** Each slot's frame tilt, radians (crooked frames after Who Moved?). */
  private tilt = [0, 0, 0, 0]

  /** Who hangs in each slot right now (for the notes panel). */
  wallNow(): PortraitId[] {
    return [...this.wall]
  }

  /** Hangs the given portraits in the four slots: picture, eye positions and iris size follow the portrait. */
  private hangWall(wall: PortraitId[]): void {
    this.wall = [...wall]
    wall.forEach((id, slot) => {
      const pi = PORTRAITS.findIndex(p => p.id === id)
      const p = PORTRAITS[pi]
      const [w, h] = p.imageSize
      if (this.portraitTex[pi]) this.hall[`uP${slot}`].value = this.portraitTex[pi]
      ;(this.hall[`uEyes${slot}`].value as THREE.Vector4).set(p.eyes[0][0] / w, p.eyes[0][1] / h, p.eyes[1][0] / w, p.eyes[1][1] / h)
      ;(this.hall.uEyeR.value as THREE.Vector4).setComponent(slot, p.eyeRadius / w)
    })
  }

  /** The slot quads, each turned by its tilt about the nail at the top middle. */
  private setQuadsFromSlots(): void {
    this.quads = PORTRAITS.map((p, slot) => {
      const a = this.tilt[slot]
      const nx = (p.quad[0][0] + p.quad[1][0]) / 2, ny = (p.quad[0][1] + p.quad[1][1]) / 2 - 6
      return p.quad.map(([x, y]) => {
        const dx = x - nx, dy = y - ny
        return [nx + dx * Math.cos(a) - dy * Math.sin(a), ny + dx * Math.sin(a) + dy * Math.cos(a)]
      }) as Quad
    })
    this.updateQuads()
  }

  /**
   * Who Moved?: in the dark, two portraits swap places and are left hanging
   * crooked. Called by the UI while the screen is black.
   */
  swapInDark(after: PortraitId[], crooked: number[]): void {
    this.hangWall(after)
    this.tilt = [0, 1, 2, 3].map(s => (crooked.includes(s) ? (s % 2 ? -1 : 1) * 0.06 : 0))
    this.setQuadsFromSlots()
    this.play('slam', 0, 0.5, 420)                    // a heavy frame scraping on its nail, muffled
  }

  /** Light the wall brightly while the player memorises it (Who Moved?). */
  setMemorise(on: boolean): void {
    this.memorise = on
  }
  private memorise = false

  /**
   * The next stage, in the same hall (called while the screen is black): the
   * fallen portrait is back, the study door is shut, the clues are cleared
   * until setRiddle() lays out the next ones.
   */
  nextStage(): void {
    this.mode = 'play'
    this.modeT = 0
    this.playT = 0
    this.wonT = -1
    this.fallT = -1
    this.inspecting = null
    this.inspectingClock = false
    this.hover = null
    this.memorise = false
    this.tilt = [0, 0, 0, 0]
    this.hangWall(HOME_WALL)
    this.setQuadsFromSlots()
    ;(this.hall.uShow.value as THREE.Vector4).set(1, 1, 1, 1)
    this.hall.uDoorCandle.value = 0
    this.hall.uDoorOpen.value = 0
    this.hall.uSymbol.value = 0
    this.setOverlays([])
    this.restoreLamps()
    this.stopEvents()
    this.roomOv = []
    ;(this.hall.uSwing.value as THREE.Vector3).z = 0
    this.flareBoost = 0
    if (!this.isHall) this.hall.uClock.value.w = 0
    this.smoke = [0, 0, 0, 0, 0]
    this.blinkers = new Set()
    this.glintIdx = -1
    this.glintT = -1
  }

  /** Time is running out: one heartbeat, and the lights sag for a moment. */
  heartbeat(): void {
    if (this.mode !== 'play') return
    this.lightDip = Math.max(this.lightDip, 0.35)
    this.play('heartbeat', 0, 0.9)
  }

  /** A right answer: every light in the room blinks three times (no portrait falls). */
  solve(): void {
    this.mode = 'won'
    this.wonT = 0
    this.smoke = this.candleTarget.map(c => (c ? 1 : 0))
    this.candleTarget = [0, 0, 0, 0, 0]
    this.fallT = -1
    this.inspecting = null
    this.play('heartbeat', 0.1, 0.8)
  }

  /** The lights after a right answer: three short blackouts, 0.35 s apart, then steady. */
  private winBlink(): number {
    const t = this.wonT - 0.25
    if (t < 0 || t > 1.2) return 1
    const k = Math.floor(t / 0.4), p = t - k * 0.4
    return k < 3 && p < 0.16 ? 0.12 : 1
  }

  /** Death: laugh, the witch, the scream, shattered and bloody glass, then 'exit'. */
  fail(): void {
    if (this.mode === 'dying') return
    this.stopEvents()
    this.mode = 'dying'
    this.modeT = 0
    this.inspecting = null
    this.hover = null
    this.deathFired = { gameover: false, exit: false }
    // Every sound is scheduled from one base on the audio clock, and the
    // picture reads that same clock (deathTime), so the laugh, her drop, the
    // scream and the impact stay together even if a frame stalls.
    const ctx = this.ctx
    const running = !!ctx && ctx.state === 'running' && !!this.master
    const b = running ? ctx!.currentTime + 0.06 : undefined
    this.deathBase = b ?? null
    this.deathPerf = performance.now() / 1000
    this.play('laugh', 0, 1.2, 0, true, b)
    this.play('heartbeat', 0.15, 1.0, 0, false, b)
    // she drops in on a crack of thunder (the flash is drawn at DEATH.witchIn)
    this.play('thunder', DEATH.witchIn, 0.9, 2600, false, b)
    // Arjun screams the moment she rises up in front of him; the scream is cut
    // off when she strikes.
    this.play('scream', DEATH.scream, 1.25, 0, true, b, DEATH.impact - DEATH.scream + 0.12)
    // the grab: a heavy, muffled thud and his heart pounding
    this.play('slam', DEATH.grab, 0.75, 700, false, b)
    this.play('heartbeat', DEATH.grab + 0.1, 1.1, 0, false, b)
    this.play('heartbeat', DEATH.grab + 0.6, 1.15, 0, false, b)
    this.play('shatter', DEATH.impact - 0.02, 1.3, 0, false, b)
    this.play('slam', DEATH.impact, 0.9, 0, false, b)
  }
  /** Audio-clock time the death's sounds count from (null when sound is off). */
  private deathBase: number | null = null
  private deathPerf = 0
  private deathFired = { gameover: false, exit: false }
  /** Seconds into the death, as heard: from the audio clock, less the output latency. */
  private deathTime(): number {
    const ctx = this.ctx
    if (ctx && this.deathBase !== null && ctx.state === 'running') {
      return Math.max(0, ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0) - this.deathBase)
    }
    return performance.now() / 1000 - this.deathPerf
  }

  setMuted(muted: boolean): void {
    if (this.master) this.master.gain.value = muted ? 0 : 1
  }

  /**
   * Honour `prefers-reduced-motion`. When on, the scene drops every large,
   * physical motion: the door-slam and witch-impact screen shake, the camera
   * drift that follows the mouse, and the witch's violent lunge (she comes in
   * slower and does not rush the lens). The puzzle, its clues and every candle
   * stay exactly as readable — only the motion is calmed.
   */
  setReducedMotion(on: boolean): void {
    this.reducedMotion = on
  }

  /** Seconds into the intro (−1 before it starts). */
  time(): number {
    if (this.startAt === null) return -1
    if (this.usesAudio && this.ctx) return this.ctx.currentTime - this.startAt
    return performance.now() / 1000 - this.startAt
  }

  // ── building ─────────────────────────────────────────────────────────────

  private buildFigure(): void {
    this.figCamera.position.z = 1000
    this.arjun.root.rotation.y = Math.PI
    this.figScene.add(this.arjun.root)
    this.moonRim.position.set(-0.7, 0.8, -1)
    this.lampRim.position.set(1, 0.7, -0.35)
    const fill = new THREE.DirectionalLight(0x4a6e6c, 0.14)
    fill.position.set(0.2, -0.2, 1)
    // cold moonlight from the tall windows on the left rakes across his back,
    // so the folds of the coat catch light and shadow
    const rake = new THREE.DirectionalLight(0x6fb8b0, 0.85)
    rake.position.set(-1, 0.55, 0.45)
    this.figScene.add(rake)
    this.figScene.add(this.moonRim, this.lampRim, this.ambient, fill)
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.25, 'rgba(255,255,255,0.4)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(c), color: 0xff9a3c, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    }))
    this.halo.renderOrder = 10
    this.haloScene.add(this.halo)
  }

  /** The torn page on the pedestal, written in a hurried hand. */
  private journalTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 160
    const g = c.getContext('2d')!
    const grd = g.createLinearGradient(0, 0, 512, 160)
    grd.addColorStop(0, '#d8c9a3')
    grd.addColorStop(1, '#b49f72')
    g.fillStyle = grd
    g.fillRect(0, 0, 512, 160)
    g.fillStyle = 'rgba(60,35,15,0.85)'
    g.font = 'italic 15px Georgia, serif'
    JOURNAL.lines.slice(0, 5).forEach((line, i) => g.fillText(line.slice(0, 64), 14, 24 + i * 27))
    g.fillStyle = 'rgba(90,50,20,0.25)'
    for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 512, Math.random() * 160, 3 + Math.random() * 12, 2 + Math.random() * 8)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.NoColorSpace
    return t
  }

  private addQuad(uniforms: Uniforms, fragmentShader: string): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({ uniforms, vertexShader: VERTEX, fragmentShader, depthTest: false, depthWrite: false }),
    )
    mesh.frustumCulled = false
    mesh.visible = false
    this.scene.add(mesh)
    return mesh
  }

  private updateQuads(): void {
    this.quads.forEach((q, i) => (this.hall[`uH${i}`].value = inverseHomography(q)))
  }

  // ── audio ────────────────────────────────────────────────────────────────

  private async startAudio(ready: Promise<void>): Promise<void> {
    let compiled = false
    void ready.then(() => { compiled = true })
    const begin = (audio: boolean) => {
      if (!compiled) { void ready.then(() => begin(audio)); return }
      if (this.startAt !== null || this.disposed) return
      if (audio && this.ctx) {
        this.startAt = this.ctx.currentTime + 0.05 + (this.ctx.outputLatency || this.ctx.baseLatency || 0)
        this.usesAudio = true
      } else {
        this.startAt = performance.now() / 1000
      }
    }
    const fallback = window.setTimeout(() => begin(false), 2500)
    try {
      const ctx = gameAudio()
      this.ctx = ctx
      if (ctx.state !== 'running') await ctx.resume().catch(() => undefined)
      const comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -12
      comp.ratio.value = 3
      comp.connect(ctx.destination)
      this.master = ctx.createGain()
      this.master.gain.value = soundState.muted ? 0 : 1
      this.master.connect(comp)
      const load = async (url: string) => ctx.decodeAudioData(await (await fetch(url)).arrayBuffer())
      const names = (Object.keys(CLIPS) as ClipName[]).filter(n => !(this.isHall ? ROOM_ONLY : HALL_ONLY).includes(n))
      const buffers = await Promise.all(names.map(n => load(CLIPS[n]).catch(() => null)))
      names.forEach((n, i) => { if (buffers[i]) this.clips[n] = buffers[i]! })
      if (this.disposed) return
      if (this.clips.laugh) this.laughEnv = envelope(this.clips.laugh)
      if (this.startAt !== null || this.mode !== 'intro' || ctx.state !== 'running') return
      window.clearTimeout(fallback)
      await ready
      if (this.disposed || this.startAt !== null || this.mode !== 'intro') return
      begin(true)
      const t0 = this.startAt! - (ctx.outputLatency || ctx.baseLatency || 0)
      const at = (n: ClipName, when: number, gain: number, lp = 0, room = false) => {
        const s = this.play(n, when, gain, lp, room, t0)
        if (s) this.introSources.push(s)
      }
      if (this.room.id === 'library') {
        // the books whisper as the room fades in (no words: nothing to read)
        const s = this.play('whispers', ROOM_INTRO.sound, 0.8, 0, true, t0, WHISPER_KEEP)
        if (s) this.introSources.push(s)
      } else if (this.room.id === 'crypt') {
        at('bell', ROOM_INTRO.sound, 0.9, 0, true)    // one toll from the bell overhead
      } else {
        at('thunder', HALL.thunder, 0.45, 2200)
        at('slam', HALL.closeEnd - 0.03, 1.3)
        at('voice', HALL.voice, 1.0, 0, true)
        at('laugh', LAUGH_AT, 1.0, 0, true)
      }
    } catch {
      begin(false)
    }
  }

  /** Plays a clip `delay` s from now (or at absolute audio time base + delay). */
  private play(name: ClipName, delay: number, gain: number, lowpass = 0, room = false, base?: number, duration?: number): AudioBufferSourceNode | null {
    const ctx = this.ctx
    const buffer = this.clips[name]
    if (!ctx || !this.master || !buffer) return null
    const when = (base ?? ctx.currentTime) + delay
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const g = ctx.createGain()
    g.gain.value = gain
    if (duration) {
      g.gain.setValueAtTime(gain, when + duration - 0.25)
      g.gain.linearRampToValueAtTime(0, when + duration)
    }
    let node: AudioNode = src
    if (lowpass) {
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = lowpass
      node.connect(lp)
      node = lp
    }
    node.connect(g).connect(this.master)
    if (room) {
      const delayNode = ctx.createDelay(0.5)
      delayNode.delayTime.value = 0.11
      const fb = ctx.createGain()
      fb.gain.value = 0.3
      const tone = ctx.createBiquadFilter()
      tone.type = 'lowpass'
      tone.frequency.value = 3000
      g.connect(delayNode).connect(tone).connect(fb).connect(delayNode)
      fb.connect(this.master)
    }
    src.start(when)
    if (duration) src.stop(when + duration + 0.05)
    return src
  }

  // ── frame ────────────────────────────────────────────────────────────────

  resize(): void {
    const w = window.innerWidth, h = window.innerHeight
    this.renderer.setSize(w, h)
    this.door.uScreen.value.set(w, h)
    this.hall.uScreen.value.set(w, h)
    this.figCamera.right = w
    this.figCamera.top = h
    this.figCamera.updateProjectionMatrix()
  }

  private frame(u: Uniforms, iw: number, ih: number, zoom: number, fx: number, fy: number, jx = 0, jy = 0): void {
    const w = window.innerWidth, h = window.innerHeight
    const s = Math.max(w / iw, h / ih) * zoom
    let ox = w / 2 - fx * s + jx
    let oy = h / 2 - fy * s + jy
    ox = Math.min(0, Math.max(w - iw * s, ox))
    oy = Math.min(0, Math.max(h - ih * s, oy))
    u.uScale.value = s
    ;(u.uOffset.value as THREE.Vector2).set(ox, oy)
    this.map = { s, ox, oy }
  }

  private render(): void {
    const r = this.renderer
    if (this.hallMesh?.visible) {
      r.setRenderTarget(this.ensureFigRT())
      r.setClearColor(0x000000, 0)
      r.clear()
      r.render(this.figScene, this.figCamera)
      r.setRenderTarget(null)
    }
    r.autoClear = true
    r.setClearColor(0x000000, 1)
    r.render(this.scene, this.camera)
    if (this.hallMesh?.visible && this.mode !== 'dying') {
      r.autoClear = false
      r.render(this.haloScene, this.figCamera)
    }
  }

  /** Arjun's render target, matching the drawing buffer. */
  private ensureFigRT(): THREE.WebGLRenderTarget {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2())
    if (!this.figRT || this.figRT.width !== size.x || this.figRT.height !== size.y) {
      this.figRT?.dispose()
      this.figRT = new THREE.WebGLRenderTarget(size.x, size.y, { samples: 4 })
      this.hall.uFig.value = this.figRT.texture
    }
    return this.figRT
  }

  private loop = (): void => {
    if (this.disposed) return
    this.frameId = requestAnimationFrame(this.loop)
    const nowMs = performance.now()
    const dt = Math.min(0.05, (nowMs - this.lastFrame) / 1000)
    this.lastFrame = nowMs
    const now = nowMs / 1000
    this.door.uTime.value = now
    this.hall.uTime.value = now
    const t = this.mode === 'intro' ? this.time() : TITLE_AT + 1
    // the hall opens on the door shot; a painted room fades straight in
    const cut = this.isHall ? HALL.cut : 0
    const inDoorShot = this.isHall && this.mode === 'intro' && t < cut
    if (this.doorMesh) this.doorMesh.visible = t >= 0 && inDoorShot
    if (this.hallMesh) {
      this.hallMesh.visible = t >= cut
      if (this.hallMats.intro) this.hallMesh.material = this.hallMaterial()
    }
    if (t < 0) { this.render(); return }
    if (inDoorShot) this.updateDoorShot(t)
    else if (this.mode === 'intro') { if (this.isHall) this.updateIntroHall(t); else this.updateIntroRoom(t) }
    else this.updateGame(dt, now)
    this.render()
  }

  private updateDoorShot(t: number): void {
    const sm = THREE.MathUtils.smoothstep
    const d = this.door
    // The doors slam and the frame shakes — but not under reduced motion.
    const shake = !this.reducedMotion && t > HALL.closeEnd ? Math.exp(-(t - HALL.closeEnd) * 8) : 0
    this.frame(d, DOOR_PHOTO.w, DOOR_PHOTO.h, 1.18 + 0.04 * sm(t, 0, HALL.cut), 300, 590,
      Math.sin(t * 63) * 11 * shake, Math.cos(t * 49) * 8 * shake)
    const c = THREE.MathUtils.clamp((t - HALL.closeStart) / (HALL.closeEnd - HALL.closeStart), 0, 1)
    d.uOpen.value = 1 - c * c * c
    const ft = t - HALL.thunder
    d.uFlash.value = ft > 0 && ft < 0.6 ? (ft < 0.06 ? 1 : ft < 0.12 ? 0.25 : 0.7 * Math.exp(-(ft - 0.12) * 7)) : 0
    d.uLight.value = t > HALL.closeEnd ? 1 - 0.4 * shake : 1
    d.uDust.value = t > HALL.closeEnd ? 1 : 0
    // Dim the door only partway (to ~0.6) by the cut, not to full black, so the
    // swap to the hall is a cross-dissolve and the composite is never pure black.
    d.uFade.value = Math.max(1 - sm(t, 0, HALL.doorIn), 0.6 * sm(t, HALL.cutOut, HALL.cut))
  }

  private updateIntroHall(t: number): void {
    const sm = THREE.MathUtils.smoothstep
    const h = this.hall
    const ht = t - HALL.cut
    const push = sm(ht, 0, 14)
    this.cam = { zoom: 1.04 + 0.1 * push, fx: THREE.MathUtils.lerp(640, 560, push), fy: THREE.MathUtils.lerp(380, 400, push) }
    this.frame(h, this.room.art.w, this.room.art.h, this.cam.zoom, this.cam.fx, this.cam.fy)
    h.uFade.value = 1 - sm(ht, 0, HALL.hallIn)
    const { light, flash } = this.laughLight(t - LAUGH_AT)
    let f = flash
    const vt = t - (HALL.voice + 0.3)
    if (vt > 0 && vt < 0.7) f = Math.max(f, vt < 0.05 ? 0.7 : 0.45 * Math.exp(-(vt - 0.05) * 7))
    h.uLight.value = light
    h.uFlash.value = f
    h.uLamp.value = 1 - 0.35 * sm(t, HALL.voice + 4.2, HALL.voice + 5.2) * (1 - sm(t, LAUGH_AT + 2.6, LAUGH_AT + 3.6))
    const look = sm(t, HALL.voice + 0.3, HALL.voice + 2.4)
    const lt = t - LAUGH_AT
    const flinch = lt > 0 ? Math.exp(-lt * 3) * Math.sin(Math.min(lt * 9, Math.PI)) : 0
    // as the voice speaks he turns to face the broken staircase and stays so
    this.updateFigure(t, -0.6 * look + 0.08 * flinch, flinch, light, f)
    this.arjun.root.visible = ht >= 0
    if (this.halo) this.halo.visible = ht >= 0
    if (t >= TITLE_AT && !this.titleShown) {
      this.titleShown = true
      this.onEvent('title')
    }
  }

  /**
   * A painted room's intro: it fades in from black while the camera settles
   * from introFrom to the play framing; the room's sound (whispers, or the
   * bell's toll) starts at ROOM_INTRO.sound, and the title follows.
   */
  private updateIntroRoom(t: number): void {
    const sm = THREE.MathUtils.smoothstep
    const L = THREE.MathUtils.lerp
    const h = this.hall
    const { introFrom: a, play: b } = this.room.cam
    const k = sm(t, 0, ROOM_INTRO.title + 1)
    this.cam = { zoom: L(a.zoom, b.zoom, k), fx: L(a.fx, b.fx, k), fy: L(a.fy, b.fy, k) }
    this.frame(h, this.room.art.w, this.room.art.h, this.cam.zoom, this.cam.fx, this.cam.fy)
    h.uFade.value = 1 - sm(t, 0, ROOM_INTRO.fadeIn)
    // the bell's strike shivers every flame at once (one value, no waving)
    const bt = t - ROOM_INTRO.sound
    const toll = this.room.id === 'crypt' && bt > 0 ? Math.exp(-bt * 2.5) : 0
    h.uLight.value = 1
    h.uFlash.value = 0
    h.uLamp.value = 1 - 0.3 * toll
    // he startles at the sound, then looks up toward it
    const flinch = bt > 0 ? Math.exp(-bt * 3) * Math.sin(Math.min(bt * 9, Math.PI)) : 0
    const look = sm(t, ROOM_INTRO.sound + 0.3, ROOM_INTRO.sound + 2.2)
    this.updateFigure(t, -0.35 * look + 0.08 * flinch, flinch, 1, 0)
    this.arjun.root.visible = true
    if (this.halo) this.halo.visible = true
    if (t >= ROOM_INTRO.title && !this.titleShown) {
      this.titleShown = true
      this.onEvent('title')
    }
  }

  /** Lights following the laugh recording (lt = seconds into the laugh). */
  private laughLight(lt: number): { light: number; flash: number } {
    if (lt < 0 || lt >= HALL.laughLen + 0.3) return { light: 1, flash: 0 }
    const env = this.laughEnv
    const i = Math.floor(lt / ENV_STEP)
    const level = env && i < env.length ? env[i] : Math.max(0, Math.sin(lt * 15)) * (lt < HALL.laughLen ? 1 : 0)
    let light = 0.35 + 0.75 * Math.pow(level, 1.3)
    const flash = level > 0.8 ? (level - 0.8) * 4 : 0
    if (lt > HALL.laughLen) light = THREE.MathUtils.lerp(0.35, 1, THREE.MathUtils.smoothstep(lt, HALL.laughLen, HALL.laughLen + 0.3))
    return { light, flash }
  }

  /** Stage 1 play, the win and the death. */
  private updateGame(dt: number, now: number): void {
    const sm = THREE.MathUtils.smoothstep
    const h = this.hall
    const u = (name: string) => h[name].value
    this.modeT += dt
    // the death follows the clock its sounds were scheduled on
    if (this.mode === 'dying') this.modeT = this.deathTime()
    if (this.mode === 'play') this.playT += dt
    h.uPlay.value = Math.min(1, (u('uPlay') as number) + dt * 1.5)
    h.uFade.value = 0
    const w = window.innerWidth, hh = window.innerHeight
    const k = 1 - Math.exp(-dt * 4)

    // Camera: the whole room, drifting a little with the mouse; close in on
    // what is inspected; a jolt when the witch hits.
    let target = { ...this.room.cam.play }
    if (this.pointer.x >= 0 && !this.reducedMotion && this.mode === 'play') {
      target.fx += ((this.pointer.x / w) - 0.5) * 50
      target.fy += ((this.pointer.y / hh) - 0.5) * 24
    }
    if (this.mode === 'dying') {
      // A still, wide frame: the whole hall height, Arjun on the right and the
      // witch over him. Only a slight push-in on the final strike.
      const lungeK = sm(this.modeT, DEATH.lunge, DEATH.impact)
      target = {
        // never below 1.0: the painting must always cover the screen
        zoom: 1.0 + 0.08 * lungeK,
        fx: this.room.cam.dying.fx,
        fy: this.room.cam.dying.fy,
      }
    }
    let focus = 0
    if (this.inspectingObject) {
      // a room object up close: it fills about 60% of the screen height, on the right (notes on the left)
      const o = this.room.objects.find(x => x.id === this.inspectingObject)
      if (o) {
        const [x0, y0, x1, y1] = o.rect
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
        const s0 = Math.max(w / this.room.art.w, hh / this.room.art.h)
        const zoom = Math.max(1, Math.min(6, Math.min((0.62 * hh) / ((y1 - y0) * s0), (0.5 * w) / ((x1 - x0) * s0))))
        target = { zoom, fx: cx - 0.17 * (w / (zoom * s0)), fy: cy }
        focus = 1
        ;(h.uFocus.value as THREE.Vector4).set(cx, cy, (x1 - x0) / 2 + 8, (y1 - y0) / 2 + 8)
      }
    }
    if (this.inspecting !== null) {
      const q = this.quads[this.inspecting]
      const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4
      const cy = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4
      const ph = (q[3][1] - q[0][1] + q[2][1] - q[1][1]) / 2
      const s0 = Math.max(w / this.room.art.w, hh / this.room.art.h)
      // leave room on the left of the screen for the notes panel
      target = { zoom: (0.72 * hh) / (ph * 1.2 * s0), fx: cx - 0.17 * (w / ((0.72 * hh) / (ph * 1.2))), fy: cy }
      focus = 1
      ;(h.uFocus.value as THREE.Vector4).set(cx, cy, 52, 58)
    } else if (this.inspectingClock) {
      // the clock fills the right of the screen; the notes panel sits on the left
      const ph = CLOCK.r * 2 * 1.5
      const s0 = Math.max(w / this.room.art.w, hh / this.room.art.h)
      const zoom = (0.6 * hh) / (ph * s0)
      target = { zoom, fx: CLOCK.x - 0.17 * (w / (zoom * s0)), fy: CLOCK.y }
      focus = 1
      ;(h.uFocus.value as THREE.Vector4).set(CLOCK.x, CLOCK.y, CLOCK.r * 1.2, CLOCK.r * 1.2)
    }
    this.cam.zoom += (target.zoom - this.cam.zoom) * k
    this.cam.fx += (target.fx - this.cam.fx) * k
    this.cam.fy += (target.fy - this.cam.fy) * k
    h.uFocusK.value += (focus - (h.uFocusK.value as number)) * k
    let jx = 0, jy = 0
    if (!this.reducedMotion && this.mode === 'dying' && this.modeT > DEATH.grab) {
      // a hard jolt when she seizes him, a bigger one when the glass breaks
      const grabShake = 0                              // no shake at the grab: a still, heavy moment
      const hitShake = this.modeT > DEATH.impact ? Math.exp(-(this.modeT - DEATH.impact) * 5) : 0
      const shake = Math.max(grabShake, hitShake)
      jx = Math.sin(this.modeT * 70) * 22 * shake
      jy = Math.cos(this.modeT * 53) * 16 * shake
    }
    this.frame(h, this.room.art.w, this.room.art.h, this.cam.zoom, this.cam.fx, this.cam.fy, jx, jy)

    // Eyes: every portrait looks at the cursor (or at Arjun when idle).
    const { s, ox, oy } = this.map
    const lookPx = this.pointer.x >= 0 ? new THREE.Vector2((this.pointer.x - ox) / s, (this.pointer.y - oy) / s) : new THREE.Vector2(this.room.arjun.x, this.room.arjun.shoulderY - 66)
    const lx = u('uLookX') as THREE.Vector4, ly = u('uLookY') as THREE.Vector4
    this.wall.forEach((id, i) => {
      const p = PORTRAITS.find(x => x.id === id)!
      const q = this.quads[i]
      const cx = (q[0][0] + q[1][0]) / 2, cy = (q[0][1] + q[3][1]) / 2
      const dir = new THREE.Vector2(lookPx.x - cx, lookPx.y - cy)
      const len = dir.length()
      dir.multiplyScalar(len > 1 ? Math.min(1, len / 120) / len : 0)
      const r = p.eyeRadius / p.imageSize[0]
      lx.setComponent(i, -dir.x * r * 0.42)
      ly.setComponent(i, -dir.y * r * 0.36)
    })
    const hv = u('uHover') as THREE.Vector4
    for (let i = 0; i < 4; i++) {
      const on = this.hover?.kind === 'portrait' && this.hover.index === i ? 1 : 0
      hv.setComponent(i, hv.getComponent(i) + (on * 0.35 - hv.getComponent(i)) * k)
    }
    h.uJHover.value += ((this.hover?.kind === 'journal' ? 1 : 0) - (h.uJHover.value as number)) * k
    h.uDoorHover.value += ((this.hover?.kind === 'door' ? 1 : 0) - (h.uDoorHover.value as number)) * k

    // Candles: snuff out quickly, relight slowly; smoke fades. Cold stubs are
    // short and never lit, so the burning ones can be counted.
    const lit = u('uCandleLit') as number[], wax = u('uCandleWax') as number[], smk = u('uCandleSmoke') as number[]
    for (let i = 0; i < 5; i++) {
      const tgt = this.candleTarget[i]
      this.candles[i] += (tgt - this.candles[i]) * (1 - Math.exp(-dt * (tgt < this.candles[i] ? 9 : 2)))
      this.smoke[i] = Math.max(0, this.smoke[i] - dt * 0.4)
      // one steady flicker value per flame (no moving spatial noise)
      lit[i] = this.candles[i] * (0.9 + 0.1 * Math.sin(now * (9 + i) + i * 2))
      wax[i] = this.stubs[i] ? 0.22 + 0.05 * (i % 2) : this.wax * (0.97 + 0.03 * ((i * 7) % 3))
      smk[i] = this.smoke[i]
    }

    // Blinks: a blinker's lids come down every few seconds, but only while the
    // cursor is far from its frame and nobody is studying it up close.
    const blink = u('uBlink') as THREE.Vector4
    for (let i = 0; i < 4; i++) {
      let lid = 0
      if (this.blinkers.has(i) && this.mode === 'play') {
        if (this.blinkT[i] >= 0) {
          this.blinkT[i] += dt
          const k = this.blinkT[i] / BLINK.dur
          lid = k < 1 ? Math.sin(k * Math.PI) : 0
          if (k >= 1) this.blinkT[i] = -1
        } else if (this.playT >= this.blinkNext[i] && this.inspecting === null && !this.inspectingClock && this.cursorFar(i)) {
          this.blinkT[i] = 0
          this.blinkNext[i] = this.playT + BLINK.gapMin + Math.random() * (BLINK.gapMax - BLINK.gapMin)
        }
      }
      blink.setComponent(i, Math.min(1, lid * 1.15))
    }
    // The red herring: now and then candlelight slides across one portrait's glass.
    const glint = u('uGlint') as THREE.Vector4
    glint.set(0, 0, 0, 0)
    if (this.glintIdx >= 0 && this.mode === 'play') {
      if (this.glintT >= 0) {
        this.glintT += dt
        if (this.glintT > 0.9) { this.glintT = -1; this.glintNext = this.playT + 4 + Math.random() * 4 }
        else glint.setComponent(this.glintIdx, this.glintT / 0.9)
      } else if (this.playT >= this.glintNext) this.glintT = 0
    }

    // the carried candle: follows the pointer in painting px, fades in and out, flickers as one value
    {
      const T = h.uTorch.value as THREE.Vector4
      this.torchK += ((this.torchOn && this.mode === 'play' ? 1 : 0) - this.torchK) * Math.min(1, dt * 8)
      const { s, ox, oy } = this.map
      T.set((this.pointer.x - ox) / s, (this.pointer.y - oy) / s - 18 / s, 165 / s, this.torchK * (0.93 + 0.07 * Math.sin(now * 9.3) * Math.sin(now * 3.1)))
    }

    // a painted room's timed events, overlays and the bell
 if (!this.isHall && this.mode === 'play') this.updateRoom(now)

 // Red eyes and the dip in the lights after a wrong answer.
    this.redEyes = Math.max(0, this.redEyes - dt * 0.55)
    this.lightDip = Math.max(0, this.lightDip - dt * 0.8)
    h.uRedEyes.value = this.redEyes > 0 ? Math.min(1, this.redEyes * 1.5) * (0.7 + 0.3 * Math.sin(now * 20)) : 0

    let light = 1 - 0.45 * this.lightDip * (0.6 + 0.4 * Math.sin(now * 31))
    let flash = 0
    // Who Moved?: the wall is lit evenly while the player memorises it
    if (this.memorise) { light = 1; flash = 0.12 }

    // Scripted scares while you play (they never block the puzzle).
    if (this.mode === 'play') {
      const st = this.playT - 22
      const sh = u('uShadow') as THREE.Vector2
      sh.set(300 + 150 * sm(st, 0, 2.8), st > 0 && st < 2.8 ? Math.sin((st / 2.8) * Math.PI) : 0)
      const rt = this.playT - 50
      h.uRattle.value = rt > 0 && rt < 1.2 ? 1 - rt / 1.2 : 0
      if (rt > 0 && rt < dt * 1.5) this.play('slam', 0, 0.35, 900)
      const lt = this.playT - 95
      // A light flicker at 95 s. Under reduced motion the strobe is replaced by
      // a single gentle dip, so the hall never flashes.
      if (lt > 0 && lt < 0.6) {
        light *= this.reducedMotion
          ? 1 - 0.3 * Math.sin((lt / 0.6) * Math.PI)
          : 0.4 + 0.6 * Math.abs(Math.sin(lt * 40))
      }
    } else {
      ;(u('uShadow') as THREE.Vector2).set(0, 0)
      h.uRattle.value = 0
    }

    // The win: the collector's portrait drops off the bookcase; the study
    // door swings open on THE EYE; a candle lights beside it.
    if (this.mode === 'won') {
      this.wonT += dt
      if (this.fallT >= 0) {
        this.fallT += dt
        const f = Math.min(1, this.fallT / 0.75)
        const drop = f * f * 120
        const tilt = f * 0.5
        const base = PORTRAITS[0].quad
        const cx = (base[0][0] + base[1][0]) / 2, cy = (base[0][1] + base[3][1]) / 2
        this.quads[0] = base.map(([x, y]) => {
          const dx = x - cx, dy = y - cy
          return [cx + dx * Math.cos(tilt) - dy * Math.sin(tilt), cy + drop + dx * Math.sin(tilt) + dy * Math.cos(tilt)]
        }) as Quad
        if (f >= 1 && this.fallT - dt < 0.75) this.play('slam', 0, 0.8, 1400)
        ;(u('uShow') as THREE.Vector4).setComponent(0, this.fallT > 1.0 ? Math.max(0, 1 - (this.fallT - 1.0) * 2) : 1)
        this.updateQuads()
      }
      light = this.winBlink()
    }

    // The death.
    let witchA = 0
    if (this.mode === 'dying') {
      const tt = this.modeT
      const ll = this.laughLight(tt)
      light = Math.min(light, ll.light)
      flash = ll.flash
      // She appears at the top of the broken stairs, glides down and rises up
      // in front of Arjun (beyond him, so he stands between her and us), lifts
      // her clawed hands while he screams, then lunges through him at the
      // screen. Under reduced motion the lunge is tamed and she doesn't bob.
      const toUv = (x: number, y: number) => {
        const m = this.map
        return new THREE.Vector2((m.ox + x * m.s) / w, 1 - (m.oy + y * m.s) / hh)
      }
      // The lights die with the laugh. Then, suddenly, she drops out of the
      // dark above, straight down in front of him: fast, decelerating hard,
      // a small sink past the stop and a settle, as if caught on the air.
      // After that she hangs there, breathing, and reaches for him.
      const places = deathPlaces(this.room)
      const { loom, dropFrom } = places
      const k = THREE.MathUtils.clamp((tt - DEATH.witchIn) / (DEATH.arrive - DEATH.witchIn), 0, 1)
      const fall = 1 - Math.pow(1 - k, 3)                              // fast in, hard stop
      const settle = tt > DEATH.arrive ? Math.exp(-(tt - DEATH.arrive) * 6) * Math.sin((tt - DEATH.arrive) * 11) * 10 : 0
      const hover = tt > DEATH.arrive ? Math.sin((tt - DEATH.arrive) * 2.2) * (this.reducedMotion ? 0 : 3) : 0
      const px = loom.x
      const py = THREE.MathUtils.lerp(dropFrom, loom.y, fall) + (this.reducedMotion ? 0 : settle) + hover
      // she leans in a little as she reaches
      const size = loom.size * (1 + 0.05 * sm(tt, DEATH.arrive, DEATH.grab))
      const pos = toUv(px, py)
      ;(u('uWitchPos') as THREE.Vector2).set(pos.x, pos.y)
      h.uWitch.value = size
      // solid as she falls (only the smoke below her hips trails)
      const form = sm(tt, DEATH.witchIn, DEATH.witchIn + 0.2)
      h.uWitchForm.value = form
      h.uReach.value = sm(tt, DEATH.arrive + 0.2, DEATH.grab)
      // the drop is lit by one crack of lightning
      const dt0 = tt - DEATH.witchIn
      if (dt0 > 0 && dt0 < 0.5) flash = Math.max(flash, dt0 < 0.05 ? 0.9 : 0.55 * Math.exp(-(dt0 - 0.05) * 8))
      h.uWitchFront.value = 0
      // the reaching witch is replaced, in one cut, by her seizing him
      witchA = tt >= DEATH.witchIn && tt < DEATH.grab ? 1 : 0
      // the lamps sink to almost nothing as she forms
      light = Math.min(light, 1 - 0.55 * form)

      // ── The grab: she has him by the shoulder and throat. The 3D Arjun is
      // swapped for the painted pair, aligned on his hat and shoulders.
      // she keeps hold of him after the strike: the two of them stay frozen
      // behind the cracked, bloody glass until GAME OVER fades out
      const grabbed = tt >= DEATH.grab
      const held = sm(tt, DEATH.grab, DEATH.lunge)
      const lunge = sm(tt, DEATH.lunge, DEATH.impact)
      // one steady, heavy movement: she lifts him and draws him in (no jitter)
      const lift = 18 * held
      let gs = places.gripScale * (1 + 0.06 * held)
      const gc = new THREE.Vector2(places.gripFace[0], places.gripFace[1] - lift * (this.room.arjun.unit / 680))
      // the lunge: her face rushes at the lens
      const m = this.map
      const lensX = (w * 0.5 - m.ox) / m.s, lensY = (hh * 0.42 - m.oy) / m.s
      gc.lerp(new THREE.Vector2(lensX, lensY), lunge * 0.35)
      // she strikes toward the lens, but stays a picture of the two of them
      // (no giant close-up)
      gs *= 1 + Math.pow(lunge, 2) * (this.reducedMotion ? 0.1 : 0.3)
      ;(u('uGripC') as THREE.Vector2).copy(gc)
      h.uGripS.value = gs
      h.uGripA.value = grabbed ? 1 : 0
      if (grabbed && !this.grabbed) {
        this.grabbed = true
        this.lightDip = 1                              // the lights jump as she strikes
      }
      // one flash of lightning lights the moment she seizes him
      const gt = tt - DEATH.grab
      if (gt > 0 && gt < 0.35) flash = Math.max(flash, gt < 0.05 ? 0.8 : 0.5 * Math.exp(-(gt - 0.05) * 9))
      h.uShatter.value = tt >= DEATH.impact ? 1 : 0
      h.uBlood.value = sm(tt, DEATH.impact, DEATH.impact + 2.8)
      if (tt >= DEATH.impact) light = 0.55
      // the blackout between his scream and her grip, then the fade at the end
      const blackout = sm(tt, DEATH.dark, DEATH.dark + BLACKOUT.fall) * (1 - sm(tt, DEATH.grab, DEATH.grab + BLACKOUT.rise))
      h.uFade.value = Math.max(blackout, sm(tt, DEATH.exit - 1.2, DEATH.exit))
      if (tt >= DEATH.gameOver && !this.deathFired.gameover) { this.deathFired.gameover = true; this.onEvent('gameover') }
      if (tt >= DEATH.exit && !this.deathFired.exit) { this.deathFired.exit = true; this.onEvent('exit') }
    }
    h.uWitchA.value = witchA
    h.uLight.value = light
    h.uFlash.value = flash
    h.uLamp.value = (this.mode === 'won' ? this.winBlink() : 1) + this.flareBoost

    // Arjun: turns toward what you look at; flinches when the witch comes.
    let turn = 0
    const tgt = this.inspecting !== null ? { kind: 'portrait' as const, index: this.inspecting } : this.hover
    if (tgt?.kind === 'portrait') turn = 0.2
    else if (tgt?.kind === 'door' || tgt?.kind === 'journal') turn = -0.22
    if (this.mode === 'won') turn = -0.22
    let flinch = 0
    let fear = 0
    let lookUp = 0
    if (this.mode === 'dying') {
      // he follows her down the stairs, then she is in front of him: he
      // recoils, throws his arms up and screams
      // the laugh makes him glance round; when she drops he turns to her and
      // looks up (leans back), then recoils, arms up, and screams
      turn = -0.12 * sm(this.modeT, 0.2, 0.8) - 0.22 * sm(this.modeT, DEATH.witchIn + 0.1, DEATH.arrive + 0.1)
      lookUp = sm(this.modeT, DEATH.witchIn + 0.15, DEATH.arrive + 0.15)
      fear = sm(this.modeT, DEATH.arrive, DEATH.scream + 0.1) * (1 - sm(this.modeT, DEATH.impact, DEATH.impact + 0.15))
      flinch = Math.max(fear, sm(this.modeT, DEATH.lunge, DEATH.impact))
    }
    this.armTurn += (turn - this.armTurn) * (1 - Math.exp(-dt * (this.mode === 'dying' ? 6 : 3)))
    this.updateFigure(now, this.armTurn, flinch, light, flash, fear, lookUp)
    // Hidden once she has him (the grip painting shows him) and while you
    // study a portrait up close.
    this.arjun.root.visible = !(this.mode === 'dying' && this.modeT >= DEATH.grab) && (h.uFocusK.value as number) < 0.35
    if (this.halo) this.halo.visible = this.arjun.root.visible
  }

  /** True when the cursor is more than BLINK.far screen px from portrait i's frame (or there is no cursor). */
  private cursorFar(i: number): boolean {
    if (this.pointer.x < 0) return true
    const { s, ox, oy } = this.map
    const q = this.quads[i]
    const xs = q.map(c => ox + c[0] * s), ys = q.map(c => oy + c[1] * s)
    const dx = Math.max(Math.min(...xs) - this.pointer.x, 0, this.pointer.x - Math.max(...xs))
    const dy = Math.max(Math.min(...ys) - this.pointer.y, 0, this.pointer.y - Math.max(...ys))
    return Math.hypot(dx, dy) > BLINK.far
  }

  private armTurn = 0
  private grabbed = false
  /** The wrong-answer laugh, so a death can cut it cleanly instead of doubling up. */

  private updateFigure(t: number, turn: number, flinch: number, light: number, flash: number, fear = 0, lookUp = 0): void {
    const { s, ox, oy } = this.map
    const h = window.innerHeight
    const unit = this.room.arjun.unit * s
    const a = this.arjun
    a.root.position.set(ox + this.room.arjun.x * s, h - (oy + this.room.arjun.shoulderY * s) - 0.69 * unit, 0)
    a.root.scale.setScalar(unit)
    a.lanternLight.distance = unit * 0.9
    // terror: he trembles, leans back away from her and shrinks down
    // fear is a smooth recoil, not a tremble
    const tremble = 0
    a.inner.rotation.y = turn + tremble
    // leaning back = his face tips up toward her
    a.inner.rotation.x = 0.02 - 0.06 * flinch - 0.1 * fear - 0.1 * lookUp
    a.inner.rotation.z = tremble * 0.6
    a.inner.position.y = Math.sin(t * 1.5) * 0.0025 - 0.008 * flinch - 0.012 * fear
    a.inner.position.z = -0.05 * fear                    // a stumble back toward us
    a.updateGait(0, 0, 1 / 60)
    if (fear > 0 && a.arms.length === 2) {
      // both arms thrown up in front of his face, the lantern shaking
      const [right, left] = a.arms
      left.shoulder.rotation.x = -1.55 * fear
      left.shoulder.rotation.z = 0.25 * fear
      left.elbow.rotation.x = -0.9 * fear
      right.shoulder.rotation.x = -1.05 * fear + tremble * 4
      right.shoulder.rotation.z = -0.2 * fear
      right.elbow.rotation.x = -0.45 * fear
      if (a.lantern) a.lantern.rotation.x = 0.5 * fear
    }
    // The warm lamp is far away up on the balcony: only a faint warm edge.
    this.moonRim.intensity = 3.0 * (0.55 + 0.45 * light) + flash * 8
    this.lampRim.intensity = 0.55 * light
    this.ambient.intensity = 0.34 * (0.5 + 0.5 * light) + flash * 1.2
    const flame = 0.95 + 0.03 * Math.sin(t * 5.1) + 0.02 * Math.sin(t * 11.7)
    a.lanternLight.intensity = 4 * flame * (0.6 + 0.4 * light)
    if (a.lanternGlass) (a.lanternGlass.material as THREE.MeshBasicMaterial).color.setRGB(1, 0.72 * flame + 0.1, 0.38 * flame)
    if (this.halo && a.lanternGlass) {
      const p = new THREE.Vector3()
      a.lanternGlass.getWorldPosition(p)
      this.halo.position.set(p.x, p.y, 500)
      const r = unit * 0.34 * flame
      this.halo.scale.set(r, r, 1)
    }
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.frameId)
    releaseAudio(this.ctx, this.master ? [this.master] : [])
    this.scene.traverse(o => {
      const m = o as THREE.Mesh
      m.geometry?.dispose()
      ;(m.material as THREE.Material | undefined)?.dispose?.()
    })
    new Set([...Object.values(this.hallMats), ...Object.values(this.pendingMats ?? {})]).forEach(m => m?.dispose())
    for (const key of ['uTex', 'uWitchTex', 'uGripTex', 'uJTex', 'uP0', 'uP1', 'uP2', 'uP3', 'uClockTex', 'uOvTex']) (this.hall[key].value as THREE.Texture | null)?.dispose()
    ;(this.door.uTex.value as THREE.Texture | null)?.dispose()
    this.figRT?.dispose()
    this.renderer.dispose()
  }
}

/** Matrix mapping painting px → picture uv for a quad with corners TL, TR, BR, BL. */
function inverseHomography(q: Quad): THREE.Matrix3 {
  // Square → quad (Heckbert), then invert.
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3
  const den = dx1 * dy2 - dx2 * dy1
  const g = (dx3 * dy2 - dx2 * dy3) / den
  const h = (dx1 * dy3 - dx3 * dy1) / den
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = x0
  const d = y1 - y0 + g * y1, e = y3 - y0 + h * y3, f = y0
  const m = new THREE.Matrix3().set(a, b, c, d, e, f, g, h, 1)
  return m.invert()
}

function applyH(m: THREE.Matrix3, x: number, y: number): THREE.Vector2 {
  const v = new THREE.Vector3(x, y, 1).applyMatrix3(m)
  return new THREE.Vector2(v.x / v.z, v.y / v.z)
}

/** RMS loudness per 10 ms, top 18 dB mapped to 0..1. */
function envelope(buffer: AudioBuffer): Float32Array {
  const step = Math.round(buffer.sampleRate * ENV_STEP)
  const n = Math.ceil(buffer.length / step)
  const db = new Float32Array(n)
  const ch = buffer.getChannelData(0)
  let top = -120
  for (let k = 0; k < n; k++) {
    let s = 0
    const end = Math.min(buffer.length, (k + 1) * step)
    for (let i = k * step; i < end; i++) s += ch[i] * ch[i]
    db[k] = 10 * Math.log10(s / Math.max(1, end - k * step) + 1e-12)
    top = Math.max(top, db[k])
  }
  return db.map(v => THREE.MathUtils.clamp((v - (top - 18)) / 18, 0, 1))
}
