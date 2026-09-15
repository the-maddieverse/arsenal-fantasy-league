import type { Position } from '../types/domain'

export const DEFAULT_BUDGET_MILLION = 45

export interface SquadPick {
  playerId: string
  position: Position
  price: number
}

const REQUIRED: Record<Position, number> = {
  GKP: 1,
  DEF: 2,
  MID: 2,
  FWD: 1,
}

export function validateSquad(picks: SquadPick[], budgetMillion = DEFAULT_BUDGET_MILLION): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  if (picks.length !== 6) errors.push('Squad must contain exactly 6 players.')

  for (const [position, count] of Object.entries(REQUIRED) as Array<[Position, number]>) {
    const actual = picks.filter((pick) => pick.position === position).length
    if (actual !== count) errors.push(`Squad must have ${count} ${position}.`)
  }

  const total = picks.reduce((sum, pick) => sum + pick.price, 0)
  if (total > budgetMillion) {
    errors.push(`Squad exceeds budget of £${budgetMillion.toFixed(1)}m.`)
  }

  return { valid: errors.length === 0, errors }
}

export function captainBonus(options: {
  captainPoints: number
  viceCaptainPoints: number
  captainMinutes: number
  viceCaptainMinutes: number
}): { bonusPoints: number; appliedTo: 'captain' | 'vice_captain' | 'none' } {
  const { captainPoints, viceCaptainPoints, captainMinutes, viceCaptainMinutes } = options

  if (captainMinutes > 0) return { bonusPoints: captainPoints, appliedTo: 'captain' }
  if (viceCaptainMinutes > 0) return { bonusPoints: viceCaptainPoints, appliedTo: 'vice_captain' }
  return { bonusPoints: 0, appliedTo: 'none' }
}

export function transferPenalty(transfersMade: number, freeTransfers: number): number {
  return Math.max(0, transfersMade - freeTransfers) * 4
}

export function rolloverFreeTransfers(previous: number, used: number): number {
  const next = Math.max(0, previous - used) + 1
  return Math.min(2, next)
}
