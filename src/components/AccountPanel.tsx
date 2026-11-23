import { useEffect, useRef, useState } from 'react'
import { AccountError, MIN_PASSWORD, ONLINE, resetPassword, signIn, signUp, type Account } from '../game/accounts'
import type { LandingScene } from '../scenes/LandingScene'

export type AccountMode = 'signin' | 'signup' | 'reset'

interface Props {
  onDone: (a: Account) => void
  onClose: () => void
  /** Which tab opens first. */
  mode?: AccountMode
  /** The landing scene: the shake's thud goes through its sound (and its mute). */
  scene?: LandingScene | null
  /** Play without an account (not offered to a guest who is signing up). */
  onGuest?: () => void
  /** A guest signing up: what they won comes with them. */
  carrying?: boolean
}

/** A wrong password: the box is struck and rattles (a heavy door slam, already in the game and credited). */
const THUD = '/audio/door-slam.mp3'
/** Wrong tries before the box shakes and closes. */
const MAX_TRIES = 2
/** How long one shake lasts (ms); the CSS animation has the same length. */
const SHAKE_MS = 520

/**
 * SIGN IN / SIGN UP over the landing. A wrong password shakes the box with a
 * thud; the second wrong try shakes it and closes it. FORGOT PASSWORD sets a
 * new password: online with the recovery code shown once at sign-up; in the
 * browser-only build with the name alone.
 */
