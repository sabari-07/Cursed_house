import { useEffect, useRef, useState } from 'react'
import { warmTitleCard } from './TitleCard'
import { onActivation, unlockAudio } from '../game/audioUnlock'

/**
 * The first screen of the site. Browsers keep a page silent until the visitor
 * clicks or presses a key (the autoplay rule), and the title card is a sound
 * piece, so this screen always waits for one click or key press. Then it
 * fades, and the title card starts, heard from its first letter.
 *
 * The owner's painting: a ghost bride holding up a blank board. The words are
 * chalked onto the board here (real text, sharp at any size), placed in
 * painting px on the board's measured face. The painting is brought to life
 * with mist drifting over the floor and the candle's light breathing (one
 * value for the whole light, never a moving pattern).
 */
const ART = { url: '/landing/gate-bride.webp', w: 1672, h: 941 }
/** The board's writable face, painting px (inside its worn edges and the blood). */
const BOARD = { x0: 500, y0: 470, x1: 1132, y1: 752 }
/** The candle on the floor (painting px). */
const CANDLE = { x: 457, y: 838 }
const TOUCH = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
const FADE_MS = 650


export function SoundGate({ onOpen }: { onOpen: () => void }) {
  const [leaving, setLeaving] = useState(false)
  const [box, setBox] = useState({ s: 1, ox: 0, oy: 0 })
  const done = useRef(false)
  const boardRef = useRef<HTMLButtonElement>(null)
  // while the visitor reads the board, the title card's echo is made (it would stall the card on a phone)
  useEffect(() => { warmTitleCard() }, [])
  // keyboard users land on the board, without the browser scrolling the painting to show it
  useEffect(() => { boardRef.current?.focus({ preventScroll: true }) }, [])

  // cover-fit, the same as the background: painting px -> screen px
  useEffect(() => {
    const lay = () => {
      const w = window.innerWidth, h = window.innerHeight, s = Math.max(w / ART.w, h / ART.h)
      setBox({ s, ox: (w - ART.w * s) / 2, oy: (h - ART.h * s) / 2 })
    }
    lay()
    window.addEventListener('resize', lay)
    return () => window.removeEventListener('resize', lay)
  }, [])

  useEffect(() => {
    // the click is the gesture that unlocks sound; the browser remembers it, so the
    // title card may start its sound after the fade
    const open = () => {
      if (done.current) return
      done.current = true
      setLeaving(true)
      // the one context for the whole visit, unlocked inside this tap (see game/audioUnlock.ts)
      unlockAudio()
      window.setTimeout(onOpen, FADE_MS)
    }
    // a finished tap, not the moment the finger lands: phones only allow sound from that
    return onActivation(open)
  }, [onOpen])

  const at = (x: number, y: number) => ({ left: box.ox + x * box.s, top: box.oy + y * box.s })
  const board = { ...at(BOARD.x0, BOARD.y0), width: (BOARD.x1 - BOARD.x0) * box.s, height: (BOARD.y1 - BOARD.y0) * box.s }
  const candle = at(CANDLE.x, CANDLE.y)

  return (
    <div className={`sound-gate ${leaving ? 'is-leaving' : ''}`} role="dialog" aria-label="Enter with sound" style={{ ['--s' as string]: box.s }}>
      <div className="sg-art" style={{ backgroundImage: `url(${ART.url})` }} aria-hidden="true" />
      <div className="sg-candle" style={candle} aria-hidden="true" />
      <div className="sg-mist sg-mist-a" aria-hidden="true" />
      <div className="sg-mist sg-mist-b" aria-hidden="true" />
      <div className="sg-vignette" aria-hidden="true" />
      <button type="button" className="sg-board" ref={boardRef} style={board} aria-label={TOUCH ? 'Tap anywhere to enter' : 'Click anywhere to enter'}>
        <span className="sg-line">{TOUCH ? 'TAP ANYWHERE' : 'CLICK ANYWHERE'}</span>
        <span className="sg-line sg-line-2">TO ENTER</span>
        <span className="sg-rule" aria-hidden="true" />
        <span className="sg-sub">Turn your sound on.</span>
        <span className="sg-sub">Headphones make it worse.</span>
      </button>
      <style>{`
        .sound-gate { position: fixed; inset: 0; z-index: 70; overflow: clip; background: #020204; cursor: pointer;
          transition: opacity ${FADE_MS}ms ease; animation: sgIn 1.6s ease both; }
        .sound-gate.is-leaving { opacity: 0; pointer-events: none; }
        .sg-art { position: absolute; inset: 0; background-size: cover; background-position: center;
          animation: sgBreath 9s ease-in-out infinite; }
        /* the candle's light: one warm value for the whole glow, breathing slowly with small dips */
        .sg-candle { position: absolute; width: calc(900px * var(--s)); height: calc(700px * var(--s)); transform: translate(-50%, -60%);
          pointer-events: none; mix-blend-mode: screen;
          background: radial-gradient(ellipse at 50% 60%, rgba(255, 150, 60, .2), rgba(255, 120, 40, .07) 40%, transparent 70%);
          animation: sgFlame 3.1s ease-in-out infinite; }
        /* low mist crossing the floor, two layers at different speeds */
        .sg-mist { position: absolute; left: -50%; width: 200%; pointer-events: none; mix-blend-mode: screen; }
        .sg-mist-a { bottom: -4%; height: 34%; opacity: .5;
          background: radial-gradient(ellipse 18% 60% at 20% 70%, rgba(170, 190, 205, .22), transparent 70%),
                      radial-gradient(ellipse 22% 55% at 55% 80%, rgba(150, 175, 195, .18), transparent 70%),
                      radial-gradient(ellipse 16% 50% at 85% 65%, rgba(170, 190, 205, .2), transparent 70%);
          animation: sgDrift 38s linear infinite; }
        .sg-mist-b { bottom: 8%; height: 30%; opacity: .35;
          background: radial-gradient(ellipse 20% 50% at 35% 60%, rgba(160, 180, 200, .2), transparent 70%),
                      radial-gradient(ellipse 18% 45% at 75% 70%, rgba(160, 180, 200, .16), transparent 70%);
          animation: sgDrift 60s linear infinite reverse; }
        .sg-vignette { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse at 50% 50%, transparent 60%, rgba(0, 0, 0, .3) 100%); }
        /* the words chalked onto the board */
        .sg-board { position: absolute; display: grid; place-content: center; justify-items: center; gap: calc(6px * var(--s));
          background: transparent; border: 0; padding: 0; cursor: pointer; transform: rotate(-.4deg); outline: none; }
        .sg-line { font: calc(76px * var(--s)) 'Creepster', Georgia, serif; letter-spacing: .06em; line-height: 1;
          color: rgba(232, 226, 210, .86); text-shadow: 0 0 calc(2px * var(--s)) rgba(255, 255, 255, .25), calc(1px * var(--s)) calc(2px * var(--s)) 0 rgba(0, 0, 0, .55);
          mix-blend-mode: screen; animation: sgChalk 2.8s ease-in-out infinite; }
        .sg-line-2 { font-size: calc(62px * var(--s)); }
        .sg-rule { width: 54%; height: calc(2px * var(--s)); margin: calc(10px * var(--s)) 0 calc(4px * var(--s));
          background: linear-gradient(90deg, transparent, rgba(232, 226, 210, .55) 15%, rgba(232, 226, 210, .4) 85%, transparent); }
        .sg-sub { font: italic calc(26px * var(--s)) Georgia, serif; letter-spacing: .06em; color: rgba(225, 215, 195, .72); text-shadow: 0 1px 0 rgba(0, 0, 0, .6); }
        .sg-board:focus-visible .sg-line { color: #fff2d8; }
        @keyframes sgIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sgBreath { 0%, 100% { filter: brightness(1.3) contrast(.96); } 50% { filter: brightness(1.37) contrast(.96); } }
        @keyframes sgFlame { 0%, 100% { opacity: .85; } 22% { opacity: 1; } 31% { opacity: .78; } 47% { opacity: .95; } 68% { opacity: .82; } 80% { opacity: 1; } }
        @keyframes sgDrift { from { transform: translateX(0); } to { transform: translateX(25%); } }
        @keyframes sgChalk { 50% { opacity: .7; } }
        @media (prefers-reduced-motion: reduce) { .sg-art, .sg-candle, .sg-mist, .sg-line { animation: none; } .sg-art { filter: brightness(1.3) contrast(.96); } }
      `}</style>
    </div>
  )
}
