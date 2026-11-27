import { useEffect, useRef, useState } from 'react'
import { LandingScene } from '../scenes/LandingScene'
import { preloadArjun } from '../three/ArjunModel'
import { onActivation, sharedAudio, unlockAudio } from '../game/audioUnlock'

interface Props {
  /** Receives the scene once created (null on unmount), e.g. to start ENTER THE BUNGALOW. Must be stable. */
  onScene?: (scene: LandingScene | null) => void
  /** True while the entrance sequence plays (the sequence starts the audio itself). */
  entering?: boolean
  /** False while it is built behind the entry screen and the title card: paused and silent. */
  active?: boolean
  /** False while the title card plays: the build waits between its steps. */
  canBuild?: boolean
}

export function LandingCanvas({ onScene, entering = false, active = true, canBuild = true }: Props) {
  const activeRef = useRef(active)
  activeRef.current = active
  const buildRef = useRef(canBuild)
  buildRef.current = canBuild
  useEffect(() => { sceneRef.current?.setBuildAllowed(canBuild) }, [canBuild])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<LandingScene | null>(null)
  const [ready, setReady] = useState(false)
  const [audioOn, setAudioOn] = useState(false)
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let scene: LandingScene | null = null, alive = true
    const onResize = () => scene?.resize()
    // Arjun's baked face first (building him otherwise paints it pixel by pixel, seconds on a phone)
    void preloadArjun().then(() => {
      if (!alive) return
      scene = new LandingScene(canvas, () => setReady(true))
      scene.setActive(activeRef.current)
      scene.setBuildAllowed(buildRef.current)
      sceneRef.current = scene
      onScene?.(scene)
      void scene.start()
      // the visitor already tapped (the entry screen): the storm starts now, no second tap
      if (activeRef.current && (wantAudio.current || sharedAudio())) { wantAudio.current = false; setAudioOn(true); void scene.enableAudio() }
      if (import.meta.env.DEV) (window as unknown as { __landing: LandingScene }).__landing = scene
      window.addEventListener('resize', onResize)
    })
    return () => {
      alive = false
      window.removeEventListener('resize', onResize)
      scene?.dispose()
      sceneRef.current = null
      onScene?.(null)
    }
  }, [onScene])

  useEffect(() => {
    if (entering) setAudioOn(true)
  }, [entering])
  // the title card has ended: the house wakes, and its storm starts (the entry screen's tap allowed sound)
  useEffect(() => {
    const scene = sceneRef.current
    scene?.setActive(active)
    if (active && scene && !audioOn && (wantAudio.current || sharedAudio())) { wantAudio.current = false; setAudioOn(true); void scene.enableAudio() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  // Browsers only allow audio after a user gesture: the first click anywhere
  // starts the storm, wolves and thunder.
  /** Sound was asked for before the scene existed (it waits for Arjun's face): start it when it does. */
  const wantAudio = useRef(false)
  const startAudio = () => {
    if (audioOn) return
    unlockAudio()
    if (!sceneRef.current || !activeRef.current) { wantAudio.current = true; return }
    setAudioOn(true)
    void sceneRef.current.enableAudio()
  }

  // a key press is a gesture too (the title card asks for "a click or a key")
  const startRef = useRef(startAudio)
  startRef.current = startAudio
  useEffect(() => {
    // the visitor already clicked or pressed a key during the title card: sound may start now
    if ((navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive) startRef.current()
    return onActivation(() => startRef.current())
  }, [])

  const toggleSound = () => {
    if (!audioOn) return startAudio()
    const next = !muted
    setMuted(next)
    sceneRef.current?.setMuted(next)
  }

  return (
    <div className="landing-stage">
      <canvas ref={canvasRef} className="landing-stage-canvas" />
      <div className={`landing-curtain ${ready ? 'is-open' : ''}`} />

      <button
        type="button"
        className={`landing-sound ${audioOn ? '' : 'is-waiting'}`}
        onPointerDown={e => e.stopPropagation()}
        onClick={toggleSound}
      >
        {/* The label names the action the click performs. */}
        {!audioOn ? 'CLICK FOR SOUND' : muted ? 'TURN SOUND ON' : 'TURN SOUND OFF'}
      </button>

      <style>{`
        .landing-stage { position: fixed; inset: 0; overflow: hidden; background: #05080c; }
        .landing-stage-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
        .landing-curtain {
          position: absolute; inset: 0; background: #000; pointer-events: none;
          transition: opacity 2.2s ease;
        }
        .landing-curtain.is-open { opacity: 0; }
        .landing-sound {
          position: absolute; top: 1.125rem; right: 1.25rem; z-index: 20;
          border: 1px solid rgba(240, 215, 170, 0.55); color: #f2e6d2;
          background: rgba(8, 6, 4, 0.55); backdrop-filter: blur(.25rem);
          padding: .5rem .75rem; font: .7188rem Georgia, serif; letter-spacing: .18em; cursor: pointer;
        }
        .landing-sound.is-waiting { animation: soundPulse 1.8s ease-in-out infinite; }
        @keyframes soundPulse {
          0%, 100% { box-shadow: 0 0 0 rgba(255, 150, 60, 0); }
          50% { box-shadow: 0 0 1rem rgba(255, 150, 60, 0.55); }
        }
      `}</style>
    </div>
  )
}
