export type DraftSlot = {
  userId: string
  draftPosition: number
}

export function expectedSnakePick(slots: DraftSlot[], overallPick: number): string {
  if (slots.length !== 5) {
    throw new Error('Snake draft requires exactly 5 managers')
  }

  const round = Math.floor((overallPick - 1) / 5) + 1
  const pickInRound = ((overallPick - 1) % 5) + 1
  const sorted = [...slots].sort((a, b) => a.draftPosition - b.draftPosition)

  const index = round % 2 === 1 ? pickInRound - 1 : 5 - pickInRound
  return sorted[index].userId
}

export function positionLimit(position: string): number {
  if (position === 'GK' || position === 'DEF' || position === 'FWD') return 1
  if (position === 'MID') return 2
  return 0
}
