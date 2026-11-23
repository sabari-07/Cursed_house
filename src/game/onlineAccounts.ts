// Online accounts: the same game accounts, kept by the house's API (Lambda and
// DynamoDB, infra/) instead of this browser. Used when the build has an API
// address (VITE_API_URL). The browser keeps only a session token and a copy of
// the account, so the game can read it straight away; progress is sent to the
// API after every change, in order.

import type { ProgressV2 } from './progress'
import type { Account, PlayerRow } from './accounts'

export const API = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
export const ONLINE = API !== ''

/** What the API says about an account (no secrets). */
interface ApiAccount { name: string; progress: ProgressV2; createdAt: string }
export const ONLINE_PREFIX = 'online:'
export const toAccount = (a: ApiAccount): Account => ({ id: ONLINE_PREFIX + a.name.trim().toLowerCase(), name: a.name, salt: '', hash: '', createdAt: a.createdAt, progress: a.progress })

/** An error from the API: its code (BadCredentials, NameTaken, ...) and a message to show. */
export class ApiFailure extends Error {
  constructor(public code: string, message: string, public status = 0) { super(message) }
}

export async function call<T>(method: string, route: string, body?: unknown, token?: string): Promise<T> {
  let r: Response
  try {
    r = await fetch(API + route, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiFailure('Offline', 'The house could not be reached. Check your connection and try again.')
  }
  const data = await r.json().catch(() => ({})) as { error?: string; message?: string } & T
  if (!r.ok) throw new ApiFailure(data.error || 'Server', data.message || 'The house is not answering. Try again in a moment.', r.status)
  return data
}

export interface SignedIn { token: string; account: Account; recoveryCode?: string }
const signedIn = (d: { token: string; account: ApiAccount; recoveryCode?: string }): SignedIn => ({ token: d.token, account: toAccount(d.account), recoveryCode: d.recoveryCode })

export const apiSignUp = async (name: string, password: string, progress: ProgressV2 | null) =>
  signedIn(await call('POST', '/signup', { name, password, progress }))
export const apiSignIn = async (name: string, password: string) => signedIn(await call('POST', '/signin', { name, password }))
export const apiReset = async (name: string, code: string, password: string) => signedIn(await call('POST', '/reset', { name, code, password }))
export const apiMe = async (token: string) => toAccount((await call<{ account: ApiAccount }>('GET', '/me', undefined, token)).account)
export const apiSignOut = (token: string) => call('POST', '/signout', {}, token).catch(() => undefined)

/** Saves one progress after another (never two at once, so the last one written is the newest). */
let queue: Promise<unknown> = Promise.resolve()
export function apiSaveProgress(token: string, progress: ProgressV2): Promise<void> {
  const next = queue.then(() => call('PUT', '/progress', { progress }, token)).then(() => undefined)
  queue = next.catch(() => undefined)
  return next
}

/** The shared leaderboard (the API's best 50), or null when it can't be reached. */
export async function apiLeaderboard(): Promise<PlayerRow[] | null> {
  try {
    const d = await call<{ players: { name: string; progress: ProgressV2 }[] }>('GET', '/leaderboard')
    return d.players.map(p => ({ name: p.name, progress: p.progress, local: false }))
  } catch { return null }
}
