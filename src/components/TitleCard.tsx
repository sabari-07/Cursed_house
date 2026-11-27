import { useEffect, useRef, useState } from 'react'
import { soundState } from '../scenes/LandingScene'
import { TitleSky } from './TitleSky'
import { gameAudio, onActivation, releaseAudio, unlockAudio } from '../game/audioUnlock'

/**
 * The title card's background. The owner's painting replaces it when it
 * arrives (one constant). Shown as painted: no filter, no zoom, only a light vignette.
 */
export const TITLE_BG = '/landing/title-graveyard.webp'

/** Plain and clear: what the game is, in three words. */
const TITLE = 'THE CURSED HOUSE'
/** How long the card stays (s): the title types itself, the about lines follow, then it fades. */
export const CARD_S = 10 // the fade starts at 9.2 s and plays for 0.8 s
const FIRST_KEY = 0.35, KEY_GAP = 0.22
const SUB_AT = FIRST_KEY + TITLE.length * KEY_GAP + 0.3    // ≈ 4.6 s
const FADE_AT = 9.2
/** The fade always plays in full, even if the page was frozen when it was due (s). */
const FADE_S = 0.8
/** One typewriter strike, played once per letter (pitch varied a little); spaces are silent. */
const KEYS = ['/audio/type-key-a.wav']
/** Under the typing: a slow heartbeat; on the last letter, a deep hit (both already in the game, credited). */
const HEARTBEAT = '/audio/heartbeat.mp3', THUNDER = '/audio/thunder-hit.mp3'
/**
 * The painting's hand, cut out of it (the soil it stood in was filled with
 * mist): while the title types, it pushes slowly up out of the grave and is
 * fully out just after the thunder. Painting px: the sprite's box, and the
 * soil line it comes out of. The dirt sound plays from HAND_AT for RISE_S; the
 * hand rises as that recording's dirt moves (its smoothed loudness builds the
 * rise), so the louder crunches push it a little faster.
 */
const ART_W = 1672, ART_H = 941
const HAND = { url: '/landing/title-hand.png', x: 630, y: 465, w: 280, h: 375 }, HAND_SOIL = 830
const HAND_AT = 0.5, RISE_S = 3.4
const DIG = '/audio/hand-dig.wav', CRUMBLE = '/audio/dirt-crumble.wav'
const smooth = (v: number) => { const x = Math.min(1, Math.max(0, v)); return x * x * (3 - 2 * x) }
/** Without sound: the pushes at fixed times (s after HAND_AT). */
const CANNED_PUSHES = [0, 0.6, 1.2, 1.9, 2.6, 3.2]
interface Clod { t: number; x: number; vx: number; vy: number; r: number; shade: number }
/** Clods of earth thrown up at each push (painting px, from the soil line round the wrist). */
function clodsFor(pushes: number[]): Clod[] {
  const out: Clod[] = []
  pushes.forEach((t, p) => {
    const n = p === 0 ? 16 : 6
    for (let k = 0; k < n; k++) {
      const h = (j: number) => hashAt(p * 31 + k, j)
      out.push({ t, x: 690 + 110 * h(1), vx: (h(2) - 0.5) * 140, vy: -(70 + 170 * h(3)) * (p === 0 ? 1.2 : 0.8), r: 1.6 + 3.4 * h(4), shade: h(5) })
    }
  })
  return out
}

/** The thunder's loudness per 10 ms, its top 18 dB mapped to 0..1: the lightning follows it. */
function loudness(b: AudioBuffer): Float32Array {
  const step = Math.round(b.sampleRate * 0.01), n = Math.ceil(b.length / step), db = new Float32Array(n)
  const ch = Array.from({ length: b.numberOfChannels }, (_, c) => b.getChannelData(c))
  let top = -120
  for (let k = 0; k < n; k++) {
    let sum = 0; const end = Math.min(b.length, (k + 1) * step)
    for (let i = k * step; i < end; i++) for (const c of ch) sum += c[i] * c[i]
    db[k] = 10 * Math.log10(sum / ((end - k * step) * ch.length) + 1e-12); top = Math.max(top, db[k])
  }
  return db.map(v => Math.min(1, Math.max(0, (v - (top - 18)) / 18)))
}
/** Without sound: the same kind of strike, by hand (a crack, a dip, a second flicker, a fade). */
const CANNED = (ft: number) => (ft < 0 ? 0 : ft < 0.06 ? 1 : ft < 0.12 ? 0.25 : ft < 0.2 ? 0.8 : Math.max(0, 0.8 * Math.exp(-(ft - 0.2) * 5)))
/**
 * One bolt from the clouds down to the hill behind the house (screen %, the
 * svg is stretched to the screen): a jagged channel built by midpoint
 * displacement (fixed seed, so it is the same every time) with two forks.
 */
