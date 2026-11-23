// The Cursed House API: accounts (username + password), saved progress and the
// shared leaderboard, in one DynamoDB table. Runs on Lambda (Node.js 20) behind
// an API Gateway HTTP API; the table name comes from the TABLE variable.
//
// Items (pk / sk):
//   USER#<name lower>  PROFILE   name, salt, hash, rsalt, rhash (recovery code), progress, fails, lockUntil,
//                                gpk 'BOARD' + gsk (ranking key) -> the "board" index
//   SESS#<sha256(token)> SESSION  user (name lower), ttl (DynamoDB deletes it when it expires)
//
// Routes: POST /signup, POST /signin, POST /reset, POST /signout, GET /me, PUT /progress, GET /leaderboard

import { DynamoDBClient, ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { pbkdf2, randomBytes, createHash, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } })
const TABLE = process.env.TABLE
const derive = promisify(pbkdf2)
const ITER = 210_000
const NAME_RULE = /^[A-Za-z0-9 _-]{3,16}$/
const MIN_PASSWORD = 6
const SESSION_DAYS = 30
/** Wrong passwords (or recovery codes) before a short lock, and how long it lasts. */
const MAX_FAILS = 8, LOCK_S = 5 * 60
const BOARD_SIZE = 50
/** A whole level can't honestly be cleared faster than this (seconds): faster times are refused. */
const MIN_LEVEL_S = 20

// ── responses ──────────────────────────────────────────────────────────────
const res = (status, body) => ({ statusCode: status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body) })
const fail = (status, code, message) => res(status, { error: code, message })
class ApiError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code } }

// ── helpers ────────────────────────────────────────────────────────────────
const key = name => String(name).trim().toLowerCase()
const sha = s => createHash('sha256').update(s).digest('hex')
const now = () => Math.floor(Date.now() / 1000)
async function hashOf(secret, salt) { return (await derive(secret, salt, ITER, 32, 'sha256')).toString('base64') }
function same(a, b) { const x = Buffer.from(a, 'base64'), y = Buffer.from(b, 'base64'); return x.length === y.length && timingSafeEqual(x, y) }
/** A recovery code a person can copy down: three groups of four, no look-alike letters. */
function recoveryCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', b = randomBytes(12)
  const s = [...b].map(v => A[v % A.length]).join('')
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`
}
const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '')

// ── progress (the same rules as src/game/progress.ts parseProgress) ────────
const TREASURES = ['gold-watch', 'raven-codex', 'heart-of-the-house']
const okTime = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 100000
function fresh() { return { version: 2, level: 1, stage: 1, treasures: [], bestTimes: {}, run: 0, levelTimes: {}, deaths: 0 } }
function parseProgress(r) {
  if (!r || typeof r !== 'object' || r.version !== 2) return null
  const level = r.level, stage = r.stage
  if (![1, 2, 3, 4].includes(level) || ![1, 2, 3, 4, 5].includes(stage)) return null
  const treasures = Array.isArray(r.treasures) ? [...new Set(r.treasures.filter(t => TREASURES.includes(t)))] : []
  const bestTimes = {}
  if (r.bestTimes && typeof r.bestTimes === 'object') for (const [k, v] of Object.entries(r.bestTimes)) if (/^L[1-4]S[1-5]$/.test(k) && okTime(v)) bestTimes[k] = v
  const levelTimes = {}
  if (r.levelTimes && typeof r.levelTimes === 'object') for (const [k, v] of Object.entries(r.levelTimes)) if (/^L[1-3]$/.test(k) && Number(k[1]) < level && okTime(v) && v >= MIN_LEVEL_S) levelTimes[k] = v
  const run = okTime(r.run) ? r.run : 0
  const deaths = typeof r.deaths === 'number' && r.deaths >= 0 && r.deaths < 1e6 ? Math.floor(r.deaths) : 0
  return { version: 2, level, stage, treasures, bestTimes, run, levelTimes, deaths }
}
const cleared = p => p.level - 1
const total = p => Object.values(p.levelTimes).reduce((a, b) => a + b, 0)
/** Sorts the board index: most levels cleared, then the lowest total time, then the fewest deaths. */
const rankKey = p => `${String(9 - cleared(p))}#${String(Math.round(total(p) * 10)).padStart(9, '0')}#${String(p.deaths).padStart(7, '0')}`

