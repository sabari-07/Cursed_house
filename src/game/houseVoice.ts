// ─── THE HOUSE'S VOICE ──────────────────────────────────────────────────────
// Every message the player reads when something goes wrong, said by the house
// itself: a little mischief, then exactly what to do next. The account code
// (AccountError.code, the same from the browser store and the online API)
// picks the line, so the wording is the same on the live site and offline.
// Lines are plain English (the same check as the riddles: short sentences,
// short words), which houseVoice.test.ts proves for every line.
// ─────────────────────────────────────────────────────────────────────────────
import { MIN_PASSWORD, type AccountError } from './accounts'

export type AccountCode = AccountError['code']

/** One line per account error. A wrong name and a wrong password still read the same. */
const ACCOUNT_LINES: Record<AccountCode, string> = {
  BadCredentials: "The house doesn't remember you. Check your name and password, and try again… if you dare.",
  BadName: "The house can't carve that on a tombstone. Use 3 to 16 letters, digits, spaces, - or _.",
  BadPassword: `Too short. Even the ghosts could guess that. Use at least ${MIN_PASSWORD} characters.`,
  NameTaken: 'Someone already haunts that name. Pick another one.',
  NoAccount: 'Nobody by that name has ever lived here. Check the spelling, or sign up.',
  BadRecovery: "That code opens nothing in this house. Use the recovery code you were given at sign-up.",
  Locked: 'Too many wrong guesses. The doors are bolted for five minutes. Go and make some tea.',
  Offline: "The house can't hear you. Check your connection and try again.",
  Server: 'The house is muttering to itself. Try again in a moment.',
  NoCrypto: 'The house only keeps secrets over https. Open the https address to make an account.',
  NoStorage: "This browser won't let the house remember anything. You can still play as a guest.",
}

/** The house's line for an account error code (unknown codes fall back to a general one). */
export function houseSays(code: string | undefined): string {
  return (code && ACCOUNT_LINES[code as AccountCode]) || ACCOUNT_LINES.Server
}

/** Sign-up and new-password forms: the two passwords differ. */
export const PASSWORDS_DIFFER = 'Your two passwords disagree, and the house trusts neither. Type them again.'
/** After the first wrong password (the box shakes). */
export const ONE_MORE_TRY = 'One more wrong try and this box slams shut.'
/** After the last wrong password (the box shakes and closes). */
export const SHUT_OUT = 'Wrong again. The house slams the door in your face. Take a breath, then try again.'

export type DeathCause = 'wrong' | 'time'

const DEATH_LINES: Record<DeathCause, string[]> = {
  wrong: [
    'Wrong answer. The witch has been waiting all night for that.',
    'Wrong. Somewhere upstairs, the witch is clapping.',
    'Not quite. The house will remember you fondly.',
    'Wrong. The portraits saw that coming.',
  ],
  time: [
    "Time's up. The last candle drowned in its own wax.",
    'Too slow. The witch got bored of waiting.',
    'The candles ran out before you did.',
    'Out of time. The house is very patient. The witch is not.',
  ],
}

/** What killed Arjun, said by the house. `deaths` (the count after this one) varies the line. */
export function deathLine(cause: DeathCause, deaths: number): string {
  const lines = DEATH_LINES[cause]
  return lines[Math.max(0, Math.floor(deaths)) % lines.length]
}

/** A remark on how often Arjun has died, or null the first time. */
export function deathCount(deaths: number): string | null {
  const n = Math.floor(deaths)
  if (!Number.isFinite(n) || n < 2) return null
  if (n === 2) return "Second time. She's starting to recognise you."
  if (n < 5) return `${n} times now. The witch has started saving you a seat.`
  if (n < 10) return `${n} deaths. Grandfather would be proud. Of the witch.`
  return `${n} deaths. The house is thinking of naming a room after you.`
}

/** What to do differently next time, by cause (the "make it easy" half of the scare). */
export function deathTip(cause: DeathCause): string {
  return cause === 'time'
    ? 'The candles are the timer. Press ANSWER before they burn out.'
    : 'Every answer is in the room. Read the question again, and look closer.'
}

// ── Grandfather's ghost: the first-visit guide ───────────────────────────────

/** Saved once the guide has been shown, so it only greets a first-time player. */
export const GUIDE_KEY = 'ghostwriter_guide_v1'

/** The two whispers: first the candle, then the one-chance ANSWER button. */
export function guideLines(touch: boolean): { candle: string; answer: string } {
  return {
    candle: touch
      ? "Psst. Arjun. It's me, Grandfather. Too dark? Tap the candle, then drag your finger."
      : "Psst. Arjun. It's me, Grandfather. Too dark? Pick up the candle. Its light follows your mouse.",
    answer: 'When you are sure, press ANSWER. You only get one go. Ask me how I know.',
  }
}

/** True when this browser has not seen the guide yet. */
export function guideDue(): boolean {
  try { return localStorage.getItem(GUIDE_KEY) === null } catch { return false }
}
/** Remembers that the guide was seen (a versioned JSON value, like the other saves). */
export function markGuideSeen(): void {
  try { localStorage.setItem(GUIDE_KEY, JSON.stringify({ version: 1, seen: true })) } catch { /* shown again next visit */ }
}

/** For tests: every line the house can say. */
export function allHouseLines(): string[] {
  const g = [guideLines(false), guideLines(true)].flatMap(x => [x.candle, x.answer])
  return [
    ...Object.values(ACCOUNT_LINES), PASSWORDS_DIFFER, ONE_MORE_TRY, SHUT_OUT,
    ...DEATH_LINES.wrong, ...DEATH_LINES.time, deathTip('wrong'), deathTip('time'),
    ...[2, 3, 7, 12].map(n => deathCount(n) as string), ...g,
  ]
}
