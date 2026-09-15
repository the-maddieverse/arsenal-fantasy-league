import { describe, expect, it } from 'vitest'
import { applyCaptainRules } from '../lib/scoring'

describe('applyCaptainRules', () => {
  const stats = [
    { playerId: 1, points: 10, minutes: 90 },
    { playerId: 2, points: 5, minutes: 90 },
    { playerId: 3, points: 1, minutes: 0 },
  ]

  it('doubles captain when captain played', () => {
    expect(applyCaptainRules(stats, 1, 2)).toBe(26)
  })

  it('uses vice captain when captain played zero minutes', () => {
    expect(applyCaptainRules(stats, 3, 2)).toBe(21)
  })
})
