import { useCallback, useEffect, useState } from 'react'
import type { LandingScene } from '../scenes/LandingScene'
import { LandingCanvas } from './LandingCanvas'
import { HallStage } from './HallStage'
import { AccountPanel, type AccountMode } from './AccountPanel'
import { TitleCard } from './TitleCard'
import { SoundGate } from './SoundGate'
import { Leaderboard } from './Leaderboard'
import { current, isGuest, refreshAccount, saveProgress, signOut, startGuest, type Account } from '../game/accounts'
import { LEVELS, TREASURES, playable } from '../game/levels'
import type { ProgressV2 } from '../game/progress'

/** The title card opens the site once per page load (not again after a death). */
let introSeen = false

interface Props {
  /** Back to a fresh landing page (after a death, or after a level is won). */
  onExit: () => void
}

/**
 * The landing page outside the bungalow: the player signs in, sees their
 * level and treasures and the leaderboard, then ENTER THE BUNGALOW walks Arjun
 * in to the current level's room.
 */
export function MainMenu({ onExit }: Props) {
  const [scene, setScene] = useState<LandingScene | null>(null)
  const [entering, setEntering] = useState(false)
  const [phase, setPhase] = useState<'outside' | 'inside'>('outside')
  /** Each level inside the house is a fresh visit of the stage engine (a new room). */
  const [visit, setVisit] = useState(0)
  const [account, setAccount] = useState<Account | null>(() => current())
  // online: bring in progress made on another device (or notice the session has ended)
  useEffect(() => {
    let alive = true
    void refreshAccount().then(a => { if (alive) setAccount(prev => (prev && !a && prev.id === 'guest' ? prev : a)) })
    return () => { alive = false }
  }, [])
  const [panel, setPanel] = useState<'account' | 'leaderboard' | 'soon' | null>(null)
 const [accountMode, setAccountMode] = useState<AccountMode>('signin')
 const [intro, setIntro] = useState(!introSeen && !new URLSearchParams(window.location.search).has('nointro'))
 // the title card waits for sound: a first visit's browser blocks it until a click (SoundGate)
 const [gateOpen, setGateOpen] = useState(false)
 const openGate = useCallback(() => setGateOpen(true), [])
 const endIntro = useCallback(() => { introSeen = true; setIntro(false); setLandingOn(true) }, [])
 // the landing loads once the title has typed itself (its loading stalls the page for ~2 s)
 const [landingOn, setLandingOn] = useState(!intro)
 // the landing is built behind the entry screen (below), so nothing is left to do when the title is typed
 const typed = useCallback(() => undefined, [])
 // a moment after the entry screen has painted, build the landing behind it (paused and silent):
 // its seconds of setup happen while the visitor reads the board, not when the house appears
 useEffect(() => {
   if (landingOn) return
   const id = window.setTimeout(() => setLandingOn(true), 700)
   return () => window.clearTimeout(id)
 }, [landingOn])
 const openAccount = (m: AccountMode) => { setAccountMode(m); setPanel('account') }

  const progress = account?.progress ?? null
  const level = progress ? LEVELS[progress.level] : null
  const guest = isGuest(account)
  const playAsGuest = () => { setAccount(startGuest()); setPanel(null) }

  // ENTER THE BUNGALOW: zoom to the door, the ghostly drone, the door creaks
  // open, Arjun walks in. Called inside the click so the scene may start audio.
  const enterBungalow = () => {
    if (entering) return
    if (!account || !progress) { openAccount('signin'); return }
    if (!playable(progress.level)) { setPanel('soon'); return }
    setEntering(true)
    if (scene) scene.enter(() => setPhase('inside'))
    else setPhase('inside')
  }

  const save = (p: ProgressV2) => {
    const a = saveProgress(p)
    if (a) setAccount(a)
  }

  if (phase === 'inside' && account && progress) {
    return (
      <main className="landing-menu">
        <HallStage key={visit} progress={progress} onSave={save} onExit={onExit} guest={guest} onNextLevel={() => setVisit(v => v + 1)} />
      </main>
    )
  }

  return (
    <main className="landing-menu">
      {landingOn && <LandingCanvas onScene={setScene} entering={entering} active={!intro} canBuild={!(intro && gateOpen)} />}

      {!entering && !intro && (
        <>
          <aside className="player-card" aria-label="Player">
            {account && progress ? (
              <>
                <div className="player-name">{guest ? 'Playing as a guest' : account.name}</div>
                {guest && <div className="player-guest">Your progress is kept in this browser, but not on the leaderboard.</div>}
                <div className="player-where">
                  {progress.level === 4 ? 'All levels cleared' : `Level ${progress.level} · Stage ${progress.stage} · ${level!.name}`}
                </div>
                <div className="player-treasures" aria-label={`${progress.treasures.length} treasures`}>
                  {(['gold-watch', 'raven-codex', 'heart-of-the-house'] as const).map(t => (
                    <span key={t} className={`treasure-slot ${progress.treasures.includes(t) ? 'is-won' : ''}`} title={progress.treasures.includes(t) ? TREASURES[t].name : 'Not found yet'}
                      style={progress.treasures.includes(t) ? { backgroundImage: `url(${TREASURES[t].image})` } : undefined} />
                  ))}
                </div>
                <div className="player-actions">
                  {guest && <button type="button" className="is-main" onClick={() => openAccount('signup')}>SAVE MY PROGRESS</button>}
                  <button type="button" onClick={() => setPanel('leaderboard')}>LEADERBOARD</button>
                  <button type="button" onClick={() => { signOut(); setAccount(null) }}>{guest ? 'LEAVE' : 'SIGN OUT'}</button>
                </div>
              </>
            ) : (
              <div className="player-actions">
                <button type="button" className="is-main" onClick={() => openAccount('signin')}>SIGN IN</button>
                <button type="button" className="is-main" onClick={() => openAccount('signup')}>SIGN UP</button>
                <button type="button" className="is-guest" onClick={playAsGuest}>PLAY AS GUEST</button>
                <button type="button" onClick={() => setPanel('leaderboard')}>LEADERBOARD</button>
              </div>
            )}
          </aside>

          <nav className="landing-actions" aria-label="Game menu">
            <button className="enter-bungalow-button" type="button" onClick={enterBungalow}>
              ENTER THE BUNGALOW
            </button>
          </nav>
        </>
      )}

      {panel === 'account' && <AccountPanel mode={accountMode} scene={scene} onClose={() => setPanel(null)} onDone={a => { setAccount(a); setPanel(null) }}
        onGuest={guest ? undefined : playAsGuest} carrying={guest && progress ? progress.treasures.length + progress.level - 1 > 0 : false} />}
 {intro && !gateOpen && <SoundGate onOpen={openGate} />}
      {intro && gateOpen && <TitleCard onDone={endIntro} onTyped={typed} />}
      {panel === 'leaderboard' && <Leaderboard me={guest ? null : account?.name ?? null} onClose={() => setPanel(null)} />}
      {panel === 'soon' && progress && (
        <div className="soon-backdrop" onClick={() => setPanel(null)}>
          <section className="soon" role="dialog" aria-label="Coming soon">
            <div className="soon-level">LEVEL {progress.level}</div>
            <h2>{LEVELS[progress.level].name}</h2>
            <p>Coming soon. The house is still preparing this room.</p>
            {progress.treasures.length > 0 && <p className="soon-won">You carry {progress.treasures.map(t => TREASURES[t].name).join(', ')}.</p>}
            <button type="button" onClick={() => setPanel(null)}>BACK</button>
          </section>
        </div>
      )}

      <style>{`
        .landing-menu { position: fixed; inset: 0; overflow: hidden; }
        .landing-actions {
          position: fixed; z-index: 12;
          right: clamp(18px, 3vw, 44px); bottom: clamp(18px, 4vh, 40px);
          display: grid; justify-items: end; gap: 8px;
        }
        .enter-bungalow-button {
          font-family: Georgia, 'Times New Roman', serif; color: #f3e9d7; cursor: pointer; text-transform: uppercase;
          background: rgba(7, 9, 12, 0.48); backdrop-filter: blur(5px);
          min-width: min(280px, 70vw); padding: 13px 24px;
          border: 1px solid rgba(243, 218, 172, 0.72);
          box-shadow: 0 0 22px rgba(240, 142, 38, 0.18), inset 0 0 16px rgba(255, 166, 55, 0.06);
          font-size: clamp(12px, 1.4vw, 16px); letter-spacing: 0.21em;
          transition: background 180ms ease, box-shadow 180ms ease, transform 180ms ease;
        }
        .enter-bungalow-button:hover, .enter-bungalow-button:focus-visible {
          background: rgba(87, 38, 12, 0.65);
          box-shadow: 0 0 35px rgba(255, 139, 29, 0.42), inset 0 0 20px rgba(255, 180, 74, 0.14);
          outline: none; transform: translateY(-2px);
        }

        .player-card { position: fixed; z-index: 12; left: clamp(18px, 3vw, 44px); bottom: clamp(18px, 4vh, 40px); display: grid; gap: 6px;
          font-family: Georgia, 'Times New Roman', serif; color: #f3e9d7; padding: 12px 16px; max-width: min(360px, 60vw);
          background: rgba(7, 9, 12, 0.48); backdrop-filter: blur(5px); border: 1px solid rgba(243, 218, 172, 0.3); }
        .player-name { font-size: 17px; letter-spacing: .06em; }
        .player-where { font-size: 12px; color: rgba(243, 233, 215, .7); }
        .player-treasures { display: flex; gap: 8px; margin-top: 2px; }
        .treasure-slot { width: 26px; height: 26px; border-radius: 50%; border: 1px solid rgba(243, 218, 172, .35); background: rgba(0, 0, 0, .3); }
        /* a won treasure shows its own picture */
        .treasure-slot.is-won { border-color: #f0b356; background-color: #5a3a10; background-size: cover; background-position: center; box-shadow: 0 0 10px rgba(240, 179, 86, .6); }
        .player-actions { display: flex; gap: 8px; margin-top: 4px; }
        .player-actions button { font: 10px Georgia, serif; letter-spacing: .2em; color: rgba(243, 233, 215, .8); background: transparent;
          border: 1px solid rgba(243, 218, 172, .35); padding: 6px 10px; cursor: pointer; }
        .player-guest { font-size: 11px; font-style: italic; color: rgba(243, 233, 215, .6); max-width: 300px; }
        .player-actions { flex-wrap: wrap; }
        .player-actions button.is-guest { font-size: 11px; padding: 8px 14px; color: #f0b356; border-color: rgba(240, 179, 86, .55); }
        .player-actions button.is-main { font-size: 11px; padding: 8px 14px; color: #f6ead2; border-color: rgba(243, 218, 172, .6); background: rgba(87, 38, 12, .35); }
 .player-actions button:hover { color: #fff5e5; border-color: rgba(243, 218, 172, .75); }

        .soon-backdrop { position: fixed; inset: 0; z-index: 40; display: grid; place-items: center; background: rgba(0, 0, 0, .6); }
        .soon { width: min(460px, 90vw); text-align: center; padding: 26px 28px 20px; color: #efe3cb; font-family: Georgia, 'Times New Roman', serif;
          background: linear-gradient(180deg, rgba(16, 12, 9, .97), rgba(8, 6, 5, .97)); border: 1px solid rgba(200, 20, 27, .45); }
        .soon-level { font: clamp(30px, 4vw, 48px) 'Creepster', Georgia, serif; color: #c8141b; letter-spacing: .08em; text-shadow: 2px 2px 0 #1a0000, 0 0 14px rgba(160, 0, 0, .6); }
        .soon h2 { margin: 4px 0 10px; font-weight: normal; letter-spacing: .06em; }
        .soon p { margin: 0 0 8px; font-style: italic; color: rgba(239, 227, 203, .8); }
        .soon-won { color: #f0b356 !important; }
        .soon button { margin-top: 10px; font: 11px Georgia, serif; letter-spacing: .2em; color: rgba(239, 227, 203, .8); background: transparent;
          border: 1px solid rgba(243, 218, 172, .35); padding: 7px 14px; cursor: pointer; }
      `}</style>
    </main>
  )
}