// ── table access ───────────────────────────────────────────────────────────
const getUser = async name => (await db.send(new GetCommand({ TableName: TABLE, Key: { pk: `USER#${key(name)}`, sk: 'PROFILE' } }))).Item
const publicAccount = u => ({ name: u.name, progress: u.progress, createdAt: u.createdAt })

async function newSession(user) {
  const token = randomBytes(32).toString('base64url')
  await db.send(new PutCommand({ TableName: TABLE, Item: { pk: `SESS#${sha(token)}`, sk: 'SESSION', user: key(user.name), ttl: now() + SESSION_DAYS * 86400 } }))
  return token
}
async function sessionUser(event) {
  const auth = event.headers?.authorization || event.headers?.Authorization || ''
  const token = /^Bearer ([A-Za-z0-9_-]{20,})$/.exec(auth)?.[1]
  if (!token) throw new ApiError(401, 'NoSession', 'Please sign in again.')
  const s = (await db.send(new GetCommand({ TableName: TABLE, Key: { pk: `SESS#${sha(token)}`, sk: 'SESSION' } }))).Item
  if (!s || s.ttl < now()) throw new ApiError(401, 'NoSession', 'Please sign in again.')
  const u = await getUser(s.user)
  if (!u) throw new ApiError(401, 'NoSession', 'Please sign in again.')
  return { user: u, token }
}

/** Counts a wrong password; locks the account for a few minutes after MAX_FAILS. */
async function countFail(u) {
  const fails = (u.fails || 0) + 1
  await db.send(new UpdateCommand({ TableName: TABLE, Key: { pk: u.pk, sk: 'PROFILE' },
    UpdateExpression: 'SET fails = :f, lockUntil = :l', ExpressionAttributeValues: { ':f': fails >= MAX_FAILS ? 0 : fails, ':l': fails >= MAX_FAILS ? now() + LOCK_S : (u.lockUntil || 0) } }))
}
function checkLock(u) { if (u && u.lockUntil && u.lockUntil > now()) throw new ApiError(429, 'Locked', 'Too many wrong tries. Wait five minutes and try again.') }

// ── routes ─────────────────────────────────────────────────────────────────
const BAD = 'That name and password do not match.'
const DUMMY_SALT = 'AAAAAAAAAAAAAAAAAAAAAA=='

async function signup(b) {
  const name = String(b.name || '').trim()
  if (!NAME_RULE.test(name)) throw new ApiError(400, 'BadName', 'Names are 3 to 16 letters, digits, spaces, - or _.')
  if (typeof b.password !== 'string' || b.password.length < MIN_PASSWORD || b.password.length > 200) throw new ApiError(400, 'BadPassword', `Passwords need at least ${MIN_PASSWORD} characters.`)
  const progress = parseProgress(b.progress) ?? fresh()
  const salt = randomBytes(16).toString('base64'), rsalt = randomBytes(16).toString('base64')
  const code = recoveryCode()
  const item = {
    pk: `USER#${key(name)}`, sk: 'PROFILE', name, salt, hash: await hashOf(b.password, salt), rsalt, rhash: await hashOf(normCode(code), rsalt),
    progress, createdAt: new Date().toISOString(), fails: 0, lockUntil: 0, gpk: 'BOARD', gsk: rankKey(progress),
  }
  try {
    await db.send(new PutCommand({ TableName: TABLE, Item: item, ConditionExpression: 'attribute_not_exists(pk)' }))
  } catch (e) {
    if (e instanceof ConditionalCheckFailedException) throw new ApiError(409, 'NameTaken', 'That name is taken. Try another.')
    throw e
  }
  return res(201, { token: await newSession(item), account: publicAccount(item), recoveryCode: code })
}

