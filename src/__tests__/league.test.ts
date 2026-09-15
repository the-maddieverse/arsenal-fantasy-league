import { describe, expect, it } from 'vitest'
import { expectedSnakePick, positionLimit } from '../lib/league'

const slots = [
  { userId: 'u1', draftPosition: 1 },
  { userId: 'u2', draftPosition: 2 },
  { userId: 'u3', draftPosition: 3 },
  { userId: 'u4', draftPosition: 4 },
  { userId: 'u5', draftPosition: 5 },
]

describe('expectedSnakePick', () => {
  it('uses forward order on odd rounds', () => {
    expect(expectedSnakePick(slots, 1)).toBe('u1')
    expect(expectedSnakePick(slots, 5)).toBe('u5')
  })

  it('uses reverse order on even rounds', () => {
    expect(expectedSnakePick(slots, 6)).toBe('u5')
    expect(expectedSnakePick(slots, 10)).toBe('u1')
  })
})

describe('positionLimit', () => {
  it('enforces roster shape', () => {
    expect(positionLimit('GK')).toBe(1)
    expect(positionLimit('DEF')).toBe(1)
    expect(positionLimit('MID')).toBe(2)
    expect(positionLimit('FWD')).toBe(1)
  })
})
