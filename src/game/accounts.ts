// Player accounts. On the deployed site (built with VITE_API_URL) they are kept
// by the house's API (onlineAccounts.ts: Lambda + DynamoDB) and work on any
// device; without an API they are stored as JSON in this browser's localStorage.
//
// The browser-only mode:
// This is a per-browser login for a game, not a secure account system: the
// data never leaves the browser. Passwords are never stored, only a salted
// PBKDF2-SHA-256 hash. The deployed seed file (public/data/users.json) holds
// leaderboard rows only (names and progress), never hashes, because every
// file under public/ can be downloaded by anyone.

import { freshProgress, migrateV1, parseProgress, type ProgressV2 } from './progress'
import { ONLINE, ONLINE_PREFIX, ApiFailure, apiMe, apiReset, apiSaveProgress, apiSignIn, apiSignOut, apiSignUp, type SignedIn } from './onlineAccounts'

export { ONLINE } from './onlineAccounts'

export const USERS_KEY = 'ghostwriter_users_v1'
export const SESSION_KEY = 'ghostwriter_session_v1'
export const LEGACY_PROGRESS_KEY = 'ghostwriter_progress_v1'
export const SEED_URL = '/data/users.json'
/** A guest's progress: kept in this browser, never on the leaderboard, carried into an account on sign-up. */
export const GUEST_KEY = 'ghostwriter_guest_v1'
export const GUEST_ID = 'guest'

const PBKDF2 = { iterations: 100_000, saltBytes: 16, hashBits: 256 }

export interface Account {
  id: string
  name: string
  salt: string
  hash: string
  createdAt: string
  progress: ProgressV2
}

interface UsersFileV1 { version: 1; users: Account[] }

/** A leaderboard row: no secrets. */
export interface PlayerRow { name: string; progress: ProgressV2; local: boolean }

export class AccountError extends Error {
  constructor(public code: 'BadName' | 'BadPassword' | 'NameTaken' | 'BadCredentials' | 'NoAccount' | 'NoCrypto' | 'NoStorage' | 'BadRecovery' | 'Locked' | 'Offline' | 'Server', message: string) {
    super(message)
  }
}

export const NAME_RULE = /^[A-Za-z0-9 _-]{3,16}$/
export const MIN_PASSWORD = 6

const key = (name: string) => name.trim().toLowerCase()

// ── storage ───────────────────────────────────────────────────────────────

function readStore(): UsersFileV1 {
  let raw: string | null
  try { raw = localStorage.getItem(USERS_KEY) } catch { return { version: 1, users: [] } }
  if (raw === null) return { version: 1, users: [] }
  try {
    const f = JSON.parse(raw) as UsersFileV1
    if (f && f.version === 1 && Array.isArray(f.users)) {
      const users = f.users
        .filter(u => u && typeof u.id === 'string' && typeof u.name === 'string' && typeof u.salt === 'string' && typeof u.hash === 'string')
        .map(u => ({ ...u, progress: parseProgress(u.progress) ?? freshProgress() }))
      return { version: 1, users }
    }
  } catch { /* fall through: corrupt */ }
  // corrupt: keep a copy so nothing is lost, and start again
  try { localStorage.setItem(`${USERS_KEY}_corrupt_${Date.now()}`, raw) } catch { /* full */ }
  return { version: 1, users: [] }
}

function writeStore(f: UsersFileV1): void {
  try { localStorage.setItem(USERS_KEY, JSON.stringify(f)) } catch {
    throw new AccountError('NoStorage', 'This browser will not let the game save. You can still play as a guest.')
  }
}

// ── hashing ───────────────────────────────────────────────────────────────

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0))

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle
  if (!s) throw new AccountError('NoCrypto', 'Use the https site to create an account.')
  return s
}

async function pbkdf2(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const s = subtle()
  const base = await s.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await s.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: PBKDF2.iterations }, base, PBKDF2.hashBits)
  return new Uint8Array(bits)
}

/** Compares two byte arrays in time that doesn't depend on where they differ. */
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return diff === 0
}

// ── accounts ──────────────────────────────────────────────────────────────

export function checkName(name: string): string {
  const n = name.trim()
  if (!NAME_RULE.test(n)) throw new AccountError('BadName', 'Names are 3 to 16 letters, digits, spaces, - or _.')
  return n
}

function legacyProgress(): ProgressV2 {
  try { return migrateV1(JSON.parse(localStorage.getItem(LEGACY_PROGRESS_KEY) || 'null')) } catch { return freshProgress() }
}

/** An account just made online, with the recovery code to show once (it is never shown again). */
export type NewAccount = Account & { recoveryCode?: string }

