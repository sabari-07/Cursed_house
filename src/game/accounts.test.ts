import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  AccountError, GUEST_KEY, LEGACY_PROGRESS_KEY, USERS_KEY, current, exportSeed, isGuest, mergePlayers, parseSeed, saveProgress, signIn, signOut, signUp, startGuest,
} from './accounts'
import { compare, formatTime, rank } from './leaderboard'
import { freshProgress, type ProgressV2 } from './progress'

beforeAll(() => {
  // the hashing needs the Web Crypto API (Node provides it to the test environment)
  expect(globalThis.crypto?.subtle).toBeTruthy()
})
beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

const err = async (p: Promise<unknown>) => { try { await p } catch (e) { return e as AccountError } return null }

describe('accounts (JSON in localStorage)', () => {
  // Property 7: sign-up then sign-in round-trips; any other password fails like an unknown name
  it('signs up, signs out, signs back in; wrong password and unknown name give the same error', async () => {
    const a = await signUp('Arjun', 'lantern1')
    expect(current()?.id).toBe(a.id)
    signOut()
    expect(current()).toBeNull()
    const b = await signIn('  arjun ', 'lantern1')
    expect(b.id).toBe(a.id)
    const wrong = await err(signIn('Arjun', 'lantern2'))
    const unknown = await err(signIn('Nobody', 'lantern1'))
    expect(wrong?.code).toBe('BadCredentials')
    expect(unknown?.code).toBe('BadCredentials')
    expect(wrong?.message).toBe(unknown?.message)
  })

  it('never stores the password, only a salted hash (different for the same password)', async () => {
    await signUp('Meera', 'secret-pw')
    await signUp('Ravi', 'secret-pw')
    const raw = localStorage.getItem(USERS_KEY)!
    expect(raw).not.toContain('secret-pw')
    const users = JSON.parse(raw).users
    expect(users[0].hash).not.toBe(users[1].hash)
    expect(users[0].salt).not.toBe(users[1].salt)
  })

  // Property 8: names are unique ignoring case and surrounding spaces
  it('refuses taken names, bad names and short passwords', async () => {
    await signUp('Arjun', 'lantern1')
    expect((await err(signUp(' ARJUN ', 'whatever1')))?.code).toBe('NameTaken')
    expect((await err(signUp('ab', 'whatever1')))?.code).toBe('BadName')
    expect((await err(signUp('<script>', 'whatever1')))?.code).toBe('BadName')
    expect((await err(signUp('Lakshmi', '12345')))?.code).toBe('BadPassword')
  })

  it('saves progress for the signed-in account only', async () => {
    await signUp('One', 'password1')
    const two = await signUp('Two', 'password2')
    const p: ProgressV2 = { ...freshProgress(), stage: 3 }
    saveProgress(p)
    const users = JSON.parse(localStorage.getItem(USERS_KEY)!).users
    expect(users.find((u: { id: string }) => u.id === two.id).progress.stage).toBe(3)
    expect(users.find((u: { name: string }) => u.name === 'One').progress.stage).toBe(1)
  })

  it('gives the first account the old Stage 1 progress (migration)', async () => {
    localStorage.setItem(LEGACY_PROGRESS_KEY, JSON.stringify({ version: 1, stage1Complete: true, symbols: ['eye'] }))
    const a = await signUp('First', 'password1')
    expect(a.progress).toMatchObject({ level: 1, stage: 2 })
    const b = await signUp('Second', 'password2')
    expect(b.progress).toMatchObject({ level: 1, stage: 1 })
  })

  it('backs up a corrupt store and starts again instead of throwing', async () => {
    localStorage.setItem(USERS_KEY, '{ not json')
    const a = await signUp('Fresh', 'password1')
    expect(a.name).toBe('Fresh')
    const backups = Object.keys(localStorage).filter(k => k.startsWith(`${USERS_KEY}_corrupt_`))
    expect(backups).toHaveLength(1)
    expect(localStorage.getItem(backups[0])).toBe('{ not json')
  })
})