async function signin(b) {
  const u = typeof b.name === 'string' ? await getUser(b.name) : null
  checkLock(u)
  // hash even for an unknown name, so the answer takes the same time either way
  const h = await hashOf(String(b.password || ''), u ? u.salt : DUMMY_SALT)
  if (!u || !same(h, u.hash)) { if (u) await countFail(u); throw new ApiError(401, 'BadCredentials', BAD) }
  if (u.fails) await db.send(new UpdateCommand({ TableName: TABLE, Key: { pk: u.pk, sk: 'PROFILE' }, UpdateExpression: 'SET fails = :z', ExpressionAttributeValues: { ':z': 0 } }))
  return res(200, { token: await newSession(u), account: publicAccount(u) })
}

/** Forgot password: the username, the recovery code shown at sign-up, and a new password. */
async function reset(b) {
  if (typeof b.password !== 'string' || b.password.length < MIN_PASSWORD || b.password.length > 200) throw new ApiError(400, 'BadPassword', `Passwords need at least ${MIN_PASSWORD} characters.`)
  const u = typeof b.name === 'string' ? await getUser(b.name) : null
  checkLock(u)
  const h = await hashOf(normCode(b.code), u ? u.rsalt : DUMMY_SALT)
  if (!u || !same(h, u.rhash)) { if (u) await countFail(u); throw new ApiError(401, 'BadRecovery', 'That name and recovery code do not match.') }
  const salt = randomBytes(16).toString('base64')
  await db.send(new UpdateCommand({ TableName: TABLE, Key: { pk: u.pk, sk: 'PROFILE' },
    UpdateExpression: 'SET salt = :s, #h = :h, fails = :z, lockUntil = :z', ExpressionAttributeNames: { '#h': 'hash' },
    ExpressionAttributeValues: { ':s': salt, ':h': await hashOf(b.password, salt), ':z': 0 } }))
  return res(200, { token: await newSession(u), account: publicAccount(u) })
}

async function saveProgress(event, b) {
  const { user } = await sessionUser(event)
  const p = parseProgress(b.progress)
  if (!p) throw new ApiError(400, 'BadProgress', 'That save could not be read.')
  // levels once cleared stay cleared (a death only goes back to a level's first stage)
  if (p.level < user.progress.level) throw new ApiError(409, 'Stale', 'A newer save exists. Reload the page.')
  await db.send(new UpdateCommand({ TableName: TABLE, Key: { pk: user.pk, sk: 'PROFILE' },
    UpdateExpression: 'SET progress = :p, gsk = :g', ExpressionAttributeValues: { ':p': p, ':g': rankKey(p) } }))
  return res(200, { account: publicAccount({ ...user, progress: p }) })
}

async function leaderboard() {
  const r = await db.send(new QueryCommand({ TableName: TABLE, IndexName: 'board', KeyConditionExpression: 'gpk = :b',
    ExpressionAttributeValues: { ':b': 'BOARD' }, ProjectionExpression: '#n, progress', ExpressionAttributeNames: { '#n': 'name' }, Limit: BOARD_SIZE }))
  return res(200, { players: (r.Items || []).map(i => ({ name: i.name, progress: i.progress })) })
}

export async function handler(event) {
  const route = `${event.requestContext?.http?.method} ${event.rawPath}`
  let body = {}
  try { body = event.body ? JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body) : {} } catch { return fail(400, 'BadJson', 'The request could not be read.') }
  if (!body || typeof body !== 'object') body = {}
  try {
    switch (route) {
      case 'POST /signup': return await signup(body)
      case 'POST /signin': return await signin(body)
      case 'POST /reset': return await reset(body)
      case 'POST /signout': { const { token } = await sessionUser(event); await db.send(new DeleteCommand({ TableName: TABLE, Key: { pk: `SESS#${sha(token)}`, sk: 'SESSION' } })); return res(200, { ok: true }) }
      case 'GET /me': { const { user } = await sessionUser(event); return res(200, { account: publicAccount(user) }) }
      case 'PUT /progress': return await saveProgress(event, body)
      case 'GET /leaderboard': return await leaderboard()
      default: return fail(404, 'NotFound', 'No such page.')
    }
  } catch (e) {
    if (e instanceof ApiError) return fail(e.status, e.code, e.message)
    console.error(e)
    return fail(500, 'Server', 'The house is not answering. Try again in a moment.')
  }
}
