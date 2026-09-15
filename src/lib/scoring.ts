export type RosterStat = {
  playerId: number
  points: number
  minutes: number
}

export function applyCaptainRules(
  stats: RosterStat[],
  captainPlayerId: number | null,
  viceCaptainPlayerId: number | null,
): number {
  const byId = new Map(stats.map((row) => [row.playerId, row]))
  const base = stats.reduce((sum, row) => sum + row.points, 0)

  if (!captainPlayerId || !viceCaptainPlayerId) {
    return base
  }

  const captain = byId.get(captainPlayerId)
  const vice = byId.get(viceCaptainPlayerId)

  if (!captain || !vice) {
    return base
  }

  if (captain.minutes > 0) {
    return base + captain.points
  }

  if (vice.minutes > 0) {
    return base + vice.points
  }

  return base
}