describe('the seed file (public/data/users.json)', () => {
  // Property 6: no secrets in the seed file
  it('reads names and progress only, ignoring hashes, salts and bad rows', () => {
    const rows = parseSeed({
      version: 1,
      players: [
        { name: 'Ghost of Ravi', progress: { ...freshProgress(), stage: 4 }, hash: 'x', salt: 'y' },
        { name: 'x', progress: freshProgress() },                 // bad name
        { name: 'No progress' },
        null,
      ],
    })
    expect(rows).toEqual([{ name: 'Ghost of Ravi', progress: { ...freshProgress(), stage: 4 }, local: false }])
    expect(JSON.stringify(rows)).not.toMatch(/hash|salt/)
    expect(parseSeed(null)).toEqual([])
    expect(parseSeed({ version: 2, players: [] })).toEqual([])
  })

  it('merges local accounts over seed rows of the same name; the export has no secrets', async () => {
    await signUp('Arjun', 'lantern1')
    const merged = mergePlayers([{ name: 'arjun', progress: freshProgress(), local: false }, { name: 'Meera', progress: freshProgress(), local: false }])
    expect(merged.map(r => r.name).sort()).toEqual(['Arjun', 'Meera'])
    const out = exportSeed([{ name: 'Meera', progress: freshProgress(), local: false }])
    expect(out).not.toMatch(/"hash"|"salt"|lantern1/)
    expect(parseSeed(JSON.parse(out)).map(r => r.name).sort()).toEqual(['Arjun', 'Meera'])
  })
})

describe('leaderboard (Property 5: a deterministic total order)', () => {
  const row = (name: string, p: Partial<ProgressV2>) => ({ name, progress: { ...freshProgress(), ...p }, local: false })
  const rows = [
    row('TwoLevels', { level: 3, stage: 1, treasures: ['gold-watch', 'raven-codex'], levelTimes: { L1: 900, L2: 950 }, deaths: 9 }),
    row('Deaths', { level: 2, stage: 1, treasures: ['gold-watch'], levelTimes: { L1: 500 }, deaths: 3 }),
    row('Slow', { level: 2, stage: 4, treasures: ['gold-watch'], levelTimes: { L1: 800 }, deaths: 0 }),
    row('Quick', { level: 2, stage: 1, treasures: ['gold-watch'], levelTimes: { L1: 500 }, deaths: 0 }),
    row('Far', { level: 1, stage: 5, bestTimes: { L1S1: 1 } }),
    row('New', {}),
  ]

  it('ranks levels cleared, then the best level times, then deaths; a stage inside a level does not count', () => {
    expect(rank(rows).map(r => r.name)).toEqual(['TwoLevels', 'Quick', 'Deaths', 'Slow', 'Far', 'New'])
    // Far (Level 1, Stage 5) and New (Level 1, Stage 1) have both cleared nothing, at no time, with no deaths
    expect(rank(rows).slice(-2).map(r => r.rank)).toEqual([5, 5])
  })

  it('gives the same order whatever the input order, and never puts fewer levels above more', () => {
    const expected = rank(rows).map(r => r.name)
    for (let i = 0; i < 30; i++) {
      const shuffled = [...rows].sort(() => Math.random() - 0.5)
      expect(rank(shuffled).map(r => r.name)).toEqual(expected)
    }
    const r = rank(rows)
    for (let i = 1; i < r.length; i++) expect(r[i - 1].levels).toBeGreaterThanOrEqual(r[i].levels)
  })

  it('lets exact ties share a rank, and is antisymmetric', () => {
    const tie = rank([row('A', { stage: 2 }), row('B', { stage: 4 })])
    expect(tie.map(r => r.rank)).toEqual([1, 1])
    for (const a of rows) for (const b of rows) expect(Math.sign(compare(a, b)) + 0).toBe(-Math.sign(compare(b, a)) + 0)
  })

  it('formats times', () => {
    expect(formatTime(65)).toBe('1:05')
    expect(formatTime(0)).toBe('0:00')
  })
})

describe('guest play', () => {
  it('plays without an account, keeps progress in this browser, and stays off the leaderboard', () => {
    const g = startGuest()
    expect(isGuest(g)).toBe(true)
    expect(isGuest()).toBe(true)
    const won = { ...freshProgress(), level: 2 as const, treasures: ['gold-watch' as const], levelTimes: { L1: 400 } }
    saveProgress(won)
    expect(current()?.progress).toMatchObject({ level: 2, treasures: ['gold-watch'] })
    expect(mergePlayers([])).toEqual([])
    expect(localStorage.getItem(USERS_KEY)).toBeNull()
  })

  it('carries what a guest won into the account they create, then forgets the guest save', async () => {
    startGuest()
    saveProgress({ ...freshProgress(), level: 2, treasures: ['gold-watch'], levelTimes: { L1: 400 } })
    const a = await signUp('Meera', 'lantern1')
    expect(a.progress).toMatchObject({ level: 2, treasures: ['gold-watch'], levelTimes: { L1: 400 } })
    expect(isGuest()).toBe(false)
    expect(localStorage.getItem(GUEST_KEY)).toBeNull()
    expect(mergePlayers([]).map(r => r.name)).toEqual(['Meera'])
  })

  it('a later sign-up, not from a guest session, starts fresh', async () => {
    startGuest()
    saveProgress({ ...freshProgress(), level: 3 })
    signOut()
    const a = await signUp('Ravi', 'lantern1')
    expect(a.progress.level).toBe(1)
  })
})