function boltPaths(): { main: string; forks: string } {
  let seed = 7
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5 }
  const jag = (x0: number, y0: number, x1: number, y1: number, rough: number, depth: number): [number, number][] => {
    if (depth === 0) return [[x0, y0], [x1, y1]]
    const mx = (x0 + x1) / 2 + r() * rough, my = (y0 + y1) / 2 + r() * rough * 0.25
    return [...jag(x0, y0, mx, my, rough / 2, depth - 1), ...jag(mx, my, x1, y1, rough / 2, depth - 1).slice(1)]
  }
  const d = (pts: [number, number][]) => 'M' + pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' L')
  const main = jag(70, -2, 66, 50, 9, 6)
  const a = main[18], b = main[38]
  return { main: d(main), forks: d(jag(a[0], a[1], a[0] - 7, a[1] + 13, 4, 4)) + ' ' + d(jag(b[0], b[1], b[0] + 6, b[1] + 9, 3, 4)) }
}
const BOLT = boltPaths()

/**
 * The stone room's echo: 3.2 s of decaying noise per channel. Making it took
 * ~0.6 s on a phone at the moment the sound starts, so it is made while the
 * entry screen waits for its tap (warmTitleCard) and only reused here.
 */
const VERB_S = 3.2, VERB_RATE = 48000
let verbNoise: Float32Array[] | null = null
function makeVerb(): Float32Array[] {
  const len = Math.floor(VERB_RATE * VERB_S)
  return [0, 1].map(() => { const d = new Float32Array(len); let e = 1; for (let k = 0; k < len; k++) { if ((k & 63) === 0) e = Math.pow(1 - k / len, 3.2); d[k] = (Math.random() * 2 - 1) * e } return d })
}
/** Called by the entry screen: prepares the echo in idle time, before the card is needed. */
export function warmTitleCard(): void {
  if (verbNoise) return
  const go = () => { verbNoise ??= makeVerb() }
  const idle = (window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback
  if (idle) idle(go, { timeout: 2500 }); else window.setTimeout(go, 400)
}

/** Seconds into the card at which letter i is struck. */
const keyAt = (i: number) => FIRST_KEY + i * KEY_GAP

/** Blood under each letter: a run that starts inside the letter's foot, thins to a neck and ends in a bead (SVG). */
const hashAt = (i: number, k: number) => { const v = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v) }
interface Drip { x: number; w: number; len: number; delay: number; falls: boolean; path: string }
function dripPath(W: number, L: number, a: number, b: number): string {
  const cx = W / 2, n = W * (0.16 + 0.14 * a), r = W * (0.3 + 0.12 * b), wob = (a - 0.5) * W * 0.25
  const neckY = L - r * 1.7
  return `M0,0 C${W * 0.08},${L * 0.12} ${cx - n},${L * 0.2} ${cx - n / 2},${L * 0.42}`
    + ` C${cx - n / 2 + wob},${L * 0.62} ${cx - n * 0.45 + wob},${neckY} ${cx - r * 0.95 + wob * 0.5},${L - r * 0.9}`
    + ` A${r},${r * 1.05} 0 1 0 ${cx + r * 0.95 + wob * 0.5},${L - r * 0.9}`
    + ` C${cx + n * 0.45 + wob},${neckY} ${cx + n / 2 + wob},${L * 0.62} ${cx + n / 2},${L * 0.42}`
    + ` C${cx + n},${L * 0.2} ${W * 0.92},${L * 0.12} ${W},0 Z`
}
const DRIPS: Drip[][] = [...TITLE].map((L, i) => {
  if (L === ' ') return []
  const n = hashAt(i, 0) > 0.45 ? 1 : 0
  return Array.from({ length: n }, (_, k) => {
    const w = 9 + 9 * hashAt(i, k + 2), len = (hashAt(i, k + 4) > 0.3 ? 34 + 80 * hashAt(i, k + 5) : 14 + 10 * hashAt(i, k + 5))
    return { x: 0.18 + 0.64 * hashAt(i, k + 1), w, len, delay: 0.12 + 0.45 * hashAt(i, k + 7), falls: len > 50 && hashAt(i, k + 9) > 0.4, path: dripPath(w, len, hashAt(i, k + 11), hashAt(i, k + 13)) }
  })
})

/**
 * The first thing the site shows (8 s): THE CURSED HOUSE typed out letter by
 * letter in dripping blood, each letter with the strike of a typewriter key,
 * and a few lines about the game. The landing loads behind it.
 *
 * Sound: browsers allow audio only after a gesture, so the first click or key
 * starts it; letters already typed stay silent, the rest are heard. The keys
 * are scheduled on the AudioContext clock and the letters follow that clock.
 */
/**
 * Where blood can leave a letter: the lowest ink of the glyph, found by
 * drawing it in Creepster on a canvas the size of its box. Returns, per
 * letter, the x of a column that reaches the bottom band and the y of its
 * lowest ink (both as fractions of the box), or null where nothing reaches.
 */
