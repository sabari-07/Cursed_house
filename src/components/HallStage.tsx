import { useCallback, useEffect, useRef, useState } from 'react'
import { HallScene, musicPreferred, setMusicPreferred, type HallTarget } from '../scenes/HallScene'
import { JOURNAL, PORTRAITS, type PortraitId } from '../stage1/stage1Data'
import { JOURNAL_TEXT, PORTRAIT_NAMES, RIDDLE_IDS, checkAnswer, generateRiddle, newSeed, type RiddleId, type RiddleRun } from '../stage1/riddles'
import { LEVELS, STAGE_TITLES, TREASURES, playable, type StageNo, type TreasureId } from '../game/levels'
import { afterDeath, afterWin, type ProgressV2 } from '../game/progress'
import { deathCount, deathLine, deathTip, guideDue, guideLines, markGuideSeen, type DeathCause } from '../game/houseVoice'
import { checkRoomAnswer, generateRoomRiddle, isRoomRiddle, type RoomRun } from '../riddles'
import { ROOMS } from '../scenes/room/rooms'
import { SequencePanel } from './answers/SequencePanel'
import { ChoicePanel } from './answers/ChoicePanel'

/** A stage's riddle: the hall's (stage1/riddles.ts) or a painted room's (riddles/*.ts). */
type Run = RiddleRun | RoomRun
const isRoomRun = (r: Run): r is RoomRun => 'setup' in r

/** Notes text: "__x__" underlines x (the diary in the library). */
function noteLine(line: string) {
  const parts = line.split(/__(.+?)__/)
  return parts.map((p, i) => (i % 2 ? <u key={i} className="note-underline">{p}</u> : p))
}

interface Props {
  /** Where the player is: the level (its room and rules) and the stage to play. */
  progress: ProgressV2
  /** Called after every stage won and every death, with the new progress. */
  onSave: (p: ProgressV2) => void
  /** Back to the landing page (after a death, or after the level's treasure). */
  onExit: () => void
  /** Playing without an account (the treasure card offers to keep it). */
  guest?: boolean
  /** After a level's treasure, go straight into the next level's room (not out of the house). */
  onNextLevel?: () => void
}

type Phase = 'intro' | 'title' | 'memorise' | 'play' | 'won' | 'between' | 'treasure' | 'dead'

/** The stage title stays over the hall this long before the question (ms). */
const TITLE_MS = 5200
/** Between stages: the title of the next stage, over black (ms). */
const BETWEEN_MS = 2600
/** Who Moved?: how long the wall is shown before the lights go out, and how long they stay out (ms). */
const MEMORISE_MS = 10000
const SWAP_DARK_MS = 1200
const WORD_LEN = 5
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Every object that can be examined, in a stable Tab order: the four
 *  portraits, the clock, then the journal page. Used to lay out the keyboard
 *  hotspots. (Answers are given with the ANSWER button, not at the door.) */
const HOTSPOTS: HallTarget[] = [
  ...PORTRAITS.map((_, index) => ({ kind: 'portrait', index }) as HallTarget),
  { kind: 'clock' },
  { kind: 'journal' },
]

/** What can be examined under the pointer: the study door is scenery now. */
const examinable = (t: HallTarget | null | undefined): HallTarget | null => (t && t.kind !== 'door' ? t : null)

/**
 * A stage's riddle, with a new seed every time, so every attempt has a
 * different answer. In development `?seed=123` fixes the seed and
 * `?riddle=clock` replaces the first stage's riddle (tests and screenshots).
 */
function makeRun(stageRiddle: string, first: boolean): Run {
  let want = stageRiddle
  let seed = newSeed()
  if (import.meta.env.DEV) {
    const q = new URLSearchParams(window.location.search)
    const s = q.get('seed')
    const r = q.get('riddle')
    if (s !== null) seed = Number(s) >>> 0
    // the override must belong to the same kind of room as the stage
    if (first && r && (RIDDLE_IDS.includes(r as RiddleId) ? !isRoomRiddle(stageRiddle) : isRoomRiddle(r) && isRoomRiddle(stageRiddle))) want = r
  }
  if (isRoomRiddle(want)) return generateRoomRiddle(seed, want)
  const id: RiddleId = RIDDLE_IDS.includes(want as RiddleId) ? (want as RiddleId) : 'blink'
  return generateRiddle(seed, id)
}

/**
 * One-time hints for the stages where small letters hide round the hall:
 * where to look (every place a letter can be, never which one holds it).
 * A hint can be read once: after it is closed its button is gone for good
 * on this browser (HINT_KEY).
 */
type HintPlace = HallTarget | { kind: 'newel' }
const HINTS: Partial<Record<string, { lines: string[]; targets: HintPlace[] }>> = {
  word: {
    lines: [
      'The letters are small. Click each of these and read the panel that opens:',
      'the four portraits (the letter is cut into the bottom of the gilt frame),',
      'the wall clock (cut into its brass rim),',
      'the torn journal page on the table,',
      'the study door, and the stone post at the foot of the stairs (these two can be read from where you stand).',
    ],
    targets: [...[0, 1, 2, 3].map(index => ({ kind: 'portrait', index }) as HintPlace), { kind: 'clock' }, { kind: 'journal' }, { kind: 'door' }, { kind: 'newel' }],
  },
  marked: {
    lines: [
      'Open the torn journal page first and find the blot.',
      'The hidden letter is scratched in one of these places:',
      'the bottom of one of the four portrait frames (click a portrait to read it),',
      'the study door, or the stone post at the foot of the stairs.',
    ],
    targets: [...[0, 1, 2, 3].map(index => ({ kind: 'portrait', index }) as HintPlace), { kind: 'journal' }, { kind: 'door' }, { kind: 'newel' }],
  },
}
const HINT_KEY = 'ghostwriter_hints_v1'
const hintsUsed = (): string[] => { try { const v = JSON.parse(localStorage.getItem(HINT_KEY) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] } }
const markHintUsed = (id: string) => { try { localStorage.setItem(HINT_KEY, JSON.stringify([...new Set([...hintsUsed(), id])])) } catch { /* kept for this visit only */ } }

/** A touch screen (phone or tablet): no keyboard hints, the candle follows the finger. */
const TOUCH = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
/** A key hint after a button label, on a keyboard only (" [C]"). */
const kb = (key: string) => (TOUCH ? '' : ` [${key}]`)
/** A short or narrow screen (a phone held sideways): the question folds away once the player turns to the room. */
const smallScreen = () => window.matchMedia('(max-height: 560px), (max-width: 760px)').matches

const portraitName = (id: PortraitId) => PORTRAIT_NAMES[id].replace(/^the /, 'The ')

/**
 * Inside the bungalow: the doors slam, the voice, the laugh, the Stage 1
 * title over the hall, then one question, answered once, within the time.
 */