export function AccountPanel({ onDone, onClose, mode: firstMode = 'signin', scene = null, onGuest, carrying = false }: Props) {
  const [mode, setMode] = useState<AccountMode>(firstMode)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [code, setCode] = useState('')
  /** Online sign-up: the new account and its recovery code, shown once before the game goes on. */
  const [made, setMade] = useState<{ account: Account; code: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(0)
  const [closing, setClosing] = useState(false)
  const tries = useRef(0)
  const timers = useRef<number[]>([])
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    void scene?.preloadClip(THUD)
    const t = timers.current
    return () => t.forEach(id => window.clearTimeout(id))
  }, [scene])

  const switchTo = (m: AccountMode) => { setMode(m); setError(null); setConfirm(''); setPassword('') }

  /** A wrong password: the thud and the shake start together; the second time the box then closes. */
  const wrong = () => {
    tries.current += 1
    void scene?.playRecording(THUD, tries.current >= MAX_TRIES ? 0.9 : 0.6)
    setShake(n => n + 1)
    if (tries.current >= MAX_TRIES) {
      setClosing(true)
      timers.current.push(window.setTimeout(() => onCloseRef.current(), SHAKE_MS + 350))
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError(null)
    if (mode !== 'signin' && password !== confirm) {
      setError('The two passwords do not match.')
      return
    }
    setBusy(true)
    try {
      if (mode === 'signup') {
        const a = await signUp(name, password)
        if (a.recoveryCode) { const { recoveryCode, ...account } = a; setMade({ account, code: recoveryCode }); return }
        onDone(a)
      } else onDone(mode === 'reset' ? await resetPassword(name, password, code) : await signIn(name, password))
    } catch (err) {
      setError(err instanceof AccountError ? err.message : 'Something went wrong. Try again.')
      if (mode === 'signin' && err instanceof AccountError && err.code === 'BadCredentials') {
        wrong()
        setPassword('')
        if (tries.current >= MAX_TRIES) setError('Wrong again. The house shuts you out.')
        else setError(`${err.message} One more wrong try and this box closes.`)
      }
    } finally {
      setBusy(false)
    }
  }


  return (
    <div className={`acct-backdrop ${closing ? 'is-closing' : ''}`} onClick={made ? undefined : onClose}>
      {made ? (<>
        <section className="acct acct-code" role="dialog" aria-label="Your recovery code">
          <p className="acct-code-title">WRITE THIS DOWN</p>
          <p className="acct-hint">This is your recovery code. If you forget your password, it is the only way back into your account. It will not be shown again.</p>
          <div className="acct-code-value" aria-label="Recovery code">{made.code}</div>
          <button type="button" className="acct-go" onClick={() => { void navigator.clipboard?.writeText(made.code).catch(() => undefined) }}>COPY THE CODE</button>
          <button type="button" className="acct-go" onClick={() => onDone(made.account)}>I HAVE SAVED IT, GO ON</button>
        </section>
        <style>{`
          .acct-code { text-align: center; }
          .acct-code-title { margin: 0; font: 22px 'Creepster', Georgia, serif; letter-spacing: .08em; color: #c8141b; }
          .acct-code-value { margin: 6px 0; font: 26px 'Courier New', monospace; letter-spacing: .12em; color: #f0b356; user-select: all; -webkit-user-select: all;
            padding: 10px; border: 1px dashed rgba(240, 179, 86, .6); background: rgba(0, 0, 0, .45); }
        `}</style>
      </>) : (
      <form key={shake} className={`acct ${shake ? 'is-shaking' : ''}`} onClick={e => e.stopPropagation()} onSubmit={submit}
        aria-label={mode === 'signup' ? 'Sign up' : mode === 'reset' ? 'Reset password' : 'Sign in'}>
        <div className="acct-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'is-on' : ''} onClick={() => switchTo('signin')}>SIGN IN</button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'is-on' : ''} onClick={() => switchTo('signup')}>SIGN UP</button>
        </div>
        <label>
          <span>Username</span>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} maxLength={16} autoComplete="username" required />
        </label>
        {mode === 'reset' && <p className="acct-hint">{ONLINE ? 'Forgot your password? Type your username, the recovery code you were given at sign-up, and a new password.' : 'Forgot your password? Type your username and choose a new password.'}</p>}
        {mode === 'reset' && ONLINE && (
          <label>
            <span>Recovery code</span>
            <input name="code" value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={20} autoComplete="off" spellCheck={false} placeholder="XXXX-XXXX-XXXX" required />
          </label>
        )}
        <label className="acct-pass">
          <span>{mode === 'reset' ? 'New password' : 'Password'}</span>
          <input type="password" name="password" value={password} onChange={e => setPassword(e.target.value)}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required minLength={mode === 'signin' ? 1 : MIN_PASSWORD} />
        </label>
        {mode !== 'signin' && (
          <label>
            <span>{mode === 'reset' ? 'Confirm new password' : 'Confirm password'}</span>
            <input type="password" name="confirm" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" required minLength={MIN_PASSWORD} />
          </label>
        )}
        {mode === 'signup' && <p className="acct-hint">Username: 3 to 16 letters or digits. Password: at least {MIN_PASSWORD} characters.</p>}
        {mode === 'reset' && <p className="acct-hint">Password: at least {MIN_PASSWORD} characters.</p>}
        {error && <p className="acct-error" role="alert">{error}</p>}
        <button type="submit" className="acct-go" disabled={busy}>{busy ? '…' : mode === 'signup' ? 'SIGN UP' : mode === 'reset' ? 'SET NEW PASSWORD' : 'SIGN IN'}</button>
        {mode === 'signin' && <button type="button" className="acct-forgot" onClick={() => switchTo('reset')}>Forgot password?</button>}
        {mode === 'reset' && <button type="button" className="acct-forgot" onClick={() => switchTo('signin')}>Back to sign in</button>}
        {carrying && mode === 'signup' && <p className="acct-carry">Everything you have won as a guest moves to your new account.</p>}
 <p className="acct-note">{ONLINE ? 'Your account is kept by the house: sign in on any device.' : 'Your account is saved in this browser only.'}</p>
 {onGuest && (
 <button type="button" className="acct-guest" onClick={onGuest}>or PLAY AS A GUEST — no account needed</button>
 )}
      </form>
      )}
      <style>{`
        .acct-backdrop { position: fixed; inset: 0; z-index: 40; display: grid; place-items: center; background: rgba(0, 0, 0, .38);
          animation: acctIn .3s ease both; transition: background .25s ease; }
        .acct-backdrop.is-closing { animation: acctOut .35s ease ${SHAKE_MS}ms both; pointer-events: none; }
        @keyframes acctOut { to { opacity: 0; } }
        /* a phone held sideways (and its keyboard open): a tighter box that scrolls instead of being cut off */
        @media (max-height: 560px) {
          .acct-backdrop { overflow-y: auto; place-items: start center; padding: 8px 0; }
          .acct { gap: 7px; padding: 12px 18px 10px; width: min(420px, 70vw); }
          .acct input { padding: 6px 9px; font-size: 16px; }
          .acct-go { padding: 8px; margin-top: 2px; }
          .acct-note { display: none; }
          .acct-tabs button { padding: 6px; }
          .acct label { gap: 2px; }
        }
        /* a wrong password: the box is struck and rattles side to side, settling */
        .acct.is-shaking { animation: acctShake ${SHAKE_MS}ms cubic-bezier(.36, .07, .19, .97) both; }
        @keyframes acctShake {
          0% { transform: translateX(0); } 8% { transform: translateX(-14px) rotate(-1deg); } 20% { transform: translateX(12px) rotate(.8deg); }
          32% { transform: translateX(-10px) rotate(-.6deg); } 46% { transform: translateX(8px); } 60% { transform: translateX(-5px); }
          74% { transform: translateX(3px); } 88% { transform: translateX(-1px); } 100% { transform: translateX(0); } }
        .acct-forgot { margin-top: -4px; font: italic 12px Georgia, serif; color: rgba(240, 179, 86, .9); background: transparent; border: 0;
          cursor: pointer; padding: 2px; text-decoration: underline; text-underline-offset: 3px; }
        .acct-forgot:hover { color: #ffd38a; }
        @media (prefers-reduced-motion: reduce) { .acct.is-shaking { animation: none; } }
        .acct { position: relative; width: min(380px, 90vw); display: grid; gap: 12px; padding: 22px 24px 18px; color: #efe3cb; font-family: Georgia, 'Times New Roman', serif;
          background: linear-gradient(180deg, rgba(16, 12, 9, .94), rgba(8, 6, 5, .94)); border: 1px solid rgba(243, 218, 172, .4);
          box-shadow: 0 0 40px rgba(240, 142, 38, .14), 0 20px 60px rgba(0, 0, 0, .7); }
        .acct-tabs { display: flex; gap: 6px; }
        .acct-tabs button { flex: 1; font: 11px Georgia, serif; letter-spacing: .18em; padding: 8px 6px; cursor: pointer; color: rgba(239, 227, 203, .6);
          background: transparent; border: 1px solid rgba(243, 218, 172, .2); }
        .acct-tabs button.is-on { color: #f6ead2; border-color: rgba(243, 218, 172, .7); background: rgba(87, 38, 12, .4); }
        .acct label { position: relative; display: grid; gap: 4px; font-size: 12px; letter-spacing: .08em; color: rgba(239, 227, 203, .75); }
        .acct input { font: 16px Georgia, serif; color: #f6ead2; background: rgba(0, 0, 0, .45); border: 1px solid rgba(243, 218, 172, .35); padding: 8px 10px; }
        .acct input:focus { outline: none; border-color: #f0b356; box-shadow: 0 0 0 2px rgba(240, 179, 86, .25); }
        .acct-hint { margin: 0; font-size: 11px; font-style: italic; color: rgba(239, 227, 203, .55); }
        .acct-error { margin: 0; font-size: 13px; color: #e0453a; }
        .acct-go { font: 12px Georgia, serif; letter-spacing: .22em; color: #f6ead2; cursor: pointer; padding: 10px; margin-top: 4px;
          background: linear-gradient(180deg, #5a2a10, #2e1408); border: 1px solid rgba(240, 180, 110, .6); }
        .acct-go:disabled { opacity: .5; cursor: wait; }
        .acct-carry { margin: 0; font-size: 12px; color: #f0b356; text-align: center; }
 .acct-guest { font: italic 12px Georgia, serif; letter-spacing: .06em; color: rgba(240, 179, 86, .9); background: transparent; border: 0; cursor: pointer; padding: 2px; text-decoration: underline; text-underline-offset: 3px; }
 .acct-guest:hover { color: #ffd38a; }
 .acct-note { margin: 0; font-size: 11px; text-align: center; color: rgba(239, 227, 203, .45); }
        @keyframes acctIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  )
}
