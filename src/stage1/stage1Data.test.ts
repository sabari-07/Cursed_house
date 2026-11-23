import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  JOURNAL,
  loadProgress,
  saveProgress,
  STAGE1_RULES,
  type Progress,
} from './stage1Data'

const PROGRESS_KEY = 'ghostwriter_progress_v1'

describe('Stage 1 rules (riddle spec, Requirements 4–5)', () => {
  it('gives one chance, 180 seconds (warning at 30), and 15 seconds to answer once ANSWER is pressed', () => {
    expect(STAGE1_RULES).toEqual({ chances: 1, timeLimit: 180, warnAt: 30, answerWindow: 15 })
  })

  // The journal is story only now: it must not carry the old ordering clues,
  // which would send players after an answer that no longer exists.
  it('keeps the old ordering clues out of the journal', () => {
    const text = JOURNAL.lines.join(' ').toLowerCase()
    for (const w of ['came in', 'entered', 'came first', 'last of all', 'before any']) expect(text).not.toContain(w)
  })
})

describe('progress saves — versioned local storage (Requirement 6.2)', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    localStorage.clear()
  })

  // Property: saves round-trip — saving then loading returns the same data.
  it('round-trips every save through load', () => {
    const samples: Progress[] = [
      { version: 1, stage1Complete: false, symbols: [] },
      { version: 1, stage1Complete: true, symbols: ['eye'] },
      { version: 1, stage1Complete: true, symbols: ['eye', 'key', 'flame'] },
    ]
    for (const p of samples) {
      saveProgress(p)
      expect(loadProgress()).toEqual(p)
    }
  })

  it('persists the solve save ({ stage1Complete: true, symbols: ["eye"] })', () => {
    saveProgress({ version: 1, stage1Complete: true, symbols: ['eye'] })
    const loaded = loadProgress()
    expect(loaded.stage1Complete).toBe(true)
    expect(loaded.symbols).toContain('eye')
    expect(loaded.version).toBe(1)
  })

  // Property: a fresh board (nothing saved) loads a fresh state, not an error.
  it('returns a fresh state when nothing has been saved', () => {
    expect(loadProgress()).toEqual({
      version: 1,
      stage1Complete: false,
      symbols: [],
    })
  })

  // Property: corrupt or invalid saves fall back to a fresh state rather than throwing.
  it('falls back to a fresh state for corrupt or invalid saves', () => {
    const fresh: Progress = { version: 1, stage1Complete: false, symbols: [] }
    const corruptValues = [
      'not json at all',
      '{ "half": ',          // truncated JSON
      'null',                // valid JSON, but null
      '42',                  // a bare number
      '"a string"',          // a bare string
      '[]',                  // an array, not a Progress object
      '{}',                  // object with no version
      '{"version":0,"stage1Complete":true,"symbols":["eye"]}',  // wrong version
      '{"version":2,"stage1Complete":true,"symbols":["eye"]}',  // future version
      '{"stage1Complete":true,"symbols":["eye"]}',              // missing version
    ]
    for (const raw of corruptValues) {
      localStorage.setItem(PROGRESS_KEY, raw)
      expect(() => loadProgress()).not.toThrow()
      expect(loadProgress()).toEqual(fresh)
    }
  })
})