function measureAnchors(spans: (HTMLSpanElement | null)[]): ({ x: number; y: number } | null)[] {
  return spans.map((el, i) => {
    if (!el || TITLE[i] === ' ') return null
    const r = el.getBoundingClientRect()
    const fs = parseFloat(getComputedStyle(el).fontSize)
    const W = Math.ceil(r.width), H = Math.ceil(r.height)
    if (!W || !H) return null
    const c = document.createElement('canvas'); c.width = W; c.height = H
    const g = c.getContext('2d', { willReadFrequently: true })!
    g.font = `${fs}px Creepster`
    g.textBaseline = 'alphabetic'
    const m = g.measureText(TITLE[i])
    const asc = m.fontBoundingBoxAscent, desc = m.fontBoundingBoxDescent
    const base = (H - (asc + desc)) / 2 + asc        // where CSS puts the baseline in a line-height 1 box
    g.fillStyle = '#000'
    g.fillText(TITLE[i], (W - m.width) / 2, base)
    const d = g.getImageData(0, 0, W, H).data
    const low = new Array(W).fill(-1)                // lowest ink row per column
    for (let x = 0; x < W; x++) for (let y = H - 1; y >= 0; y--) if (d[(y * W + x) * 4 + 3] > 140) { low[x] = y; break }
    const bottom = Math.max(...low)
    if (bottom < 0) return null
    // columns whose ink reaches the bottom band (the stem of a T, the legs of an H)
    const band = bottom - H * 0.06
    const cols = low.map((y, x) => (y >= band ? x : -1)).filter(x => x >= 0)
    // runs of neighbouring columns; drip from the middle of one run (chosen per letter)
    const runs: number[][] = []
    for (const x of cols) { const last = runs[runs.length - 1]; if (last && x - last[last.length - 1] <= 1) last.push(x); else runs.push([x]) }
    const run = runs.filter(rn => rn.length >= 3)[Math.floor(hashAt(i, 21) * runs.filter(rn => rn.length >= 3).length)] ?? runs[0]
    const x = run[Math.floor(run.length / 2)]
    return { x: x / W, y: (low[x] - 2) / H }
  })
}