/** Runs an API call; turns its failure into an AccountError with the API's message. */
async function online(run: () => Promise<SignedIn>): Promise<NewAccount> {
  try {
    const r = await run()
    setOnlineSession(r.token, r.account)
    return { ...r.account, recoveryCode: r.recoveryCode }
  } catch (e) {
    if (e instanceof ApiFailure) throw new AccountError((e.code as AccountError['code']) || 'Server', e.message)
    throw e
  }
}

export async function signUp(name: string, password: string): Promise<NewAccount> {
  const n = checkName(name)
  if (ONLINE) {
    if (password.length < MIN_PASSWORD) throw new AccountError('BadPassword', `Passwords need at least ${MIN_PASSWORD} characters.`)
    const guest = isGuest() ? readGuest() : null
    const a = await online(() => apiSignUp(n, password, guest))
    if (guest) { try { localStorage.removeItem(GUEST_KEY) } catch { /* nothing to do */ } }
    return a
  }
  if (password.length < MIN_PASSWORD) throw new AccountError('BadPassword', `Passwords need at least ${MIN_PASSWORD} characters.`)
  const store = readStore()
  if (store.users.some(u => key(u.name) === key(n))) throw new AccountError('NameTaken', 'That name is taken. Try another.')
  const salt = crypto.getRandomValues(new Uint8Array(PBKDF2.saltBytes))
  const hash = await pbkdf2(password, salt)
  // a guest who signs up keeps what they won; otherwise the first account on
  // this browser inherits progress from the old Stage 1 save
  const guest = isGuest() ? readGuest() : null
  const progress = guest ?? (store.users.length === 0 ? legacyProgress() : freshProgress())
  const account: Account = { id: crypto.randomUUID(), name: n, salt: b64(salt), hash: b64(hash), createdAt: new Date().toISOString(), progress }
  writeStore({ version: 1, users: [...store.users, account] })
  setSession(account.id)
  if (guest) { try { localStorage.removeItem(GUEST_KEY) } catch { /* nothing to do */ } }
  return account
}

const BAD_CREDENTIALS = 'That name and password do not match.'

export async function signIn(name: string, password: string): Promise<Account> {
  if (ONLINE) return online(() => apiSignIn(name, password))
  const store = readStore()
  const u = store.users.find(x => key(x.name) === key(name))
  // hash even for an unknown name, so the answer takes the same time either way
  const salt = u ? unb64(u.salt) : new Uint8Array(PBKDF2.saltBytes)
  const hash = await pbkdf2(password, salt)
  if (!u || !sameBytes(hash, unb64(u.hash))) throw new AccountError('BadCredentials', BAD_CREDENTIALS)
  setSession(u.id)
  return u
}

/**
 * Forgot password: sets a new password for the account with this name and
 * signs it in. Accounts live in this browser only, so whoever can use the
 * browser can already reach them; the name is all that is asked.
 */
export async function resetPassword(name: string, password: string, recoveryCode = ''): Promise<Account> {
  // online, a name alone is not enough: the recovery code shown at sign-up proves the account is yours
  if (ONLINE) {
    if (password.length < MIN_PASSWORD) throw new AccountError('BadPassword', `Passwords need at least ${MIN_PASSWORD} characters.`)
    return online(() => apiReset(name, recoveryCode, password))
  }
  if (password.length < MIN_PASSWORD) throw new AccountError('BadPassword', `Passwords need at least ${MIN_PASSWORD} characters.`)
  const store = readStore()
  const u = store.users.find(x => key(x.name) === key(name))
  if (!u) throw new AccountError('NoAccount', 'There is no account with that name in this browser.')
  const salt = crypto.getRandomValues(new Uint8Array(PBKDF2.saltBytes))
  const hash = await pbkdf2(password, salt)
  const updated: Account = { ...u, salt: b64(salt), hash: b64(hash) }
  writeStore({ version: 1, users: store.users.map(x => (x.id === u.id ? updated : x)) })
  setSession(u.id)
  return updated
}

function setSession(userId: string): void {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ version: 1, userId })) } catch { /* guest */ }
}

/** Online: the session token and a copy of the account (so the game can read it at once). */
interface OnlineSession { version: 1; userId: string; token: string; account: Account }
function setOnlineSession(token: string, account: Account): void {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ version: 1, userId: account.id, token, account } satisfies OnlineSession)) } catch { /* plays on, unsaved */ }
}
function onlineSession(): OnlineSession | null {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') as Partial<OnlineSession> | null
    if (!s || s.version !== 1 || typeof s.token !== 'string' || !s.userId?.startsWith(ONLINE_PREFIX) || !s.account) return null
    const progress = parseProgress(s.account.progress) ?? freshProgress()
    return { version: 1, userId: s.userId, token: s.token, account: { ...s.account, progress } }
  } catch { return null }
}

export function signOut(): void {
  const o = onlineSession()
  if (o) void apiSignOut(o.token)
  try { localStorage.removeItem(SESSION_KEY) } catch { /* nothing to do */ }
}

