import { describe, expect, it } from 'vitest'
import { WITCH_SPRITE, witchFlight } from './TitleSky'

// the painting's x at the screen edges: a 16:9 screen (the whole painting) and a narrow one (cropped)
const SCREENS = [{ name: '16:9', left: 0, right: 1672 }, { name: 'narrow', left: 500, right: 1172 }]

describe("the title card witch's flight", () => {
  it('starts exactly where she was painted, flying left', () => {
    const f = witchFlight(0, 0, 1672)!
    expect(f.x).toBeCloseTo(WITCH_SPRITE.x + WITCH_SPRITE.w / 2)
    expect(f.y).toBeCloseTo(WITCH_SPRITE.y + WITCH_SPRITE.h / 2)
    expect(f.vx).toBeLessThan(0)
  })

  for (const S of SCREENS) {
    it(`never turns round in view (${S.name} screen)`, () => {
      const visible = (p: { x: number; near: number }) => p.x + (WITCH_SPRITE.w / 2) * p.near > S.left && p.x - (WITCH_SPRITE.w / 2) * p.near < S.right
      const headings: number[] = []
      let prev = witchFlight(0, S.left, S.right)
      for (let t = 0.01; t < 40; t += 0.01) {
        const p = witchFlight(t, S.left, S.right)
        if (p && prev) expect(Math.sign(p.vx)).toBe(Math.sign(prev.vx))      // no flip between two drawn frames
        if (!p && prev) expect(visible(prev)).toBe(false)                    // she leaves only once out of sight
        if (p && !prev) expect(visible(p)).toBe(false)                       // and comes back from out of sight
        if (p && headings[headings.length - 1] !== Math.sign(p.vx)) headings.push(Math.sign(p.vx))
        prev = p
      }
      // right to left, then left to right, and so on
      expect(headings.slice(0, 4)).toEqual([-1, 1, -1, 1])
    })
  }

  it('the right-to-left pass swoops down to cross the middle of the sky, below the title', () => {
    for (let t = 0; t < 6; t += 0.01) {
      const p = witchFlight(t, 0, 1672)
      if (p && p.vx < 0 && p.x > 500 && p.x < 1000) expect(p.y).toBeGreaterThan(330)
    }
  })

  it('stays inside the screen when a wide window crops the top of the painting', () => {
    for (let t = 0; t < 30; t += 0.01) {
      const p = witchFlight(t, 0, 1672, 120)
      if (p) expect(p.y - (WITCH_SPRITE.h / 2) * p.near).toBeGreaterThan(120)
    }
  })

  it('crosses back while the card is still showing (before its fade at 9.2 s)', () => {
    const p = witchFlight(7, 0, 1672)
    expect(p && p.vx > 0).toBe(true)
  })
})