export function TitleCard({ onDone, onTyped }: { onDone: () => void; /** the title is typed: the landing may start loading */ onTyped?: () => void }) {
  const [shown, setShown] = useState(0)
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([])
  const [anchors, setAnchors] = useState<({ x: number; y: number } | null)[]>([])
  // measure once the font is ready (and again if the window size changes the title)
  useEffect(() => {
    let alive = true
    const go = () => { if (alive) setAnchors(measureAnchors(letterRefs.current)) }
    void (document.fonts?.load('64px Creepster') ?? Promise.resolve()).then(go)
    window.addEventListener('resize', go)
    return () => { alive = false; window.removeEventListener('resize', go) }
  }, [])
  const [sub, setSub] = useState(false)
  const [fading, setFading] = useState(false)
  const [audible, setAudible] = useState(false)
  const done = useRef(false)
  const fillRef = useRef<HTMLDivElement>(null)
  const flashRef = useRef<HTMLDivElement>(null)
  const boltRef = useRef<SVGSVGElement>(null)
  const riderRef = useRef<HTMLDivElement>(null)
  const handBoxRef = useRef<HTMLDivElement>(null)
  const handImgRef = useRef<HTMLImageElement>(null)
  const clodRef = useRef<HTMLCanvasElement>(null)
  const onTypedRef = useRef(onTyped)
  onTypedRef.current = onTyped

  useEffect(() => {
    const finish = () => { if (!done.current) { done.current = true; onDone() } }
    const perf0 = performance.now() / 1000
    let ctx: AudioContext | null = null
    let master: GainNode | null = null
    let bufs: AudioBuffer[] = []
    /** Card time -> audio time, once sound runs. */
    let audioBase: number | null = null
    let raf = 0
    let skipAt: number | null = null
    let typedSent = false
    let thunderEnv: Float32Array | null = null
    let fadeAt: number | null = null
    /** False once unmounted: late promises (decoding the keys) must not schedule sound. */
    let alive = true
    // the hand: its rise (0..1) follows the dirt recording when that plays, else a smooth canned rise
    let digCum: Float32Array | null = null
    let clods = clodsFor(CANNED_PUSHES)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const handP = (ft: number) => {
      if (reduced) return 1
      if (ft <= 0) return 0
      if (digCum) { const k = Math.floor(ft / 0.01); return k >= digCum.length ? 1 : digCum[k] }
      return smooth(ft / RISE_S)
    }
    // where the hand's box is on screen (the painting is shown cover-fit, centred)
    let sc = 1, ox = 0, oy = 0
    const lay = () => {
      const w = window.innerWidth, h = window.innerHeight
      sc = Math.max(w / ART_W, h / ART_H); ox = (w - ART_W * sc) / 2; oy = (h - ART_H * sc) / 2
      const box = handBoxRef.current, img = handImgRef.current, cv = clodRef.current
      if (box) {
        const bh = (HAND_SOIL - HAND.y) * sc, fade = 16 * sc
        Object.assign(box.style, { left: `${ox + HAND.x * sc}px`, top: `${oy + HAND.y * sc}px`, width: `${HAND.w * sc}px`, height: `${bh}px` })
        const m = `linear-gradient(to bottom, #000 ${bh - fade}px, transparent ${bh}px)`
        box.style.maskImage = m; box.style.setProperty('-webkit-mask-image', m)
      }
      if (img) { img.style.width = `${HAND.w * sc}px`; img.style.height = `${HAND.h * sc}px` }
      if (cv) {
        const dpr = Math.min(2, window.devicePixelRatio || 1)
        cv.width = Math.round(ART_W * sc * dpr * 0.3); cv.height = Math.round(260 * sc * dpr)
        Object.assign(cv.style, { left: `${ox + (HAND.x - 120) * sc}px`, top: `${oy + (HAND_SOIL - 230) * sc}px`, width: `${ART_W * sc * 0.3}px`, height: `${260 * sc}px` })
      }
    }
    lay()
    window.addEventListener('resize', lay)
    const drawHand = (t: number) => {
      const ft = t - HAND_AT, p = handP(ft)
      const img = handImgRef.current
      if (img) {
        // the strain of pushing up: a slow, small sway (at most about 0.3 degrees)
        const shake = !reduced && p > 0 && p < 1 ? Math.sin(t * 4.2) * 0.2 + Math.sin(t * 1.7) * 0.1 : 0
        img.style.transform = `translateY(${(1 - p) * (HAND_SOIL - HAND.y + 4) * sc}px) rotate(${shake}deg)`
      }
      const cv = clodRef.current
      if (!cv || reduced) return
      const g = cv.getContext('2d')!
      const k = cv.width / (ART_W * 0.3)               // canvas px per painting px
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height)
      g.setTransform(k, 0, 0, k, -(HAND.x - 120) * k, -(HAND_SOIL - 230) * k)
      for (const c of clods) {
        const a = ft - c.t
        if (a < 0 || a > 1.4) continue
        const x = c.x + c.vx * a, y = HAND_SOIL - 10 + c.vy * a + 0.5 * 520 * a * a
        if (y > HAND_SOIL + 8) continue
        g.fillStyle = c.shade > 0.5 ? '#21120b' : '#120906'
        g.beginPath(); g.ellipse(x, y, c.r, c.r * 0.8, c.shade * 3, 0, Math.PI * 2); g.fill()
      }
    }

    const elapsedPerf = () => performance.now() / 1000 - perf0
    const elapsed = () => {
      if (ctx && audioBase !== null) return ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0) - audioBase
      return elapsedPerf()
    }

    try {
      ctx = gameAudio()
      master = ctx.createGain()
      master.gain.value = soundState.muted ? 0 : 0.9
      master.connect(ctx.destination)
      void Promise.all([...KEYS, HEARTBEAT, THUNDER, DIG, CRUMBLE].map(u => fetch(u).then(r => r.arrayBuffer()).then(b => ctx!.decodeAudioData(b)))).then(b => { bufs = b; thunderEnv = loudness(b[2]); tryStart() }).catch(() => undefined)
    } catch { ctx = null }

    /** Once the context runs and the keys are decoded: tie the card to the audio clock, schedule the letters still to come. */
    const tryStart = () => {
      if (!alive || !ctx || !master || audioBase !== null || ctx.state !== 'running' || bufs.length < 5) return
      const now = elapsedPerf()
      const lat = ctx.outputLatency || ctx.baseLatency || 0
      audioBase = ctx.currentTime - lat - now
      setAudible(true)
      const at = (sec: number) => audioBase! + lat + sec
      // a large, dark stone room: a long reverb (decaying noise), its highs rolled off
      const verb = ctx.createConvolver()
      // the echo made in advance (at 48 kHz; a different device rate only changes its length a little)
      const noise = verbNoise ??= makeVerb()
      const ir = ctx.createBuffer(2, noise[0].length, VERB_RATE)
      noise.forEach((d, c) => ir.copyToChannel(d as Float32Array<ArrayBuffer>, c))
      verb.buffer = ir
      const dark = ctx.createBiquadFilter(); dark.type = 'lowpass'; dark.frequency.value = 1600
      const wet = ctx.createGain(); wet.gain.value = 0.85
      verb.connect(dark).connect(wet).connect(master)
      // the keys: struck slow and heavy (pitched down), dull, ringing out in that room
      const dull = ctx.createBiquadFilter(); dull.type = 'lowpass'; dull.frequency.value = 2600
      const body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 180; body.Q.value = 0.9; body.gain.value = 7
      dull.connect(body).connect(master)
      body.connect(verb)
      const keys: number[] = []
      for (let i = 0; i < TITLE.length; i++) {
        if (TITLE[i] === ' ') continue                 // a space is not struck
        if (keyAt(i) < now + 0.03) continue          // already typed in silence
        keys.push(i)
        const src = ctx.createBufferSource()
        src.buffer = bufs[0]
        src.playbackRate.value = 0.6 + 0.08 * ((i * 7) % 5) / 4    // slow and heavy; no two quite the same
        const g = ctx.createGain()
        g.gain.value = i === TITLE.length - 1 ? 1.1 : 0.85
        src.connect(g).connect(dull)
        src.start(at(keyAt(i)))
      }
      if (keys.length) {
        // a slow heartbeat under the typing, fading in and out
        const first = keyAt(keys[0]), last = keyAt(TITLE.length - 1)
        const hb = ctx.createBufferSource(); hb.buffer = bufs[1]; hb.loop = true
        const hg = ctx.createGain(); hg.gain.setValueAtTime(0, at(first)); hg.gain.linearRampToValueAtTime(0.55, at(first + 0.8))
        hg.gain.setValueAtTime(0.55, at(last)); hg.gain.linearRampToValueAtTime(0, at(last + 1.2))
        const hl = ctx.createBiquadFilter(); hl.type = 'lowpass'; hl.frequency.value = 900
        hb.connect(hl).connect(hg).connect(master)
        hb.start(at(first)); hb.stop(at(last + 1.3))
        // the last letter lands with a deep, muffled hit that rolls round the room
        const th = ctx.createBufferSource(); th.buffer = bufs[2]
        const tl = ctx.createBiquadFilter(); tl.type = 'lowpass'; tl.frequency.value = 700
        const tg = ctx.createGain(); tg.gain.value = 0.9
        th.connect(tl).connect(tg).connect(master); tg.connect(verb)
        th.start(at(last))
      }
      if (HAND_AT > now + 0.05 && !reduced) {
        // the grave breaks open (a dry crumble), then the dirt grinds as the hand pushes up
        const crumble = ctx.createBufferSource(); crumble.buffer = bufs[4]
        const cl = ctx.createBiquadFilter(); cl.type = 'lowpass'; cl.frequency.value = 3200
        const cg = ctx.createGain(); cg.gain.value = 1
        crumble.connect(cl).connect(cg).connect(master); cg.connect(verb)
        crumble.start(at(HAND_AT))
        const dig = ctx.createBufferSource(); dig.buffer = bufs[3]
        const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2200
        const dbody = ctx.createBiquadFilter(); dbody.type = 'peaking'; dbody.frequency.value = 160; dbody.Q.value = 0.8; dbody.gain.value = 5
        const dg = ctx.createGain(); dg.gain.value = 0.85
        // only the first RISE_S of the recording: it fades out as the hand stops
        dg.gain.setValueAtTime(0.85, at(HAND_AT + RISE_S - 0.4)); dg.gain.linearRampToValueAtTime(0, at(HAND_AT + RISE_S))
        const send = ctx.createGain(); send.gain.value = 0.3
        dig.connect(dl).connect(dbody).connect(dg).connect(master); dg.connect(send).connect(verb)
        dig.start(at(HAND_AT), 0, RISE_S)
        // the rise follows the dirt (10 ms steps): a steady part plus the loudness,
        // smoothed over 250 ms so it pushes up slowly instead of jerking
        const full = loudness(bufs[3]), n = Math.min(full.length, Math.round(RISE_S / 0.01))
        const env = new Float32Array(n)
        for (let k = 0; k < n; k++) { let a = 0, c = 0; for (let j = Math.max(0, k - 12); j <= Math.min(n - 1, k + 12); j++) { a += full[j]; c++ } env[k] = a / c }
        const cum = new Float32Array(n)
        let s = 0
        env.forEach((v, k) => { s += 0.7 + v; cum[k] = s })
        digCum = cum.map((v, k) => smooth(k / n) * 0.5 + (v / s) * 0.5)
        // clods fly at the crumble and at each loud crunch (at least 0.3 s apart)
        const pushes = [0]
        for (let k = 1; k < n - 1; k++) if (full[k] > 0.7 && full[k] >= full[k - 1] && full[k] >= full[k + 1] && k * 0.01 - pushes[pushes.length - 1] > 0.3) pushes.push(k * 0.01)
        clods = clodsFor(pushes)
      }
    }
    const gesture = () => { unlockAudio(); if (ctx && ctx.state !== 'running') void ctx.resume().then(tryStart); else tryStart() }
    const offGesture = onActivation(gesture)
    // the shared context may still be starting from the entry screen's tap: begin as soon as it runs
    ctx?.addEventListener('statechange', () => tryStart())

    const tick = () => {
      raf = requestAnimationFrame(tick)
      const t = elapsed()
      let n = 0
      while (n < TITLE.length && keyAt(n) <= t) n++
      setShown(n)
      drawHand(t)
      // the lightning on the last letter, lit by the thunder as it is heard
      {
        const ft = t - keyAt(TITLE.length - 1)
        let f = 0
        if (ft >= 0 && ft < 3) {
          if (audioBase !== null && thunderEnv) { const k = Math.floor(ft / 0.01); f = k < thunderEnv.length ? Math.pow(thunderEnv[k], 1.6) : 0 }
          else f = CANNED(ft)
        }
        if (flashRef.current) flashRef.current.style.opacity = String(f * 0.85)
        if (boltRef.current) boltRef.current.style.opacity = String(ft >= 0 && ft < 0.32 && f > 0.45 ? 1 : 0)
      }
      // the bar follows the card's own clock (the letters' clock), eased, full when the card fades
      const p = Math.min(1, Math.max(0, t / FADE_AT)), e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${e})`
      if (riderRef.current) riderRef.current.style.transform = `translateX(${e * 100}%)`
      if (t >= SUB_AT && !typedSent) { typedSent = true; setSub(true); onTypedRef.current?.() }
      if ((t >= FADE_AT || skipAt !== null) && fadeAt === null) { fadeAt = t; setFading(true) }
      if (fadeAt !== null && t >= fadeAt + (skipAt !== null ? 0.5 : FADE_S)) finish()
    }
    raf = requestAnimationFrame(tick)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      offGesture()
      window.removeEventListener('resize', lay)
      // let the last strike ring out
      const c = ctx
      const m = master
      if (c) window.setTimeout(() => releaseAudio(c, m ? [m] : []), 400)
    }
  }, [onDone])

  return (
    <div className={`title-card ${fading ? 'is-fading' : ''}`} role="dialog" aria-label="The Cursed House">
      <div className="tc-bg" style={{ backgroundImage: `url(${TITLE_BG})` }} aria-hidden="true" />
      <div className="tc-hand" ref={handBoxRef} aria-hidden="true"><img ref={handImgRef} src={HAND.url} alt="" draggable={false} /></div>
      <canvas className="tc-clods" ref={clodRef} aria-hidden="true" />
      <TitleSky />
      <svg className="tc-bolt" ref={boltRef} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs><filter id="tcBoltGlow" x="-50%" y="-10%" width="200%" height="120%"><feGaussianBlur stdDeviation="0.9" /></filter></defs>
        <g filter="url(#tcBoltGlow)"><path d={BOLT.main} className="tc-bolt-glow" /><path d={BOLT.forks} className="tc-bolt-glow is-fork" /></g>
        <path d={BOLT.main} className="tc-bolt-core" /><path d={BOLT.forks} className="tc-bolt-core is-fork" />
      </svg>
      <div className="tc-flash" ref={flashRef} aria-hidden="true" />
 <div className="tc-vignette" aria-hidden="true" />
      <div className="tc-body">
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs>
          <linearGradient id="tcBlood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b10e14" /><stop offset="1" stopColor="#b10e14" /></linearGradient>
        </defs></svg>
        <h1 className="tc-title" aria-label={TITLE}>
          {[...TITLE].map((L, i) => (
            <span key={i} ref={el => { letterRefs.current[i] = el }} className={`tc-letter ${i < shown ? 'is-in' : ''} ${L === ' ' ? 'is-space' : ''}`} aria-hidden="true">
              {L}
              {i < shown && anchors[i] && DRIPS[i].map((d, k) => (
                <span key={k} className="tc-drip" style={{ left: `calc(${anchors[i]!.x * 100}% - ${d.w / 2}px)`, top: `${anchors[i]!.y * 100}%`, width: d.w, height: d.len + 2, animationDelay: `${d.delay}s`, animationDuration: `${1 + d.len / 60}s` }}>
                  <svg width={d.w} height={d.len + 2} viewBox={`0 0 ${d.w} ${d.len + 2}`}><path d={d.path} fill="url(#tcBlood)" /></svg>
                  {d.falls && (
                    <svg className="tc-drop" width={d.w * 0.6} height={d.w} viewBox="0 0 10 16" style={{ left: d.w * 0.2, top: d.len - d.w * 0.5, animationDelay: `${d.delay + 1 + d.len / 60 + 0.4}s` }}>
                      <path d="M5,0 C6,4 10,8 10,11 A5,5 0 0 1 0,11 C0,8 4,4 5,0 Z" fill="url(#tcBlood)" />
                    </svg>
                  )}
                </span>
              ))}
            </span>
          ))}
        </h1>
        <div className={`tc-about ${sub ? 'is-in' : ''}`}>
          <div className="tc-sub">NOBODY LEAVES BEFORE MIDNIGHT</div>
          <p>The lights are on. The door is open. No one has lived here in thirty years.</p>
          <p>Every portrait has eyes, and every whisper has a name.</p>
          <p>Step inside. It has been expecting you.</p>
        </div>
      </div>
      <div className="tc-loader" role="progressbar" aria-label="Loading">
        <div className="tc-loader-label">THE HOUSE IS WAKING…</div>
        <div className="tc-track">
          <div className="tc-fill" ref={fillRef} />
          {/* the witch's head rides the end of the bar */}
          <div className="tc-rider" ref={riderRef}><div className="tc-head" /></div>
        </div>
      </div>
      {!audible && <p className="tc-hint">click or press a key for sound</p>}
      <style>{`
        .title-card { position: fixed; inset: 0; z-index: 60; overflow: hidden; background: #000; display: grid; place-items: center; transition: opacity .8s ease; }
        .title-card.is-fading { opacity: 0; pointer-events: none; }
        .tc-bg { position: absolute; inset: 0; background-size: cover; background-position: center; filter: brightness(1.28) contrast(.97);
          }
        /* the lightning: a cold flash from the storm side of the sky, and one bolt */
        .tc-flash { position: absolute; inset: 0; opacity: 0; pointer-events: none; mix-blend-mode: screen;
          background: radial-gradient(ellipse 70% 60% at 68% 8%, rgba(210, 225, 255, .95), rgba(150, 175, 230, .45) 45%, rgba(60, 80, 130, .15) 75%, transparent 100%); }
        .tc-bolt { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; pointer-events: none; }
        .tc-bolt path { fill: none; stroke-linejoin: miter; vector-effect: non-scaling-stroke; }
        .tc-bolt-glow { stroke: rgba(180, 205, 255, .8); stroke-width: 7; }
        .tc-bolt-core { stroke: #f6f9ff; stroke-width: 2; }
        .tc-bolt .is-fork { stroke-width: 1.1; opacity: .8; }
        .tc-bolt-glow.is-fork { stroke-width: 4; }
        /* the hand: its box ends at the soil line (soft edge), the hand slides up into it */
        .tc-hand { position: absolute; overflow: hidden; pointer-events: none; }
        .tc-hand img { position: absolute; left: 0; top: 0; display: block; transform: translateY(100vh); transform-origin: 50% 100%; will-change: transform; }
        .tc-clods { position: absolute; pointer-events: none; }
        .tc-sky { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
 .tc-vignette { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 45%, transparent 60%, rgba(0, 0, 0, .32) 100%); }
        .tc-body { position: absolute; left: 0; right: 0; top: 14vh; text-align: center; padding: 0 4vw; }
        .tc-title { --blood: #b10e14; margin: 0; font: normal clamp(42px, 7.6vw, 150px) 'Creepster', Georgia, serif; letter-spacing: .04em; line-height: 1; white-space: nowrap; }
        .tc-letter { position: relative; display: inline-block; opacity: 0; color: #b10f16;
          -webkit-text-fill-color: var(--blood);
          filter: drop-shadow(2px 3px 0 #1a0000) drop-shadow(0 0 12px rgba(170, 0, 0, .55)); }
        /* the strike: the letter slams onto the page */
        .tc-letter.is-space { width: .32em; }
        .tc-letter.is-in { animation: tcStrike .22s cubic-bezier(.2, .9, .3, 1) both; }
        @keyframes tcStrike { 0% { opacity: 0; transform: scale(1.5) translateY(-6px); } 60% { opacity: 1; transform: scale(.97); } 100% { opacity: 1; transform: none; } }
        /* blood runs out of the letter's foot: revealed top to bottom, so the bead keeps its shape */
        .tc-drip { position: absolute; clip-path: inset(0 0 100% 0); animation: tcRun 1.6s cubic-bezier(.4, .1, .4, 1) both; pointer-events: none; }
        .tc-drip svg { display: block; overflow: visible; }
        @keyframes tcRun { to { clip-path: inset(-20px -20px -100vh -20px); } }
        /* a teardrop lets go of the bead and falls */
        .tc-drip svg.tc-drop { position: absolute; opacity: 0; animation: tcFall 1.1s cubic-bezier(.5, 0, 1, 1) both; }
        @keyframes tcFall { 0% { opacity: 1; transform: translateY(0) scaleY(.8); } 15% { transform: translateY(4px) scaleY(1.15); } 90% { opacity: 1; } 100% { opacity: 0; transform: translateY(55vh); } }
        /* the words under the title are in rem, so they grow with the UI size set in index.html */
        .tc-about { margin-top: clamp(70px, 14vh, 140px); color: #d9c7a6; font-family: Georgia, 'Times New Roman', serif; opacity: 0; transform: translateY(8px);
          transition: opacity 1.2s ease, transform 1.2s ease; text-shadow: 0 0 8px #000, 0 0 2px #000; }
        .tc-about.is-in { opacity: 1; transform: none; }
        .tc-sub { font: clamp(1rem, 1.7vw, 1.5rem) Georgia, serif; letter-spacing: .5em; color: #e6d2ac; margin-bottom: .8em; }
        .tc-about p { margin: .25em 0; font-size: clamp(1rem, 1.45vw, 1.35rem); font-style: italic; }
        /* The loader: transform-only CSS animations over the card's length, so
           they keep moving on the compositor while the landing loads. */
        .tc-loader { position: absolute; left: 50%; bottom: 8vh; padding: 16px 40px 0;
          background: radial-gradient(ellipse 58% 90% at 50% 55%, rgba(0, 0, 0, .85) 30%, transparent 100%); width: min(560px, 74vw); transform: translateX(-50%); text-align: center; }
        .tc-loader-label { font: .9rem Georgia, serif; letter-spacing: .4em; color: rgba(240, 222, 188, .95); margin-bottom: 58px;
          text-shadow: 0 0 4px #000, 0 0 10px #000, 0 0 2px #000; animation: tcBreathe 2.4s ease-in-out infinite; }
        @keyframes tcBreathe { 50% { opacity: .5; } }
        .tc-track { position: relative; height: 6px; border-radius: 3px; background: rgba(10, 4, 4, .75);
          border: 1px solid rgba(200, 40, 30, .45); box-shadow: 0 0 14px rgba(0, 0, 0, .9), inset 0 0 6px rgba(0, 0, 0, .9); }
        .tc-fill { position: absolute; inset: 0; border-radius: 3px; transform-origin: left; transform: scaleX(0);
          background: linear-gradient(90deg, #4a0205, #a80c12 70%, #e0261f); box-shadow: 0 0 10px rgba(220, 30, 20, .6); }
        .tc-rider { position: absolute; inset: 0; transform: translateX(0); }
        /* her head and hat, cut out (the image is transparent around her):
           x 17–79% and y 0–47% of witch-reaching.webp, edges faded so no crop line shows */
        .tc-head { position: absolute; left: 0; top: 50%; width: 104px; height: 82px; margin: -46px 0 0 -52px;
          background: url('/stage1/witch-reaching.webp') 44.8% 0% / 161% auto no-repeat;
          -webkit-mask-image: radial-gradient(ellipse 52% 56% at 50% 46%, #000 72%, transparent 100%);
          mask-image: radial-gradient(ellipse 52% 56% at 50% 46%, #000 72%, transparent 100%);
          filter: drop-shadow(0 0 6px rgba(220, 30, 20, .75)) drop-shadow(0 2px 2px #000);
          animation: tcBob .9s ease-in-out infinite; }
        /* she cackles as she goes: a little bob and a tilt */
        @keyframes tcBob { 0%, 100% { transform: translateY(0) rotate(-6deg); } 50% { transform: translateY(-5px) rotate(6deg); } }
        .tc-hint { position: absolute; bottom: 4vh; margin: 0; font: italic .8rem Georgia, serif; letter-spacing: .14em; color: rgba(217, 199, 166, .55); }
        /* a phone held sideways: the same card, sized to the short screen (the drips are drawn in px, so they are scaled) */
        @media (max-height: 560px) {
          .tc-body { top: 7vh; }
          .tc-title { font-size: min(7.6vw, 17vh); }
          .tc-drip { transform: scale(.55); transform-origin: 50% 0; }
          .tc-about { margin-top: 15vh; }
          .tc-sub { font-size: 12.5px; letter-spacing: .4em; margin-bottom: 6px; }
          .tc-about p { font-size: 12.5px; margin: 2px 0; }
          .tc-loader { bottom: 5vh; padding-top: 8px; }
          .tc-loader-label { font-size: 11.5px; margin-bottom: 30px; }
          .tc-head { width: 64px; height: 50px; margin: -28px 0 0 -32px; }
          .tc-hint { bottom: 1.5vh; font-size: 11px; }
        }
        /* phones: one text shadow instead of two blurred drop-shadow filters (those were redrawn every frame) */
        @media (pointer: coarse) {
          .tc-letter { filter: none; text-shadow: 2px 3px 0 #1a0000, 0 0 10px rgba(170, 0, 0, .5); }
        }
        @media (prefers-reduced-motion: reduce) {
          .tc-letter.is-space { width: .32em; }
        .tc-letter.is-in { animation: none; opacity: 1; }
          .tc-drip { animation: none; clip-path: none; }
          .tc-drop { display: none; }
        }
      `}</style>
    </div>
  )
}