/**
 * Online: asks the API for the signed-in account (progress made on another
 * device). Returns it, null when the session has ended (signed out here), or
 * the cached copy when the API can't be reached.
 */
export async function refreshAccount(): Promise<Account | null> {
  const o = onlineSession()
  if (!o) return current()
  try {
    const a = await apiMe(o.token)
    // a save that never reached the house (offline) is further on than the house's copy: send it again
    const mine = o.account.progress, theirs = a.progress
    if (mine.level > theirs.level || (mine.level === theirs.level && mine.deaths === theirs.deaths && mine.stage > theirs.stage)) {
      void apiSaveProgress(o.token, mine).catch(() => undefined)
      return o.account
    }
    setOnlineSession(o.token, a)
    return a
  } catch (e) {
    if (e instanceof ApiFailure && e.status === 401) { try { localStorage.removeItem(SESSION_KEY) } catch { /* nothing */ } return null }
    return o.account
  }
}

// ── guest play ────────────────────────────────────────────────────────────

function readGuest(): ProgressV2 {
  try { return parseProgress(JSON.parse(localStorage.getItem(GUEST_KEY) || 'null')) ?? freshProgress() } catch { return freshProgress() }
}
const guestAccount = (): Account => ({ id: GUEST_ID, name: 'Guest', salt: '', hash: '', createdAt: '', progress: readGuest() })

/** Plays without an account: progress stays in this browser and off the leaderboard. */
export function startGuest(): Account {
  setSession(GUEST_ID)
  return guestAccount()
}
export const isGuest = (a?: Account | null): boolean => (a ? a.id === GUEST_ID : current()?.id === GUEST_ID)

/** The signed-in account (or the guest), if any. */
export function current(): Account | null {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') as { version?: number; userId?: string } | null
    if (!s || s.version !== 1 || typeof s.userId !== 'string') return null
    if (s.userId === GUEST_ID) return guestAccount()
    if (s.userId.startsWith(ONLINE_PREFIX)) return onlineSession()?.account ?? null
    return readStore().users.find(u => u.id === s.userId) ?? null
  } catch { return null }
}

/** Saves progress for the signed-in account (or the guest). Returns the updated account. */
export function saveProgress(progress: ProgressV2): Account | null {
  const me = current()
  if (!me) return null
  if (me.id === GUEST_ID) {
    try { localStorage.setItem(GUEST_KEY, JSON.stringify(progress)) } catch { /* plays on, unsaved */ }
    return { ...me, progress }
  }
  const o = onlineSession()
  if (o) {
    const a = { ...o.account, progress }
    setOnlineSession(o.token, a)
    // sent in order; if it fails, the next save carries the newer progress anyway
    void apiSaveProgress(o.token, progress).catch(() => undefined)
    return a
  }
  const store = readStore()
  const users = store.users.map(u => (u.id === me.id ? { ...u, progress } : u))
  writeStore({ version: 1, users })
  return users.find(u => u.id === me.id) ?? null
}

// ── the leaderboard's players: the seed file plus this browser's accounts ──

/** Reads the deployed seed file. Ignores any secret fields; returns [] if it is missing or invalid. */
export function parseSeed(raw: unknown): PlayerRow[] {
  if (!raw || typeof raw !== 'object' || (raw as { version?: number }).version !== 1) return []
  const players = (raw as { players?: unknown }).players
  if (!Array.isArray(players)) return []
  const out: PlayerRow[] = []
  for (const p of players) {
    if (!p || typeof p !== 'object') continue
    const name = (p as { name?: unknown }).name
    const progress = parseProgress((p as { progress?: unknown }).progress)
    if (typeof name !== 'string' || !NAME_RULE.test(name.trim()) || !progress) continue
    out.push({ name: name.trim(), progress, local: false })
  }
  return out
}

export async function loadSeed(fetcher: typeof fetch = fetch): Promise<PlayerRow[] | null> {
  try {
    const r = await fetcher(SEED_URL, { cache: 'no-cache' })
    if (!r.ok) return null
    return parseSeed(await r.json())
  } catch { return null }
}

/** Seed rows and local accounts, one row per name (a local account replaces a seed row of the same name). */
export function mergePlayers(seed: PlayerRow[]): PlayerRow[] {
  const local = readStore().users.map(u => ({ name: u.name, progress: u.progress, local: true }))
  const names = new Set(local.map(l => key(l.name)))
  return [...seed.filter(s => !names.has(key(s.name))), ...local]
}

/** The seed-file JSON for this browser's accounts (development only): names and progress, never hashes. */
export function exportSeed(seed: PlayerRow[] = []): string {
  const players = mergePlayers(seed).map(p => ({ name: p.name, progress: p.progress }))
  return JSON.stringify({ version: 1, players }, null, 2)
}
