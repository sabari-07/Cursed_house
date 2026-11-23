import { useState } from 'react'
import { MainMenu } from './components/MainMenu'
import { FullscreenButton } from './components/FullscreenButton'

/**
 * Landing page → inside the bungalow → Stage 1. Dying (or finishing the
 * stage) returns to a fresh landing page: the key remounts everything.
 *
 * Phones: the house is painted for a wide screen, so the game is played held
 * sideways and in full screen (FullscreenButton); held upright, a card asks
 * the player to turn the phone (CSS only, so it follows the rotation at once).
 */
export function App() {
  const [run, setRun] = useState(0)
  return (
    <>
      <MainMenu key={run} onExit={() => setRun(r => r + 1)} />
      <FullscreenButton />
      <div className="turn-phone" role="alert" aria-live="polite">
        <div className="turn-phone-icon" aria-hidden="true" />
        <p className="turn-phone-title">TURN YOUR PHONE SIDEWAYS</p>
        <p>The house is painted for a wide screen. Hold your phone sideways to enter.</p>
      </div>
    </>
  )
}