export function HallStage({ progress, onSave, onExit, guest = false, onNextLevel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<HallScene | null>(null)
  const exitRef = useRef(onExit)
  exitRef.current = onExit
  const saveRef = useRef(onSave)
  saveRef.current = onSave
  // the progress as this stage engine knows it (the parent saves each change)
  const progRef = useRef(progress)
  // the level being played is fixed for this visit (the saved progress moves on after its last stage)
  const [levelId] = useState(progress.level)
  const level = LEVELS[levelId]
  const rules = level.rules
  const roomId = level.room === 'library' || level.room === 'crypt' ? level.room : 'hall'
  const isHall = roomId === 'hall'
  const [stageNo, setStageNo] = useState<StageNo>(progress.stage)
  const [run, setRun] = useState<Run>(() => makeRun(level.stages[progress.stage - 1], true))
  const runRef = useRef(run)
  runRef.current = run
  // the hall's own riddle, when this is the hall (portraits, journal, scratches)
  const hallRun = isRoomRun(run) ? null : run
  const roomRun = isRoomRun(run) ? run : null
  const [wallNow, setWallNow] = useState<PortraitId[]>(hallRun ? hallRun.scene.wall : [])
  const [objectOpen, setObjectOpen] = useState<string | null>(null)
  const [subtitle, setSubtitle] = useState<{ text: string; n: number } | null>(null)
  const hotspots: HallTarget[] = isHall ? HOTSPOTS : ROOMS[roomId].objects.map(o => ({ kind: 'object', id: o.id }))
  // In the crypt the bell hangs top centre (a clue), so the question sits top left.
  const sideBar = roomId === 'crypt'
  const numLen = roomRun?.length ?? 2
  const wordLen = roomRun?.length ?? WORD_LEN
  const [blackout, setBlackout] = useState(false)
  const [nextTitle, setNextTitle] = useState(false)
  const [treasure, setTreasure] = useState<TreasureId | null>(null)
  const [phase, setPhase] = useState<Phase>('intro')
  const [hover, setHover] = useState<{ target: HallTarget; x: number; y: number } | null>(null)
  const [inspecting, setInspecting] = useState<number | null>(null)
  const [journalOpen, setJournalOpen] = useState(false)
  const [clockOpen, setClockOpen] = useState(false)
  const [answerOpen, setAnswerOpen] = useState(false)
  const [answerLeft, setAnswerLeft] = useState<number>(rules.answerWindow)
  const [confirming, setConfirming] = useState(false)
  const [given, setGiven] = useState('')
  const [timeLeft, setTimeLeft] = useState(rules.timeLimit)
  const timeLeftRef = useRef(timeLeft)
  timeLeftRef.current = timeLeft
  const [message, setMessage] = useState<string | null>(null)
  const [gameOver, setGameOver] = useState(false)

  const phaseRef = useRef(phase)
  phaseRef.current = phase
  // Keyboard hotspots laid over the canvas, one per interactive object, so a
  // keyboard user can Tab between them. Their screen positions track the
  // drifting camera, so we move the DOM nodes directly (no re-render per frame).
  const hotspotRefs = useRef<(HTMLButtonElement | null)[]>([])

  if (import.meta.env.DEV) (window as unknown as { __run: Run }).__run = run

  // The candle the player can carry round the room (every stage): toggled by
  // the helper at the top left or C; its light follows the pointer.
  const [torch, setTorch] = useState(false)
  /** The music under play: the player's switch (only the music; every other sound is untouched). */
  const [musicOn, setMusicOn] = useState(musicPreferred)
  /** Phones: the question bar folds to one line so the room can be seen. */
  const [qFolded, setQFolded] = useState(false)
  const torchRef = useRef<HTMLDivElement | null>(null)
  /** Where the pointer last was: the candle appears there the moment it is picked up. */
  const lastPos = useRef({ x: 60, y: 60 })
  /** The candle was picked up by this press: the click that ends it must not put it down again. */
  const pickedNow = useRef(false)
  const placeTorch = (el: HTMLDivElement | null) => {
    torchRef.current = el
    if (el) el.style.transform = `translate(${lastPos.current.x + 16}px, ${lastPos.current.y + 22}px)`
  }

  // Grandfather's ghost greets a first-time player once (houseVoice.ts):
  // first a whisper by the candle, then one by the ANSWER button.
  const [guide, setGuide] = useState<'candle' | 'answer' | null>(() => (guideDue() ? 'candle' : null))
  const guideRef = useRef(guide)
  guideRef.current = guide
  const guideText = guideLines(TOUCH)
  const finishGuide = useCallback(() => {
    if (guideRef.current === null) return
    markGuideSeen()
    setGuide(null)
  }, [])
  // picking up the candle is the answer to the first whisper
  useEffect(() => { if (torch && guide === 'candle') setGuide('answer') }, [torch, guide])
  /** What the house says over GAME OVER: the line, a remark on the count, and a tip. */
  const [deathNote, setDeathNote] = useState<{ line: string; count: string | null; tip: string } | null>(null)


  // Subtitles for everything the room says aloud (shown at the same moment as the sound).
  const cue = useCallback((text: string) => setSubtitle(s => ({ text, n: (s?.n ?? 0) + 1 })), [])
  useEffect(() => {
    if (!subtitle) return
    const id = window.setTimeout(() => setSubtitle(null), 3200)
    return () => window.clearTimeout(id)
  }, [subtitle])

  const timers = useRef<number[]>([])
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }
  useEffect(() => () => timers.current.forEach(id => window.clearTimeout(id)), [])

  // The memorise phase: the question is shown with a countdown, and the
  // player can put the lights out early with I'M READY (memEnd).
  const memEnd = useRef<(() => void) | null>(null)
  const [memLeft, setMemLeft] = useState(0)
  /** Runs `dark` once: when the time is up, or when the player is ready. */
  const memorise = (seconds: number, dark: () => void) => {
    let fired = false
    const go = () => { if (fired) return; fired = true; memEnd.current = null; dark() }
    memEnd.current = go
    setMemLeft(seconds)
    later(go, seconds * 1000)
  }

  /**
   * Lays out a stage's clues and starts its clock. Who Moved? first shows the
   * wall for MEMORISE_MS, then swaps two portraits in the dark.
   */
  const beginStage = useCallback((r: Run) => {
    const scene = sceneRef.current
    if (isRoomRun(r)) {
      // a painted room: its clues, then its timed events (in the dark, after
      // the memorise phase, in The Falling Books)
      scene?.setRoomRun(r.setup)
      setTimeLeft(rules.timeLimit)
      const mem = r.setup.memorise
      if (mem) {
        setPhase('memorise')
        scene?.setMemorise(true)
        memorise(mem, () => {
          setBlackout(true)
          scene?.setMemorise(false)
          scene?.runEvents(r.setup.events, cue)
          const last = Math.max(0, ...r.setup.events.map(e => e.at))
          later(() => { setBlackout(false); setPhase('play') }, (last + 1.4) * 1000)
        })
      } else {
        setPhase('play')
        scene?.runEvents(r.setup.events, cue)
      }
      return
    }
    scene?.setRiddle(r.scene)
    setWallNow(r.scene.wall)
    setTimeLeft(rules.timeLimit)
    if (r.id === 'moved' && r.scene.wallAfter) {
      setPhase('memorise')
      scene?.setMemorise(true)
      memorise(MEMORISE_MS / 1000, () => {
        setBlackout(true)
        later(() => {
          scene?.setMemorise(false)
          scene?.swapInDark(r.scene.wallAfter!, r.scene.crooked)
          setWallNow(r.scene.wallAfter!)
          later(() => { setBlackout(false); setPhase('play') }, SWAP_DARK_MS - 400)
        }, 400)
      })
    } else {
      setPhase('play')
    }
  }, [rules.timeLimit, cue])

  /** The cinematic is over (or skipped): the hall goes live, the question stays at the top until the stage ends. */
  const showQuestion = useCallback(() => {
    if (phaseRef.current !== 'intro' && phaseRef.current !== 'title') return
    sceneRef.current?.startPlay()
    beginStage(runRef.current)
  }, [beginStage])

  /** A stage is won: save, then the next stage in this room, or the level's treasure. */
  const stageWon = useCallback(() => {
    const seconds = rules.timeLimit - timeLeftRef.current
    const res = afterWin(progRef.current, seconds)
    progRef.current = res.progress
    saveRef.current(res.progress)
    if (res.treasure) {
      later(() => { setTreasure(res.treasure); setPhase('treasure') }, 3800)
      return
    }
    // the next stage, in place: black, the hall reset, the next title, the new question
    const next = res.progress.stage
    later(() => {
      setPhase('between')
      setBlackout(true)
      later(() => {
        sceneRef.current?.nextStage()
        const r = makeRun(level.stages[next - 1], false)
        setRun(r)
        runRef.current = r
        setStageNo(next)
        setNextTitle(true)
        later(() => setNextTitle(false), BETWEEN_MS)
        setGiven('')
        setAnswerLeft(rules.answerWindow)
        setTimeLeft(rules.timeLimit)
        later(() => { setBlackout(false); beginStage(r) }, BETWEEN_MS)
      }, 500)
    }, 3400)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beginStage, level, rules])

  // Scene lifetime
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    void document.fonts?.load('64px Creepster').catch(() => undefined)
    const timers: number[] = []
    const scene = new HallScene(canvas, e => {
      if (e === 'title') {
        setPhase('title')
        timers.push(window.setTimeout(() => showQuestion(), TITLE_MS))
      } else if (e === 'gameover') setGameOver(true)
      else if (e === 'exit') exitRef.current()
    }, roomId)
    sceneRef.current = scene
    if (import.meta.env.DEV) {
      // development only: the browser checks jump past the intro (players never see a skip)
      const w = window as unknown as { __hall: HallScene; __skipIntro: () => void }
      w.__hall = scene
      w.__skipIntro = () => showQuestion()
    }
    void scene.start()
    const onResize = () => scene.resize()
    window.addEventListener('resize', onResize)
    // Honour the OS "reduce motion" setting, and follow it if it changes.
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const applyMotion = () => scene.setReducedMotion(motionQuery.matches)
    applyMotion()
    motionQuery.addEventListener('change', applyMotion)
    return () => {
      timers.forEach(id => window.clearTimeout(id))
      window.removeEventListener('resize', onResize)
      motionQuery.removeEventListener('change', applyMotion)
      scene.dispose()
      sceneRef.current = null
    }
  }, [showQuestion])

  const die = useCallback((cause: DeathCause) => {
    if (phaseRef.current !== 'play' && phaseRef.current !== 'memorise') return
    // counted; the next attempt resumes this stage with a new question
    progRef.current = afterDeath(progRef.current)
    saveRef.current(progRef.current)
    setPhase('dead')
    const deaths = progRef.current.deaths
    setDeathNote({ line: deathLine(cause, deaths), count: deathCount(deaths), tip: deathTip(cause) })
    setInspecting(null)
    setJournalOpen(false)
    setClockOpen(false)
    setObjectOpen(null)
    setSubtitle(null)
    setAnswerOpen(false)
    setConfirming(false)
    setHover(null)
    sceneRef.current?.inspectClock(false)
    sceneRef.current?.inspectObject(null)
    sceneRef.current?.fail()
  }, [])

  useEffect(() => {
    if (phase !== 'memorise') return
    const id = window.setInterval(() => setMemLeft(t => Math.max(0, t - 1)), 1000)
    return () => window.clearInterval(id)
  }, [phase])

  // The candles burn down while you play. The timer keeps running while the
  // answer panel and the confirmation are open (Requirement 5.5).
  useEffect(() => {
    if (phase !== 'play') return
    const id = window.setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000)
    return () => window.clearInterval(id)
  }, [phase])
  useEffect(() => {
    if (phase === 'play' && timeLeft <= 0) die('time')
  }, [timeLeft, phase, die])
  // No separate time limit for the answer: the stage's own timer keeps running.
  // The last 30 seconds: a heartbeat every 3 seconds.
  useEffect(() => {
    if (phase === 'play' && timeLeft > 0 && timeLeft <= rules.warnAt && timeLeft % 3 === 0) sceneRef.current?.heartbeat()
  }, [timeLeft, phase])
  useEffect(() => {
    sceneRef.current?.setWax(timeLeft / rules.timeLimit)
  }, [timeLeft])
  // The music plays while the stage's clock runs (and the player has it on); it fades out
  // at a win, and the death cuts it before the witch's laugh (HallScene.fail).
  useEffect(() => {
    sceneRef.current?.setMusic(phase === 'play' && musicOn)
  }, [phase, musicOn])
  const toggleMusic = () => setMusicOn(on => { setMusicPreferred(!on); return !on })

  // Messages fade on their own.
  useEffect(() => {
    if (!message || phase === 'dead') return
    const id = window.setTimeout(() => setMessage(null), 4200)
    return () => window.clearTimeout(id)
  }, [message, phase])

  // the one-time hint for this stage (if it has one and it has not been read)
  const hint = HINTS[run.id]
  const [hintOpen, setHintOpen] = useState(false)
  const [hintGone, setHintGone] = useState<string[]>(hintsUsed)
  const hintAvailable = !!hint && !hintGone.includes(run.id)
  const closeHint = useCallback(() => {
    setHintOpen(false)
    markHintUsed(runRef.current.id)
    setHintGone(hintsUsed())
  }, [])
  const panelOpen = inspecting !== null || journalOpen || answerOpen || clockOpen || objectOpen !== null || hintOpen
  /** The journal and the answer cover the whole room; the other panels sit beside a zoomed-in view of it. */
  const roomCovered = journalOpen || answerOpen
  // the candle keeps lighting the room while a portrait, the clock or an object is zoomed in
  useEffect(() => { sceneRef.current?.setTorch(torch && !roomCovered) }, [torch, roomCovered])
  // The examine panel is centred on the left; on a short screen the question bar's bottom can
  // reach it. Then the panel moves down to just below the bar (and scrolls if it is too tall).
  useEffect(() => {
    if (!panelOpen || roomCovered) return
    let raf = 0
    const fit = () => {
      raf = window.requestAnimationFrame(fit)
      const panel = document.querySelector<HTMLElement>('.hall-stage .note-panel')
      const bar = document.querySelector<HTMLElement>('.hall-stage .question-bar')
      if (!panel) return
      const gap = 12
      const p = panel.getBoundingClientRect()
      const prev = parseFloat(panel.style.marginTop) || 0
      const top = p.top - prev                   // where the panel sits with no shift
      const b = bar && getComputedStyle(bar).display !== 'none' ? bar.getBoundingClientRect() : null
      const overlapsX = !!b && b.left < p.right && b.right > p.left
      const shift = overlapsX && b ? Math.max(0, b.bottom + gap - top) : 0
      if (Math.abs(shift - prev) > 0.5) panel.style.marginTop = shift ? `${shift}px` : ''
      const room = window.innerHeight - gap - (top + shift)
      panel.style.maxHeight = shift ? `${Math.max(120, room)}px` : ''
      panel.style.overflowY = shift ? 'auto' : ''
    }
    raf = window.requestAnimationFrame(fit)
    return () => window.cancelAnimationFrame(raf)
  }, [panelOpen, roomCovered])

  // Keep the keyboard hotspots sitting over their objects.
  useEffect(() => {
    if (phase !== 'play' || panelOpen) return
    let raf = 0
    const tick = () => {
      const scene = sceneRef.current
      if (scene) {
        hotspots.forEach((target, i) => {
          const el = hotspotRefs.current[i]
          if (!el) return
          const { x, y } = scene.anchor(target)
          el.style.left = `${x}px`
          el.style.top = `${y}px`
        })
      }
      raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [phase, panelOpen, hotspots.length])

  // Pressing ANSWER is the one chance: the panel can't be closed again, and
  // the answer must be given within rules.answerWindow seconds.
  const openAnswer = useCallback(() => {
    if (answerOpen) return
    // other panels close; the hall stays as it is behind the answer
    setInspecting(null)
    sceneRef.current?.inspect(null)
    setClockOpen(false)
    sceneRef.current?.inspectClock(false)
    setJournalOpen(false)
    setObjectOpen(null)
    sceneRef.current?.inspectObject(null)
    // what was entered before stepping back is kept
    setGiven(g => (run.kind === 'word' ? (g.length === wordLen ? g : 'A'.repeat(wordLen)) : g))
    setConfirming(false)
    setAnswerLeft(rules.answerWindow)
    setAnswerOpen(true)
    // the player found the ANSWER button: Grandfather's guide is done
    finishGuide()
  }, [run.kind, answerOpen, wordLen, finishGuide])

  const openTarget = useCallback((t: HallTarget) => {
    setHover(null)
    sceneRef.current?.setHover(null)
    if (t.kind === 'portrait') {
      setInspecting(t.index)
      sceneRef.current?.inspect(t.index)
    } else if (t.kind === 'clock') {
      setClockOpen(true)
      sceneRef.current?.inspectClock(true)
    } else if (t.kind === 'journal') setJournalOpen(true)
    else if (t.kind === 'object') {
      setObjectOpen(t.id)
      sceneRef.current?.inspectObject(t.id)
    } else openAnswer()
  }, [openAnswer])

  /** Closes the examine panels. The answer panel never closes this way: once opened, it must be answered. */
  const closePanels = useCallback(() => {
    setInspecting(null)
    sceneRef.current?.inspect(null)
    setClockOpen(false)
    sceneRef.current?.inspectClock(false)
    setJournalOpen(false)
    setObjectOpen(null)
    sceneRef.current?.inspectObject(null)
  }, [])

  // Pointer: hover prompts and clicks in the hall.
  const onMove = (e: React.PointerEvent) => {
    const scene = sceneRef.current
    if (!scene) return
    scene.setPointer(e.clientX, e.clientY)
    lastPos.current = { x: e.clientX, y: e.clientY }
    // carried just right of and below the pointer's tip, so the tip stays free to click
    if (torchRef.current) torchRef.current.style.transform = `translate(${e.clientX + 16}px, ${e.clientY + 22}px)`
    if (phase !== 'play' || panelOpen) return
    const t = examinable(scene.pick(e.clientX, e.clientY))
    scene.setHover(t)
    setHover(t ? { target: t, ...scene.anchor(t) } : null)
  }
  const onClick = (e: React.MouseEvent) => {
    if (phase !== 'play' || panelOpen) return
    // on a phone the question covers much of the room: touching the room folds it to one line
    if (smallScreen()) setQFolded(true)
    const t = examinable(sceneRef.current?.pick(e.clientX, e.clientY))
    if (t) openTarget(t)
  }
  /**
   * One click on something that does something, one typewriter key strike (HallScene.keyStrike). Heard in the capture phase,
   * before any panel stops the click, so every button counts once (a disabled button gets no
   * click at all); a click on the room counts only when it lands on something to examine.
   */
  const onClickSound = (e: React.MouseEvent) => {
    const el = e.target as Element
    const scene = sceneRef.current
    if (!scene) return
    if (el.closest('button, [role="button"], .wheels span')) { scene.keyStrike(); return }
    if (el === canvasRef.current && phase === 'play' && !panelOpen && examinable(scene.pick(e.clientX, e.clientY))) scene.keyStrike()
  }

  // ── the one-chance answer ────────────────────────────────────────────────
  const canSubmit = run.kind === 'number' ? given.length > 0
    : run.kind === 'word' ? given.length === wordLen
    : run.kind === 'sequence' ? given.split('-').filter(Boolean).length === (roomRun?.slots ?? 4)
    : given !== ''
  /** An answer as the player reads it: a portrait's or an option's name, signs in order. */
  const answerText = (a: string) => {
    if (!a) return a
    if (run.kind === 'portrait') return portraitName(a as PortraitId)
    const label = (id: string) => roomRun?.options?.find(o => o.id === id)?.label ?? id
    if (run.kind === 'choice') return label(a)
    if (run.kind === 'sequence') return a.split('-').map(label).join(' → ')
    return a
  }
  const shownAnswer = answerText(given)

  /** Steps back from the answer panel to look again; what was entered is kept. */
  const closeAnswer = () => { setConfirming(false); setAnswerOpen(false) }

  const confirmAnswer = useCallback(() => {
    setConfirming(false)
    setAnswerOpen(false)
    if (isRoomRun(run) ? checkRoomAnswer(run, given) : checkAnswer(run, given)) {
      setPhase('won')
      sceneRef.current?.solve()
      stageWon()
    } else {
      die('wrong')
    }
  }, [run, given, die, stageWon])

  const wheel = (i: number, step: number) => setGiven(g => {
    const k = (ALPHABET.indexOf(g[i]) + step + 26) % 26
    return g.slice(0, i) + ALPHABET[k] + g.slice(i + 1)
  })
  const [wheelFocus, setWheelFocus] = useState(0)
  /** When "Is this your answer?" opened: YES ignores clicks in the first 0.4 s, so a double click or a held key can't answer for you. */
  const confirmOpenedAt = useRef(0)
  const [confirmReady, setConfirmReady] = useState(false)
  useEffect(() => {
    if (!confirming) { setConfirmReady(false); return }
    const id = window.setTimeout(() => setConfirmReady(true), 400)
    return () => window.clearTimeout(id)
  }, [confirming])

  // Keyboard: E inspect, J journal, Esc close; digits and letters in the answer panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ph = phaseRef.current
      if (ph !== 'play') return
      const k = e.key.toLowerCase()
      if (k === 'escape') {
        if (confirming) setConfirming(false)
        else if (answerOpen) closeAnswer()
        else if (hintOpen) closeHint()
        else closePanels()
        return
      }
      if (answerOpen && !confirming) {
        if (run.kind === 'number') {
          if (/^[0-9]$/.test(e.key)) setGiven(g => (g.length < numLen ? g + e.key : g))
          else if (e.key === 'Backspace') setGiven(g => g.slice(0, -1))
        } else if (run.kind === 'word') {
          if (/^[a-z]$/i.test(e.key)) {
            const L = e.key.toUpperCase()
            setGiven(g => g.slice(0, wheelFocus) + L + g.slice(wheelFocus + 1))
            setWheelFocus(f => Math.min(wordLen - 1, f + 1))
          } else if (e.key === 'ArrowLeft') setWheelFocus(f => Math.max(0, f - 1))
          else if (e.key === 'ArrowRight') setWheelFocus(f => Math.min(wordLen - 1, f + 1))
          else if (e.key === 'ArrowUp') { e.preventDefault(); wheel(wheelFocus, 1) }
          else if (e.key === 'ArrowDown') { e.preventDefault(); wheel(wheelFocus, -1) }
        }
        if (e.key === 'Enter') {
          // the key must not also "click" whatever gets focus next (the YES button)
          e.preventDefault()
          if (canSubmit && !e.repeat) { confirmOpenedAt.current = performance.now(); setConfirming(true) }
        }
        return
      }
      if (k === 'c' && !answerOpen) setTorch(t => !t)
      else if (k === 'a' && !panelOpen) openAnswer()
      else if (k === 'j' && isHall) setJournalOpen(o => !o)
      else if (k === 'e' && hover && !panelOpen) openTarget(hover.target)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hover, panelOpen, openTarget, openAnswer, closePanels, showQuestion, answerOpen, confirming, run.kind, wheelFocus, canSubmit, numLen, wordLen, isHall])

  const objectLabel = (id: string) => ROOMS[roomId].objects.find(o => o.id === id)?.label ?? id
  /** The notes panel goes on the side away from the object, so it never covers what is being read. */
  const objectOnLeft = (id: string) => {
    const o = ROOMS[roomId].objects.find(z => z.id === id)
    return !!o && (o.rect[0] + o.rect[2]) / 2 < ROOMS[roomId].art.w * 0.5
  }
  const targetLabel = (t: HallTarget) =>
    t.kind === 'portrait'
      ? `Portrait ${t.index + 1} of 4 — look closely`
      : t.kind === 'clock' ? 'The wall clock — look closely'
      : t.kind === 'object' ? `${objectLabel(t.id)} — look closely`
      : 'Torn journal page — read it'

  // the portrait in the inspected slot (Who Moved? can rehang them)
  const portrait = hallRun && inspecting !== null ? PORTRAITS.find(p => p.id === wallNow[inspecting]) ?? null : null
  const crookedNote = !!hallRun && inspecting !== null && phase === 'play' && hallRun.id === 'moved' && hallRun.scene.crooked.includes(inspecting)
  // the journal, with the Marked Page's blood marks: one span per marked letter
  const markAt = new Map((hallRun?.scene.marks ?? []).map(m => [m.index, m.kind]))
  let textAt = 0
  const journalLines = JOURNAL.lines.map(line => {
    const start = textAt
    textAt += line.length + 1                     // the joining space (JOURNAL_TEXT)
    if (!markAt.size) return line
    return [...line].map((ch, i) => {
      const kind = markAt.get(start + i)
      return kind ? <span key={i} className={`jmark is-${kind}`} aria-label={kind === 'blot' ? 'a letter hidden under a blot' : kind === 'circle' ? `a letter circled in blood: ${ch}` : undefined}>{ch}</span> : ch
    })
  })
  void JOURNAL_TEXT
  const journalScratch = hallRun?.scene.scratches.find(s => s.surface === 'journal') ?? null
  const portraitNotes = portrait && hallRun ? hallRun.scene.notes[portrait.id] ?? portrait.details : []
  const objectNotes = objectOpen && roomRun ? roomRun.setup.notes[objectOpen] ?? [] : []
  /** A scratch, said in words when its surface is inspected (the painted one is small). */
  const scratchSaid = (surface: string) => {
    const s = hallRun?.scene.scratches.find(x => x.surface === surface)
    if (!s) return null
    const where = surface === 'clock' ? 'into the brass rim of the clock' : 'into the bottom of the frame'
    return s.number !== null
      ? `Scratched ${where}: the letter ${s.letter}, with the number ${s.number} beside it.`
      : `Scratched ${where}: the letter ${s.letter}. There is no number beside it.`
  }
  const portraitScratch = portrait ? scratchSaid(`frame-${portrait.id}`) : null
  const clockScratch = scratchSaid('clock')
  const mins = Math.floor(timeLeft / 60)
  const secs = String(timeLeft % 60).padStart(2, '0')
  const hoverLabel = hover
    ? hover.target.kind === 'portrait' ? 'Look at the portrait'
      : hover.target.kind === 'clock' ? 'Look at the clock'
      : hover.target.kind === 'object' ? `Look at ${objectLabel(hover.target.id).replace(/^The /, 'the ').replace(/^A /, 'a ')}`
      : 'Read the torn page'
    : ''
  const kindLine = run.kind === 'number' ? (numLen === 4 ? 'The answer is a year.' : 'The answer is a number.')
    : run.kind === 'word' ? `The answer is a ${wordLen === 5 ? 'five' : wordLen}-letter word.`
    : run.kind === 'choice' ? 'Choose one.'
    : run.kind === 'sequence' ? `Put the ${roomRun?.slots ?? 4} signs in order.`
    : 'The answer is one of the four portraits.'
  const memoriseText = roomRun
    ? { label: 'REMEMBER THE SHELVES', line: 'Look at the shelves left of the ladder. Remember where books are missing.' }
    : { label: 'REMEMBER THE WALL', line: 'Look at the four portraits. Remember who hangs where.' }

  return (
    <div
      className={`hall-stage ${hover ? 'has-hover' : ''} ${torch && phase === 'play' ? 'is-torch' : ''} ${panelOpen ? 'has-panel' : ''}`}
      onPointerMove={onMove}
      onPointerDown={onMove}
      onClickCapture={onClickSound}
      onClick={onClick}
    >
      <canvas ref={canvasRef} className="hall-stage-canvas" />

      {(phase === 'play' || phase === 'memorise') && (
        <button type="button" className={`candle-tool ${torch ? 'is-on' : ''} ${guide === 'candle' && phase === 'play' ? 'is-beckoned' : ''}`} aria-pressed={torch}
          onPointerDown={e => {
            // one press picks the candle up: it follows the pointer at once, so press and drag in one go
            onMove(e)
            // (a drag that ended off the button never clicked it, so the flag is reset on every press)
 pickedNow.current = !torch
 if (!torch) setTorch(true)
            // a finger keeps moving the candle, not the button
            ;(e.target as Element).releasePointerCapture?.(e.pointerId)
          }}
          onClick={e => { e.stopPropagation(); if (pickedNow.current) { pickedNow.current = false; return } setTorch(t => !t) }} title={`Carry the candle to light the room${kb('C')}`}>
          <span className="candle-body" aria-hidden="true"><span className="candle-flame" /></span>
          <span className="candle-label">{torch ? (TOUCH ? 'PUT IT DOWN' : `PUT THE CANDLE DOWN${kb('C')}`) : `CANDLE${kb('C')}`}</span>
        </button>
      )}
      {torch && !roomCovered && (phase === 'play' || phase === 'memorise') && <div className="torch-cursor" ref={placeTorch} aria-hidden="true"><span className="candle-flame" /></div>}

      {(phase === 'title' || (phase === 'between' && nextTitle)) && (
        <div className={`stage-title ${phase === 'between' ? 'is-between' : ''}`} role="status" aria-live="polite">
          <div className="stage-title-num">LEVEL {levelId} · STAGE {stageNo}</div>
          <h1 className="stage-title-name">{STAGE_TITLES[run.id] ?? level.name}</h1>
        </div>
      )}

      {phase === 'memorise' && !blackout && (
        <div className="memorise" role="status" aria-live="assertive">
          <div className="question-label">{memoriseText.label}</div>
          <p>{memoriseText.line}</p>
          {roomRun && <p className="memorise-question">{run.question}</p>}
          <p className="memorise-left">The lights go out in {memLeft} s. The stage clock starts after the dark.</p>
          <button type="button" className="memorise-ready" onClick={e => { e.stopPropagation(); memEnd.current?.() }}>I'M READY: PUT THE LIGHTS OUT</button>
        </div>
      )}

      <div className={`blackout ${blackout ? 'is-on' : ''}`} aria-hidden="true" />

      {(phase === 'play' || phase === 'memorise') && (
        <button type="button" className={`music-tool ${musicOn ? '' : 'is-off'}`} aria-pressed={musicOn} onClick={e => { e.stopPropagation(); toggleMusic() }}
          aria-label={musicOn ? 'Music on: turn it off' : 'Music off: turn it on'} title={musicOn ? 'Turn the music off' : 'Turn the music on'}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 17.5V5.5l10-2v12" />
            <circle cx="6.5" cy="17.5" r="2.5" /><circle cx="16.5" cy="15.5" r="2.5" />
            {!musicOn && <path className="music-slash" d="M3 3l18 18" />}
          </svg>
        </button>
      )}

      {phase === 'play' && (
        <div className={`question-bar ${sideBar ? 'is-side' : ''} ${qFolded ? 'is-folded' : ''}`} onClick={e => { e.stopPropagation(); if (smallScreen() && !(e.target as HTMLElement).closest('button')) setQFolded(true) }} role="region" aria-label="The question">
          <div className="question-top">
            <span className="question-stage">L{levelId} · S{stageNo}</span>
            <span className="question-label">THE HOUSE ASKS</span>
            <span className={`s1-time ${timeLeft <= rules.warnAt ? 'is-low' : ''}`} aria-label={`${timeLeft} seconds left`}>{mins}:{secs}</span>
            <span className="s1-chance">ONE CHANCE</span>
            {isHall && <button type="button" className="s1-journal" onClick={() => setJournalOpen(o => !o)}>JOURNAL{kb('J')}</button>}
            <button type="button" className="q-fold" aria-expanded={!qFolded} onClick={() => setQFolded(v => !v)}>{qFolded ? 'SHOW QUESTION ▾' : 'HIDE ▴'}</button>
          </div>
          <p className="question-text">{run.question}</p>
          <p className="question-kind">{kindLine}</p>
          {hintAvailable && !hintOpen && (
            <button type="button" className="hint-button" onClick={e => { e.stopPropagation(); closePanels(); setHintOpen(true) }}>
              HINT: WHERE TO LOOK (you can read it once)
            </button>
          )}
          {guide === 'candle' ? (
            <p className="question-candle ghost-guide-line" role="status" aria-live="polite">
              <span className="ghost-guide-who">GRANDFATHER'S GHOST</span> {guideText.candle}{' '}
              <button type="button" className="ghost-guide-ok" onClick={e => { e.stopPropagation(); setGuide('answer') }}>I CAN SEE FINE</button>
            </p>
          ) : (
            <p className="question-candle">{TOUCH
              ? 'Too dark to see? Tap the candle at the top left, then drag your finger: its light follows it. Tap things to look at them.'
              : 'Too dark to see? Pick up the candle at the top left [C]: its light follows your mouse, and you can still click everything.'}</p>
          )}
          {guide === 'answer' && (
            <p className="ghost-guide-line" role="status" aria-live="polite">
              <span className="ghost-guide-who">GRANDFATHER'S GHOST</span> {guideText.answer}{' '}
              <button type="button" className="ghost-guide-ok" onClick={e => { e.stopPropagation(); finishGuide() }}>GOT IT</button>
            </p>
          )}
          <button type="button" className={`lock-turn answer-button ${guide === 'answer' ? 'is-beckoned' : ''}`} onClick={openAnswer} disabled={answerOpen}>
            ANSWER{kb('A')}
          </button>
          <p className="answer-note">You can look at your answer and step back. Once you press YES, there is no going back.</p>
        </div>
      )}

      {phase === 'play' && !panelOpen && (
        <div className="hall-targets" aria-label="Things to examine in the hall">
          {hotspots.map((target, i) => (
            <button
              key={target.kind === 'portrait' ? `p${target.index}` : target.kind === 'object' ? target.id : target.kind}
              ref={el => { hotspotRefs.current[i] = el }}
              type="button"
              className="hall-target"
              aria-label={targetLabel(target)}
              onFocus={() => {
                const scene = sceneRef.current
                if (!scene) return
                scene.setHover(target)
                setHover({ target, ...scene.anchor(target) })
              }}
              onBlur={() => {
                sceneRef.current?.setHover(null)
                setHover(null)
              }}
              onClick={e => { e.stopPropagation(); openTarget(target) }}
            />
          ))}
        </div>
      )}

      {phase === 'play' && !panelOpen && hover && (
        <div className="hall-prompt" style={{ left: hover.x, top: hover.y }}>
          <span className="key">E</span> {hoverLabel}
        </div>
      )}

      {message && phase !== 'dead' && <div className="hall-message">{message}</div>}

      {hintOpen && hint && phase === 'play' && (
        <>
          <div className="hint-marks" aria-hidden="true">
            {hint.targets.map((t, i) => {
              const a = sceneRef.current?.hintPoint(t)
              return a ? <span key={i} className="hint-mark" style={{ left: a.x, top: a.y }} /> : null
            })}
          </div>
          <aside className="note-panel hint-panel" onClick={e => e.stopPropagation()} role="dialog" aria-label="Hint">
            <div className="note-plaque">WHERE TO LOOK</div>
            <ul>{hint.lines.map(l => <li key={l}>{l}</li>)}</ul>
            <p className="note-sub">The glowing rings mark these places. This hint will not show again.</p>
            <button type="button" className="panel-close" onClick={closeHint}>GOT IT, CLOSE{kb('Esc')}</button>
          </aside>
        </>
      )}

      {portrait && (
        <aside className="note-panel" onClick={e => e.stopPropagation()}>
          <div className="note-plaque">{portrait.plaque}</div>
          <p className="note-sub">The brass name plate is too corroded to read.</p>
          <ul>
            {portraitNotes.map(d => <li key={d}>{d}</li>)}
            {portraitScratch && <li className="note-scratch">{portraitScratch}</li>}
            {crookedNote && <li className="note-crooked">The frame hangs crooked, as if it was moved a moment ago.</li>}
          </ul>
          <p className="note-eyes">Its eyes follow you.</p>
          <button type="button" className="panel-close" onClick={closePanels}>STEP BACK{kb('Esc')}</button>
        </aside>
      )}

      {objectOpen && (
        <aside className={`note-panel ${objectOnLeft(objectOpen) ? 'is-right' : ''}`} onClick={e => e.stopPropagation()} aria-label={objectLabel(objectOpen)}>
          <div className="note-plaque">{objectLabel(objectOpen).toUpperCase()}</div>
          <ul>
            {objectNotes.map((d, i) => <li key={i}>{noteLine(d)}</li>)}
          </ul>
          <button type="button" className="panel-close" onClick={closePanels}>STEP BACK{kb('Esc')}</button>
        </aside>
      )}

      {subtitle && subtitle.text && (
        <div key={subtitle.n} className={`subtitle ${sideBar ? 'is-top' : ''}`} role="status" aria-live="assertive">{subtitle.text}</div>
      )}

      {clockOpen && (
        <aside className="note-panel" onClick={e => e.stopPropagation()}>
          <div className="note-plaque">ASHWORTH · LONDON</div>
          <ul>
            <li>A brass wall clock. Its glass is cracked and furred with dust.</li>
            <li>The hands have not moved in a very long time.</li>
            <li>No ticking. Only the sound of your own breathing.</li>
            {clockScratch && <li className="note-scratch">{clockScratch}</li>}
          </ul>
          <button type="button" className="panel-close" onClick={closePanels}>STEP BACK{kb('Esc')}</button>
        </aside>
      )}

      {journalOpen && (
        <div className="panel-backdrop" onClick={e => { e.stopPropagation(); setJournalOpen(false) }}>
          <article className="journal" onClick={e => e.stopPropagation()}>
            <h2>{JOURNAL.title}</h2>
            {journalLines.map((l, i) => <p key={i} className={i === JOURNAL.lines.length - 1 ? 'journal-last' : ''}>{l}</p>)}
            {journalScratch && (
              <span className="journal-scratch" style={{ left: `${12 + journalScratch.u * 70}%`, top: `${20 + journalScratch.v * 55}%` }} aria-label="A letter scratched into the paper">
                {journalScratch.letter}{journalScratch.number !== null && <sub>{journalScratch.number}</sub>}
              </span>
            )}
            <button type="button" className="panel-close" onClick={() => setJournalOpen(false)}>CLOSE{kb('Esc')}</button>
          </article>
        </div>
      )}

      {answerOpen && (
        <div className="panel-backdrop" onClick={e => e.stopPropagation()}>
          <section className="lock" onClick={e => e.stopPropagation()} aria-label="Your answer">
            <h2>Your answer</h2>
            <p className="lock-plate">“{run.question}”</p>
            <p className="lock-help">{kindLine}</p>

            {run.kind === 'number' && (
              <div className="answer-number">
                <div className="answer-display" aria-live="polite">{given || '—'}</div>
                <div className="keypad">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map(d => (
                    <button key={d} type="button" className="key-btn" onClick={() => setGiven(g => (g.length < numLen ? g + d : g))}>{d}</button>
                  ))}
                  <button type="button" className="key-btn key-clear" onClick={() => setGiven('')}>CLEAR</button>
                </div>
              </div>
            )}

            {run.kind === 'word' && (<>
              <p className="lock-help">{TOUCH ? 'Tap ▲ and ▼ to change each letter.' : 'Type the word on your keyboard, or use ▲ and ▼ to change each letter.'}</p>
              <div className="wheels" role="group" aria-label={`${wordLen} letter wheels`}>
                {given.split('').map((L, i) => (
                  <div key={i} className={`wheel ${i === wheelFocus ? 'is-focus' : ''}`}>
                    <button type="button" aria-label={`Letter ${i + 1}: next letter`} onClick={() => { setWheelFocus(i); wheel(i, 1) }}>▲</button>
                    <span onClick={() => setWheelFocus(i)}>{L}</span>
                    <button type="button" aria-label={`Letter ${i + 1}: previous letter`} onClick={() => { setWheelFocus(i); wheel(i, -1) }}>▼</button>
                  </div>
                ))}
              </div>
            </>)}

            {run.kind === 'portrait' && (
              <div className="lock-faces">
                {PORTRAITS.map(p => (
                  <button key={p.id} type="button" data-id={p.id} className={`lock-face ${given === p.id ? 'is-chosen' : ''}`}
                    aria-pressed={given === p.id} aria-label={portraitName(p.id)} onClick={() => setGiven(p.id)}>
                    <img src={p.image} alt="" />
                    <span>{portraitName(p.id)}</span>
                  </button>
                ))}
              </div>
            )}

            {run.kind === 'choice' && roomRun?.options && (
              <ChoicePanel options={roomRun.options} value={given} onPick={setGiven} />
            )}

            {run.kind === 'sequence' && roomRun?.options && (
              <SequencePanel options={roomRun.options} slots={roomRun.slots ?? 4} value={given} onChange={setGiven} />
            )}

            <div className="lock-actions">
              <button type="button" className="panel-close answer-back" onClick={closeAnswer}>BACK TO THE ROOM{kb('Esc')}</button>
              <button type="button" className="lock-turn" disabled={!canSubmit} onClick={() => { confirmOpenedAt.current = performance.now(); setConfirming(true) }}>GIVE THIS ANSWER</button>
            </div>
            <p className="lock-warn">One chance. A wrong answer is the end of Arjun.</p>

            {confirming && (
              <div className="confirm" role="alertdialog" aria-label="Confirm your answer">
                <p>You have <b>one chance</b>. Is this your answer?</p>
                <div className="confirm-answer">{shownAnswer}</div>
                <div className="lock-actions">
                  <button type="button" className="panel-close" onClick={() => setConfirming(false)}>NOT YET</button>
                  <button type="button" className="lock-turn" disabled={!confirmReady} onClick={confirmAnswer}>YES</button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {phase === 'won' && (
        <div className="stage-clear" role="status" aria-live="polite">
          <div className="stage-title-num">STAGE {stageNo} CLEARED</div>
          <p>{run.explain}</p>
        </div>
      )}

      {phase === 'treasure' && treasure && (
        <div className="reward" onClick={e => e.stopPropagation()} role="dialog" aria-label="Treasure found">
          <div className="stage-title-num">LEVEL {levelId} COMPLETE</div>
          <div className={`treasure-art is-${treasure}`} style={{ backgroundImage: `url(${TREASURES[treasure].image})` }} aria-hidden="true" />
          <h2 className="treasure-name">{TREASURES[treasure].name}</h2>
          <p>{TREASURES[treasure].line}</p>
          <p className="reward-order">{run.explain}</p>
          <p className="reward-next">
            {LEVELS[progRef.current.level].ready ? `Next: Level ${progRef.current.level} · ${LEVELS[progRef.current.level].name}.` : `Level ${progRef.current.level} · ${LEVELS[progRef.current.level].name} is coming soon.`}
          </p>
          {guest && <p className="reward-guest">You are playing as a guest. Choose SAVE MY PROGRESS on the landing page to keep this treasure and join the leaderboard.</p>}
          {onNextLevel && playable(progRef.current.level)
            ? <button type="button" className="lock-turn" onClick={() => onNextLevel()}>ENTER {LEVELS[progRef.current.level].name.toUpperCase()}</button>
            : <button type="button" className="lock-turn" onClick={() => exitRef.current()}>CONTINUE</button>}
        </div>
      )}

      {gameOver && (
        <div className="game-over" role="alert">
          <h1>GAME OVER</h1>
          <p className="game-over-line">{deathNote?.line ?? 'The house keeps what it catches.'}</p>
          {deathNote?.count && <p className="game-over-count">{deathNote.count}</p>}
          <p className="game-over-restart">You will start Level {levelId} again from Stage 1.</p>
          <p className="game-over-answer">The answer was <b>{answerText(run.answer)}</b>. {run.explain}</p>
          {deathNote && <p className="game-over-tip">{deathNote.tip}</p>}
        </div>
      )}

      <style>{`
        @font-face {
          font-family: 'Creepster';
          src: url('/fonts/Creepster-Regular.ttf') format('truetype');
          font-display: block;
        }
        .hall-stage { position: fixed; inset: 0; background: #000; overflow: hidden; cursor: default; font-family: Georgia, 'Times New Roman', serif; }
        .hall-stage.has-hover { cursor: pointer; }
        .hall-stage-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
        .candle-tool { position: absolute; left: .875rem; top: .875rem; z-index: 21; display: flex; align-items: center; gap: .625rem; cursor: pointer;
          padding: .5rem .875rem .5rem .625rem; font: .75rem Georgia, serif; letter-spacing: .18em; color: #f3e2c0;
          background: rgba(10, 7, 5, .72); border: 1px solid rgba(240, 180, 90, .45); }
        .candle-tool.is-on { border-color: #f0b356; box-shadow: 0 0 1.125rem rgba(240, 160, 60, .45); }
        .candle-body { position: relative; width: .5625rem; height: 1.375rem; border-radius: 2px; background: linear-gradient(90deg, #d8c9a4, #f5ecd2 45%, #b9a77c); }
        .candle-flame { position: absolute; left: 50%; bottom: 100%; width: .5625rem; height: .875rem; margin-left: -.2813rem; border-radius: 50% 50% 45% 45% / 65% 65% 35% 35%;
          background: radial-gradient(ellipse at 50% 70%, #fff8d8 0%, #ffd46a 35%, #ff8a1c 70%, rgba(255, 80, 0, 0) 100%);
          filter: drop-shadow(0 0 .375rem rgba(255, 170, 60, .9)); animation: candleFlicker 1.3s ease-in-out infinite; }
        .candle-tool.is-on .candle-flame { opacity: .35; }
        @keyframes candleFlicker { 0%, 100% { transform: scale(1); } 40% { transform: scale(.94, 1.06); } 70% { transform: scale(1.04, .96); } }
        .torch-cursor { position: fixed; left: 0; top: 0; z-index: 17; pointer-events: none; width: 0; height: 0; }
        .torch-cursor .candle-flame { width: .75rem; height: 1.1875rem; margin-left: -.375rem; bottom: .375rem; }
        .torch-cursor::after { content: ''; position: absolute; left: -.3125rem; top: -.375rem; width: .625rem; height: 1.625rem; border-radius: 2px; background: linear-gradient(90deg, #cdbd96, #f5ecd2 45%, #a8966c); }
        .question-candle { margin: .25rem 0 0; font-size: .75rem; color: #f0c27a; }
        /* Grandfather's ghost: a whisper in spectral blue (the supernatural colour), once per browser */
        .ghost-guide-line { margin: .375rem 0 0; font: italic .8125rem Georgia, serif; color: #b9e6ff; text-shadow: 0 0 .5rem rgba(110, 190, 255, .7);
          animation: ghostIn 1.2s ease both; }
        .question-candle.ghost-guide-line { font-size: .8125rem; color: #b9e6ff; }
        .ghost-guide-who { font: normal .75rem Georgia, serif; letter-spacing: .12em; color: #7fc4ff; margin-right: .25rem; }
        .ghost-guide-ok { font: .75rem Georgia, serif; letter-spacing: .08em; color: #b9e6ff; background: transparent; cursor: pointer;
          border: 1px solid rgba(127, 196, 255, .6); border-radius: 3px; padding: .125rem .5rem; margin-left: .25rem; }
        .ghost-guide-ok:hover { color: #fff; border-color: #b9e6ff; }
        .candle-tool.is-beckoned, .answer-button.is-beckoned { animation: ghostBeckon 1.8s ease-in-out infinite; }
        @keyframes ghostIn { from { opacity: 0; filter: blur(3px); } to { opacity: 1; filter: none; } }
        @keyframes ghostBeckon { 50% { box-shadow: 0 0 1.25rem rgba(110, 190, 255, .75); } }
        @media (prefers-reduced-motion: reduce) { .ghost-guide-line, .candle-tool.is-beckoned, .answer-button.is-beckoned { animation: none; } }
        .hall-skip {
          position: absolute; right: clamp(1.125rem, 3vw, 2.75rem); bottom: clamp(1.125rem, 4vh, 2.5rem); z-index: 20;
          font: .75rem Georgia, serif; letter-spacing: .2em; color: rgba(243, 233, 215, .7);
          background: rgba(7, 9, 12, .35); border: 1px solid rgba(243, 218, 172, .3); padding: .4375rem .875rem; cursor: pointer;
        }
        .stage-title {
          position: absolute; left: 0; right: 0; top: 13vh; display: grid; justify-items: center; text-align: center;
          pointer-events: none; font-family: 'Creepster', Georgia, serif; color: #c8141b;
          text-shadow: 2px 2px 0 #1a0000, -1px -1px 0 #1a0000, 0 0 .875rem rgba(160, 0, 0, .65), 0 0 2.5rem rgba(90, 0, 0, .55);
          animation: titleOut ${TITLE_MS}ms ease both;
        }
        .stage-title-num { font-family: 'Creepster', Georgia, serif; font-size: clamp(2.125rem, 5vw, 4.5rem); letter-spacing: .08em; line-height: 1; color: #c8141b;
          text-shadow: 2px 2px 0 #1a0000, -1px -1px 0 #1a0000, 0 0 .875rem rgba(160, 0, 0, .65), 0 0 2.5rem rgba(90, 0, 0, .55);
          animation: bleedIn 1.6s cubic-bezier(.2, .7, .2, 1) both; }
        .stage-title-name { margin: .25em 0 0; font-weight: normal; font-size: clamp(1.875rem, 4.6vw, 4.125rem); letter-spacing: .04em; line-height: 1;
          animation: bleedIn 1.8s cubic-bezier(.2, .7, .2, 1) .45s both; }
        @keyframes bleedIn {
          0% { opacity: 0; clip-path: inset(0 0 100% 0); filter: blur(.1875rem); transform: translateY(-.375rem); }
          40% { opacity: 1; }
          100% { opacity: 1; clip-path: inset(0 0 -20% 0); filter: none; transform: none; }
        }
        @keyframes titleOut { 0%, 82% { opacity: 1; } 100% { opacity: 0; } }

        /* The question stays pinned at the top of the hall for the whole stage. */
        .question-bar { position: absolute; left: 50%; top: .875rem; transform: translateX(-50%); z-index: 18; width: min(47.5rem, 92vw);
          text-align: center; color: #efe3cb; padding: .75rem 1.375rem .875rem; animation: fadeIn .8s ease both;
          background: linear-gradient(180deg, rgba(8, 6, 5, .86), rgba(8, 6, 5, .7)); border: 1px solid rgba(200, 20, 27, .4);
          box-shadow: 0 0 2.5rem rgba(110, 0, 0, .25), 0 .75rem 2.5rem rgba(0, 0, 0, .6); }
        .question-bar.is-side { left: auto; right: .875rem; transform: none; width: min(25rem, 30vw); padding: .625rem .875rem .75rem; }
        .question-bar.is-side .question-text { font-size: .9375rem; }
        .is-side ~ .subtitle, .subtitle.is-top { bottom: auto; top: 1.25rem; }
        .question-top { display: flex; align-items: center; justify-content: center; gap: .875rem; flex-wrap: wrap; }
        .question-label { font-family: 'Creepster', Georgia, serif; font-size: clamp(1.25rem, 2.2vw, 1.75rem); letter-spacing: .08em; color: #c8141b;
          text-shadow: 2px 2px 0 #1a0000, 0 0 .875rem rgba(160, 0, 0, .65); }
        .question-text { font-size: clamp(.9375rem, 1.5vw, 1.125rem); line-height: 1.45; margin: .5rem 0 .25rem; }
        .question-kind { font-size: .8125rem; font-style: italic; color: #c9a45e; margin: 0; }
        .answer-button { margin-top: .625rem; }
        /* while something is zoomed in, the bar keeps only the question, so the panel beside it has room */
        .hall-stage.has-panel .question-candle, .hall-stage.has-panel .answer-note, .hall-stage.has-panel .hint-button { display: none; }
        .answer-note { margin: .375rem 0 0; font-size: .75rem; letter-spacing: .06em; color: rgba(224, 69, 58, .85); }
        .answer-clock { position: absolute; right: 1.375rem; top: 1rem; font: 2.125rem Georgia, serif; color: #f0b356; font-variant-numeric: tabular-nums;
          text-shadow: 0 0 .75rem rgba(240, 150, 60, .5); }
        .answer-clock.is-low { color: #e0453a; animation: pulse .6s ease-in-out infinite; }

        /* the music switch: a small note at the bottom left; struck through when off */
        .music-tool { position: absolute; left: clamp(1.125rem, 3vw, 2.75rem); bottom: clamp(1.125rem, 4vh, 2.5rem); z-index: 20; width: 2.5rem; height: 2.5rem;
          display: grid; place-items: center; padding: 0; cursor: pointer; border-radius: 50%; background: rgba(10, 12, 12, .5); border: 1px solid rgba(236, 210, 160, .35); }
        .music-tool svg { width: 1.25rem; height: 1.25rem; fill: none; stroke: #f0b356; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
        .music-tool circle { fill: #f0b356; }
        .music-tool.is-off svg { stroke: rgba(236, 226, 205, .55); }
        .music-tool.is-off circle { fill: rgba(236, 226, 205, .55); }
        .music-tool .music-slash { stroke: #e0453a; stroke-width: 2; }
        .music-tool:hover, .music-tool:focus-visible { border-color: rgba(240, 179, 86, .8); }
        .s1-time { font-size: .9375rem; letter-spacing: .12em; font-variant-numeric: tabular-nums; }
        .s1-time.is-low { color: #e0453a; animation: pulse 1s ease-in-out infinite; }
        @keyframes pulse { 50% { opacity: .55; } }
        .s1-chance { font-size: .7188rem; letter-spacing: .24em; color: #e0453a; border: 1px solid rgba(224, 69, 58, .45); padding: .1875rem .4375rem; }
        .s1-journal { font: .7188rem Georgia, serif; letter-spacing: .2em; color: rgba(236, 226, 205, .8); background: rgba(10, 12, 12, .45);
          border: 1px solid rgba(236, 210, 160, .3); padding: .3125rem .5625rem; cursor: pointer; }

        /* Keyboard hotspots. They do not take the mouse (the canvas keeps its
           pixel-accurate picking), but they are reachable with Tab and fire on
           Enter or Space. A clear ring shows which object has focus. */
        .hall-targets { position: absolute; inset: 0; z-index: 16; pointer-events: none; }
        .hall-target { position: absolute; width: 3.5rem; height: 3.5rem; transform: translate(-50%, -30%);
          margin: 0; padding: 0; border: 0; background: transparent; cursor: pointer; pointer-events: none;
          border-radius: .375rem; }
        .hall-target:focus-visible, .hall-target:focus {
          outline: none; pointer-events: auto;
          box-shadow: 0 0 0 2px #0a0806, 0 0 0 .25rem rgba(240, 205, 120, .95), 0 0 1.125rem .25rem rgba(240, 180, 90, .55);
          background: rgba(240, 205, 120, .08);
        }

        .hall-prompt { position: absolute; z-index: 14; transform: translate(-50%, -100%); pointer-events: none; white-space: nowrap;
          font-size: .75rem; letter-spacing: .08em; color: #f0e4cc; background: rgba(8, 10, 10, .62); border: 1px solid rgba(240, 210, 160, .35);
          padding: .3125rem .5625rem; animation: fadeIn .2s ease both; }
        .key { display: inline-block; min-width: 1rem; text-align: center; border: 1px solid rgba(240, 210, 160, .6); margin-right: .25rem; font-size: .7188rem; padding: 0 .1875rem; }
        .hall-message { position: absolute; left: 50%; bottom: 12vh; transform: translateX(-50%); z-index: 30; max-width: min(40rem, 86vw);
          text-align: center; font-style: italic; font-size: 1rem; color: #f2d9c4; text-shadow: 0 0 .625rem #000, 0 0 2px #000;
          animation: fadeIn .4s ease both; pointer-events: none; }

        .note-panel { position: absolute; left: 5vw; top: 50%; transform: translateY(-50%); z-index: 20; width: min(23.75rem, 38vw);
          color: #e8dcc4; background: linear-gradient(180deg, rgba(14, 16, 16, .88), rgba(8, 9, 9, .9)); border: 1px solid rgba(214, 180, 120, .35);
          padding: 1.375rem 1.5rem; animation: fadeIn .5s ease both; }
        .note-plaque { font-size: .8125rem; letter-spacing: .25em; color: #c9a45e; border: 1px solid rgba(201, 164, 94, .4); padding: .375rem .625rem; text-align: center;
          background: linear-gradient(180deg, #2a2114, #17120b); }
        .note-panel.is-right { left: auto; right: 5vw; }
        .note-sub { font-size: .75rem; font-style: italic; color: rgba(232, 220, 196, .55); margin: .5rem 0 .875rem; }
        .note-panel ul { margin: 0; padding-left: 1.125rem; line-height: 1.55; font-size: .875rem; }
        .note-panel li { margin-bottom: .5rem; }
        .note-eyes { margin: .875rem 0 0; font-size: .75rem; font-style: italic; color: #b8473c; }
        .panel-close { margin-top: 1rem; font: .7188rem Georgia, serif; letter-spacing: .22em; color: rgba(232, 220, 196, .75);
          background: transparent; border: 1px solid rgba(232, 210, 160, .3); padding: .4375rem .75rem; cursor: pointer; }
        .panel-close:hover { color: #fff3dd; border-color: rgba(232, 210, 160, .7); }

        .panel-backdrop { position: absolute; inset: 0; z-index: 25; display: grid; place-items: center; background: rgba(0, 0, 0, .55); animation: fadeIn .3s ease both; }
        .journal { width: min(35rem, 90vw); max-height: 84vh; overflow: auto; color: #3a2614; padding: 2.125rem 2.375rem 1.625rem;
          background: radial-gradient(ellipse at 30% 20%, #e7d8b2, #c9b282 70%, #a88c58);
          box-shadow: 0 1.25rem 3.75rem rgba(0,0,0,.7), inset 0 0 3.75rem rgba(90, 60, 20, .45);
          clip-path: polygon(0 2%, 6% 0, 18% 1.5%, 33% 0, 52% 1%, 70% 0, 86% 1.8%, 100% 0, 99% 30%, 100% 62%, 98.5% 100%, 80% 98.5%, 58% 100%, 36% 98%, 14% 100%, 0 98.5%, 1.2% 66%, 0 34%);
          font-family: 'Segoe Script', 'Bradley Hand', 'Brush Script MT', Georgia, cursive; }
        .journal h2 { margin: 0 0 .875rem; font: italic .875rem Georgia, serif; letter-spacing: .12em; color: #6a4a28; }
        .journal p { margin: 0 0 .75rem; font-size: 1.0625rem; line-height: 1.45; }
        .journal-last { font-style: italic; color: #7a2016; }
        .journal .panel-close { color: #5a3c1e; border-color: rgba(90, 60, 30, .45); font-family: Georgia, serif; }
        .journal { position: relative; }
        /* a letter gouged into the paper with a nib: pale, with a dark groove */
        .journal-scratch { position: absolute; font: bold 1.875rem Georgia, serif; color: rgba(236, 222, 190, .85); pointer-events: none;
          -webkit-text-stroke: 1px rgba(70, 45, 20, .55); text-shadow: 1px 1px 0 rgba(60, 35, 15, .55); transform: rotate(-6deg); }
        .journal-scratch sub { font-size: .8125rem; margin-left: 2px; }
        /* The Marked Page: a ring of dried blood round a letter, a blot of ink over one, and a smear (not a ring) */
        .jmark { position: relative; display: inline-block; }
        .jmark.is-circle::after { content: ''; position: absolute; left: 50%; top: 52%; width: 1.25em; height: 1.25em; transform: translate(-50%, -50%) rotate(-8deg);
          border: 2px solid rgba(128, 8, 8, .85); border-radius: 50% 46% 52% 48%; box-shadow: 0 0 2px rgba(90, 0, 0, .5); pointer-events: none; }
        .jmark.is-blot { color: transparent; }
        .jmark.is-blot::after { content: ''; position: absolute; left: 50%; top: 55%; width: 1.35em; height: 1.2em; transform: translate(-50%, -50%) rotate(12deg);
          background: radial-gradient(ellipse at 45% 40%, #1a0c06 55%, rgba(26, 12, 6, .85) 70%, transparent 74%); border: 2px solid rgba(128, 8, 8, .85); border-radius: 46% 54% 50% 50%; }
        .jmark.is-smudge::after { content: ''; position: absolute; left: -.2em; right: -.4em; top: 30%; height: .55em; transform: rotate(-14deg);
          background: linear-gradient(90deg, rgba(128, 8, 8, 0), rgba(128, 8, 8, .55) 30%, rgba(128, 8, 8, .35) 70%, rgba(128, 8, 8, 0)); border-radius: 40%; }
        .note-crooked, .note-scratch { color: #f0b356; }
        .note-underline { text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: .1875rem; text-decoration-color: #b8473c; }
        /* what the room says aloud, shown at the same moment (above the blackout) */
        .subtitle { position: absolute; left: 50%; bottom: 7vh; transform: translateX(-50%); z-index: 38; max-width: min(45rem, 90vw);
          text-align: center; font-size: 1.125rem; color: #f4e6cc; background: rgba(0, 0, 0, .55); padding: .375rem .875rem;
          text-shadow: 0 0 .375rem #000; pointer-events: none; animation: fadeIn .15s ease both; }

        .choices { display: flex; justify-content: center; gap: .625rem; flex-wrap: wrap; }
        .choice-option, .seq-option, .seq-slot { display: inline-flex; align-items: center; gap: .5rem; font: .875rem Georgia, serif; color: #eadfc8;
          background: #120e0a; border: 1px solid rgba(201, 164, 94, .45); padding: .5rem .75rem; cursor: pointer; }
        .choice-option:hover, .seq-option:hover:not(:disabled) { background: #241a10; }
        .choice-option.is-chosen { border-color: #f0b356; box-shadow: 0 0 0 2px #f0b356, 0 0 1.125rem rgba(240, 179, 86, .45); }
        .sequence { display: grid; justify-items: center; gap: .75rem; }
        .seq-slots, .seq-options { display: flex; justify-content: center; gap: .5rem; flex-wrap: wrap; }
        .seq-slot { min-width: 7.375rem; min-height: 3.25rem; border-style: dashed; }
        .seq-slot.is-full { border-style: solid; border-color: #f0b356; }
        .seq-n { font-size: .75rem; color: #c9a45e; }
        .seq-option:disabled { opacity: .35; cursor: not-allowed; }
        .seq-clear { width: 10rem; }
        .symbol-icon { display: block; }

        .lock { position: relative; width: min(45rem, 94vw); color: #eadfc8; background: linear-gradient(180deg, #18130e, #0d0a07); border: 1px solid rgba(201, 164, 94, .45);
          padding: 1.625rem 1.75rem; box-shadow: 0 1.25rem 4.375rem rgba(0,0,0,.8); text-align: center; }
        .lock h2 { margin: 0; font-weight: normal; letter-spacing: .3em; font-size: .875rem; color: #c9a45e; }
        .lock-plate { font-style: italic; font-size: 1rem; line-height: 1.5; margin: .75rem 0 .375rem; }
        .lock-help { font-size: .8125rem; color: rgba(234, 223, 200, .7); margin: 0 0 1.125rem; }
        .lock-faces { display: flex; justify-content: center; gap: .875rem; flex-wrap: wrap; }
        .lock-face { width: 6.5rem; padding: 0 0 .375rem; border: 1px solid rgba(201, 164, 94, .5); background: #000; cursor: pointer; overflow: hidden; color: #c9a45e; font: .75rem Georgia, serif; letter-spacing: .06em; }
        .lock-face img { width: 100%; height: 7.75rem; object-fit: cover; display: block; margin-bottom: .375rem; filter: sepia(.25) brightness(.85); transition: filter .2s; }
        .lock-face:hover img { filter: sepia(.1) brightness(1.05); }
        .lock-face.is-chosen { border-color: #f0b356; box-shadow: 0 0 0 2px #f0b356, 0 0 1.375rem rgba(240, 179, 86, .5); }
        .lock-face.is-chosen img { filter: none; }
        .lock-actions { display: flex; justify-content: center; gap: .75rem; margin-top: 1rem; align-items: center; }
        .lock-turn { margin-top: 1rem; font: .75rem Georgia, serif; letter-spacing: .22em; color: #f6ead2; background: linear-gradient(180deg, #5a2a10, #2e1408);
          border: 1px solid rgba(240, 180, 110, .6); padding: .5625rem 1rem; cursor: pointer; }
        .lock-turn:hover:not(:disabled) { background: linear-gradient(180deg, #74361a, #3b1a0b); }
        .lock-turn:disabled { opacity: .4; cursor: not-allowed; }
        .lock-warn { margin: .875rem 0 0; font-size: .75rem; font-style: italic; color: #b8473c; }

        .answer-number { display: grid; justify-items: center; gap: .875rem; }
        .answer-display { min-width: 7.5rem; font-size: 2.5rem; letter-spacing: .2em; color: #f0b356; border-bottom: 1px solid rgba(201, 164, 94, .5);
          font-variant-numeric: tabular-nums; padding: 0 .625rem .25rem; }
        .keypad { display: grid; grid-template-columns: repeat(5, 3.25rem); gap: .5rem; }
        .key-btn { height: 2.75rem; font: 1.125rem Georgia, serif; color: #eadfc8; background: #120e0a; border: 1px solid rgba(201, 164, 94, .45); cursor: pointer; }
        .key-btn:hover { background: #241a10; }
        .key-clear { grid-column: span 5; font-size: .75rem; letter-spacing: .22em; height: 2rem; }

        .wheels { display: flex; justify-content: center; gap: .625rem; }
        .wheel { display: grid; justify-items: center; width: 3.875rem; border: 1px solid rgba(201, 164, 94, .45); background: #0b0806; }
        .wheel.is-focus { border-color: #f0b356; box-shadow: 0 0 .875rem rgba(240, 179, 86, .35); }
        .wheel button { width: 100%; height: 1.75rem; background: transparent; border: 0; color: #c9a45e; cursor: pointer; font-size: .75rem; }
        .wheel button:hover { color: #fff3dd; background: rgba(201, 164, 94, .1); }
        .wheel span { font-size: 2.25rem; line-height: 3.25rem; color: #f0e4cc; cursor: pointer; }

        .confirm { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: .25rem; padding: 1.5rem;
          z-index: 2; background: #0a0504; border: 1px solid rgba(200, 20, 27, .55); }
        .confirm p { margin: 0; font-size: 1.125rem; }
        .confirm p b { color: #e0453a; font-weight: normal; }
        .confirm-answer { margin: .75rem 0 .25rem; font-size: 2.125rem; letter-spacing: .12em; color: #f0b356; }

        .reward { position: absolute; inset: 0; z-index: 30; display: grid; place-content: center; justify-items: center; text-align: center;
          background: radial-gradient(ellipse 46% 52% at center, rgba(0,0,0,.82), rgba(0,0,0,.72) 55%, rgba(0,0,0,.88)); color: #eadfc8; animation: fadeIn 1.2s ease both; padding: 0 8vw; }
        .reward p { max-width: 35rem; font-style: italic; margin: .625rem 0 0; }
        .reward-order { font-style: normal !important; font-size: .8125rem; letter-spacing: .06em; color: #c9a45e; }
        .reward-guest { color: #f0b356 !important; font-size: .8125rem; }
 .reward-next { font-size: .8125rem; color: rgba(234, 223, 200, .65); }
        /* the treasure: the painting in a gold case, slowly turning in candlelight */
        .treasure-art { width: min(14.375rem, 40vh); aspect-ratio: 1; margin: 1.125rem 0 .375rem; border-radius: 50%; background-size: cover; background-position: center;
          border: .375rem solid #c8962e; box-shadow: 0 0 0 2px #5a3a10, 0 0 3.125rem rgba(255, 170, 60, .55), inset 0 0 1.875rem rgba(0, 0, 0, .6);
          filter: saturate(1.08) brightness(1.06); animation: treasureIn 1.6s cubic-bezier(.2, .7, .2, 1) both, treasureGlow 3s ease-in-out 1.6s infinite; }
        /* the watch's painting is a grey clock face: warmed to gold. The codex and the ruby keep their own colours. */
        .treasure-art.is-gold-watch { filter: sepia(.35) saturate(1.25) brightness(1.05); }
        @keyframes treasureIn { from { opacity: 0; transform: scale(.6) rotate(-25deg); } to { opacity: 1; transform: none; } }
        @keyframes treasureGlow { 50% { box-shadow: 0 0 0 2px #5a3a10, 0 0 5rem rgba(255, 190, 80, .8), inset 0 0 1.875rem rgba(0, 0, 0, .6); } }
        .treasure-name { margin: .5rem 0 0; font-weight: normal; letter-spacing: .06em; color: #f0b356; font-size: clamp(1.25rem, 2.4vw, 1.75rem); }
        .stage-clear { position: absolute; left: 0; right: 0; top: 30vh; z-index: 22; display: grid; justify-items: center; text-align: center; pointer-events: none;
          animation: fadeIn .8s ease both; padding: 0 8vw; }
        .stage-clear p { max-width: 38.75rem; margin: .625rem 0 0; font-style: italic; color: #f0e4cc; text-shadow: 0 0 .625rem #000, 0 0 .1875rem #000; }
        .memorise { position: absolute; left: 50%; top: 1rem; transform: translateX(-50%); z-index: 18; text-align: center; padding: .75rem 1.5rem;
          background: rgba(8, 6, 5, .8); border: 1px solid rgba(200, 20, 27, .4); color: #efe3cb; animation: fadeIn .6s ease both; }
        .memorise p { margin: .375rem 0 0; font-size: .9375rem; }
        .hint-button { display: block; margin: .375rem auto 0; font: italic .75rem Georgia, serif; letter-spacing: .06em; color: #f0b356; background: transparent;
          border: 1px dashed rgba(240, 179, 86, .55); padding: .25rem .75rem; cursor: pointer; }
        .hint-button:hover { color: #ffd38a; border-color: #ffd38a; }
        .hint-marks { position: absolute; inset: 0; z-index: 19; pointer-events: none; }
        .hint-mark { position: absolute; width: 2.875rem; height: 2.875rem; margin: -1.4375rem 0 0 -1.4375rem; border-radius: 50%;
          border: 2px solid rgba(255, 196, 110, .9); box-shadow: 0 0 .875rem rgba(255, 160, 60, .7), inset 0 0 .625rem rgba(255, 160, 60, .4);
          animation: hintPulse 1.4s ease-in-out infinite; }
        @keyframes hintPulse { 50% { transform: scale(1.25); opacity: .55; } }
        @media (prefers-reduced-motion: reduce) { .hint-mark { animation: none; } }
        .memorise { max-width: min(47.5rem, 92vw); }
        .memorise-question { font-size: .875rem !important; color: #e6d6b8; line-height: 1.45; }
        .memorise-left { font-size: .8125rem !important; font-style: italic; color: #f0b356; }
        .memorise-ready { margin-top: .625rem; font: .75rem Georgia, serif; letter-spacing: .18em; color: #f6ead2; cursor: pointer; padding: .5rem .875rem;
          background: linear-gradient(180deg, #5a2a10, #2e1408); border: 1px solid rgba(240, 180, 110, .6); }
        /* the hall takes touch itself: a drag moves the candle, it never scrolls the page */
        .hall-stage { touch-action: none; }
        .q-fold { display: none; }
        /* Phones and small tablets held sideways (short screens): a compact question that can fold to one line,
           panels that fit the height and scroll, larger taps. */
        @media (max-height: 560px), (max-width: 760px) {
          .question-bar { top: .375rem; width: min(37.5rem, 66vw); padding: .375rem .75rem .5rem; }
          .question-bar.is-side { width: min(21.25rem, 40vw); top: .375rem; right: .375rem; }
          .question-top { gap: .5rem; }
          .question-label { font-size: 1rem; }
          .question-stage, .s1-chance { display: none; }
          .question-text, .question-bar.is-side .question-text { font-size: .75rem; line-height: 1.35; margin: .25rem 0 2px; max-height: 34vh; overflow: auto; }
          .question-kind { font-size: .6875rem; }
          .question-candle { font-size: .6875rem !important; margin: 2px 0 0 !important; }
          .answer-note { display: none; }
          .answer-button { margin-top: .25rem; padding: .5rem 1rem; }
          .hint-button { margin-top: .25rem; padding: .375rem .625rem; font-size: .6875rem; }
          .q-fold { display: inline-block; font: .6875rem Georgia, serif; letter-spacing: .14em; color: #f0b356; background: rgba(10, 8, 6, .6);
            border: 1px solid rgba(240, 179, 86, .45); padding: 0 .625rem; min-height: 2.5rem; cursor: pointer; }
          /* a panel open over the room: it has the screen to itself (the answer panel repeats the question) */
          .hall-stage.has-panel .question-bar { display: none; }
          .question-bar.is-folded .question-text, .question-bar.is-folded .question-kind, .question-bar.is-folded .question-candle,
          .question-bar.is-folded .hint-button, .question-bar.is-folded .ghost-guide-line { display: none; }
          .ghost-guide-line, .question-candle.ghost-guide-line, .ghost-guide-who, .ghost-guide-ok { font-size: .6875rem !important; }
          /* folded: one line, the clock, the journal, SHOW QUESTION and ANSWER side by side */
          .question-bar.is-folded { display: flex; align-items: center; justify-content: center; gap: .5rem; padding: .25rem .625rem; }
          .question-bar.is-folded .answer-button { margin-top: 0; }
          .candle-tool { top: .375rem !important; left: .375rem !important; }
          .note-panel { left: 2vw; width: min(21.25rem, 46vw); max-height: 92vh; overflow: auto; padding: .75rem .875rem; }
          .note-panel.is-right { right: 2vw; }
          .note-panel ul { font-size: .75rem; line-height: 1.4; }
          .note-sub { margin: .25rem 0 .5rem; }
          .panel-close { margin-top: .5rem; min-height: 2.5rem; }
          .journal { max-height: 94vh; padding: 1.125rem 1.25rem .875rem; }
          .journal p { font-size: .875rem; }
          .panel-backdrop { overflow: auto; }
          .lock { max-height: 96vh; overflow: auto; padding: .625rem .875rem; }
          .lock-plate { font-size: .75rem; line-height: 1.35; margin: .25rem 0 2px; }
          .lock-help { font-size: .6875rem; margin: 0 0 .5rem; }
          .lock-face { width: 5.25rem; }
          .lock-face img { height: 4.875rem; }
          .lock-actions { margin-top: .5rem; }
          .lock-turn { margin-top: .5rem; min-height: 2.5rem; }
          .lock-warn { margin-top: .375rem; font-size: .6875rem; }
          .keypad { grid-template-columns: repeat(10, 2.5rem); gap: .3125rem; }
          .key-btn { height: 2.625rem; }
          .key-clear { grid-column: span 10; height: 2.125rem; }
          .answer-display { font-size: 1.75rem; }
          .answer-number { gap: .5rem; }
          .wheel { width: 3.375rem; }
          .wheel button { height: 2.25rem; font-size: .875rem; }
          .wheel span { font-size: 1.75rem; line-height: 2.5rem; }
          .confirm p { font-size: .9375rem; }
          .confirm-answer { font-size: 1.625rem; }
          .memorise { top: .375rem; padding: .5rem .875rem; max-width: 70vw; }
          .memorise p { font-size: .75rem; }
          .memorise-question { font-size: .7188rem !important; }
          .memorise-ready { min-height: 2.5rem; }
          .stage-clear { top: 22vh; }
          .reward { padding: 0 4vw; overflow: auto; }
          .treasure-art { width: min(10rem, 34vh); margin: .5rem 0 .25rem; }
          .subtitle { font-size: .875rem; bottom: 4vh; }
          .hint-mark { width: 2.125rem; height: 2.125rem; margin: -1.0625rem 0 0 -1.0625rem; }
          .choice-option, .seq-option, .seq-slot { min-height: 2.625rem; font-size: .75rem; padding: .375rem .625rem; }
          .seq-slot { min-width: 5.75rem; min-height: 2.75rem; }
        }
        .blackout { position: absolute; inset: 0; z-index: 35; background: #000; opacity: 0; pointer-events: none; transition: opacity .4s ease; }
        .blackout.is-on { opacity: 1; pointer-events: auto; }
        .stage-title.is-between { z-index: 36; animation: none; }
        .question-stage { font-size: .7188rem; letter-spacing: .24em; color: rgba(220, 150, 90, .9); }
        .reward-eye { width: 6.875rem; height: 3.5rem; margin-bottom: 1.125rem; border-radius: 50%; border: .1875rem solid #f0b356;
          background: radial-gradient(circle, #1a0a02 18%, #f0b356 20%, #f0b356 30%, transparent 32%); box-shadow: 0 0 1.875rem #ff9a3c, inset 0 0 .75rem #ff9a3c;
          clip-path: ellipse(50% 46% at 50% 50%); animation: eyePulse 2.4s ease-in-out infinite; }
        @keyframes eyePulse { 0%, 100% { box-shadow: 0 0 1.25rem #ff9a3c, inset 0 0 .625rem #ff9a3c; } 50% { box-shadow: 0 0 2.875rem #ffb35c, inset 0 0 1.125rem #ffb35c; } }

        .game-over { position: absolute; inset: 0; z-index: 40; display: grid; place-content: center; justify-items: center; pointer-events: none; text-align: center; padding: 0 8vw; }
        .game-over h1 { margin: 0; font-family: 'Creepster', Georgia, serif; font-weight: normal; font-size: clamp(3.5rem, 11vw, 9.375rem); color: #b80d12; letter-spacing: .05em;
          text-shadow: .1875rem .1875rem 0 #120000, -2px -2px 0 #120000, 0 0 1.875rem rgba(170, 0, 0, .8); animation: bleedIn 1.6s cubic-bezier(.2, .7, .2, 1) both; }
        .game-over p { margin: .375rem 0 0; font-style: italic; color: #e9cfc4; text-shadow: 0 0 .625rem #000; animation: fadeIn 2s ease 1s both; }
        .game-over .game-over-restart { color: #f0b356; font-style: normal; letter-spacing: .06em; animation-delay: 1.4s; }
        .game-over .game-over-answer { max-width: 38.75rem; font-size: .9375rem; animation-delay: 1.8s; }
        /* GAME OVER is up for 4.25 s: the remark and the tip fade in quickly so both can be read */
        .game-over .game-over-count { font-size: .875rem; color: #c9b3a8; animation-duration: .8s; animation-delay: 1.2s; }
        .game-over .game-over-tip { font-size: .875rem; font-style: normal; color: #f0c27a; animation-duration: .8s; animation-delay: 1.6s; }
        .game-over-answer b { color: #f0b356; font-weight: normal; font-style: normal; letter-spacing: .06em; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  )
}
