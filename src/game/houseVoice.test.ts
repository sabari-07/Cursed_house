import { beforeEach, describe, expect, it } from 'vitest'
import { plainEnglish } from '../riddles'
import {
  allHouseLines, deathCount, deathLine, deathTip, guideDue, guideLines, houseSays, markGuideSeen, GUIDE_KEY,
  ONE_MORE_TRY, SHUT_OUT,
} from './houseVoice'

const CODES = ['BadName', 'BadPassword', 'NameTaken', 'BadCredentials', 'NoAccount', 'NoCrypto', 'NoStorage', 'BadRecovery', 'Locked', 'Offline', 'Server'] as const

describe('the house voice', () => {
  it('says every line in plain English', () => {
    for (const line of allHouseLines()) expect(plainEnglish(line), line).toBe(true)
  })

  it('has its own line for every account error, and a fallback for unknown codes', () => {
    const lines = CODES.map(houseSays)
    expect(new Set(lines).size).toBe(CODES.length)
    expect(houseSays('NotACode')).toBe(houseSays('Server'))
    expect(houseSays(undefined)).toBe(houseSays('Server'))
  })

  it('still tells the player what to do next on a wrong password', () => {
    expect(houseSays('BadCredentials')).toMatch(/try again/i)
    expect(ONE_MORE_TRY).toMatch(/one more/i)
    expect(SHUT_OUT).toMatch(/try again/i)
  })

  it('names the cause of death and gives a tip that matches it', () => {
    for (let n = 0; n < 12; n++) {
      expect(deathLine('time', n)).toMatch(/time|slow|candle/i)
      expect(deathLine('wrong', n)).toMatch(/wrong|not quite/i)
    }
    expect(deathTip('time')).toMatch(/ANSWER/)
    expect(deathTip('wrong')).toMatch(/room/)
  })

  it('only remarks on the death count from the second death', () => {
    expect(deathCount(0)).toBeNull()
    expect(deathCount(1)).toBeNull()
    expect(deathCount(Number.NaN)).toBeNull()
    for (const n of [2, 3, 7, 12]) expect(deathCount(n)).toMatch(/\w/)
  })

  it('points the guide at the candle and the ANSWER button, on mouse and touch', () => {
    for (const touch of [false, true]) {
      const g = guideLines(touch)
      expect(g.candle).toMatch(/candle/i)
      expect(g.answer).toMatch(/ANSWER/)
    }
    expect(guideLines(true).candle).toMatch(/tap/i)
  })
})

describe('the first-visit guide', () => {
  beforeEach(() => localStorage.clear())

  it('greets a new browser once, then never again', () => {
    expect(guideDue()).toBe(true)
    markGuideSeen()
    expect(guideDue()).toBe(false)
    expect(JSON.parse(localStorage.getItem(GUIDE_KEY) as string)).toEqual({ version: 1, seen: true })
  })
})
