import { describe, expect, it } from 'vitest'
import { captainBonus, rolloverFreeTransfers, transferPenalty, validateSquad } from '../src/utils/fantasyRules'

describe('fantasy rules', () => {
  it('validates required six-player composition and budget', () => {
    const valid = validateSquad([
      { playerId: '1', position: 'GKP', price: 5.0 },
      { playerId: '2', position: 'DEF', price: 5.5 },
      { playerId: '3', position: 'DEF', price: 5.0 },
      { playerId: '4', position: 'MID', price: 8.0 },
      { playerId: '5', position: 'MID', price: 7.5 },
      { playerId: '6', position: 'FWD', price: 9.0 },
    ])

    expect(valid.valid).toBe(true)
  })

  it('awards vice-captain bonus when captain plays zero minutes', () => {
    expect(captainBonus({ captainPoints: 8, viceCaptainPoints: 6, captainMinutes: 0, viceCaptainMinutes: 90 })).toEqual({
      bonusPoints: 6,
      appliedTo: 'vice_captain',
    })
  })

  it('caps rollover free transfers at two and applies penalties after free allowance', () => {
    expect(rolloverFreeTransfers(2, 0)).toBe(2)
    expect(transferPenalty(3, 1)).toBe(8)
  })
})
