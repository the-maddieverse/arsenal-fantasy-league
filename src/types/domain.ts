export type Position = 'GKP' | 'DEF' | 'MID' | 'FWD'

export interface FootballPlayer {
  id: string
  external_id: number
  team_id: string
  name: string
  position: Position
  price: number
  status: string | null
  total_points: number
}

export interface Gameweek {
  id: string
  external_id: number
  name: string
  deadline_at: string
  is_current: boolean
  is_finished: boolean
}

export interface SyncRun {
  id: string
  status: 'success' | 'failed' | 'running'
  source: string
  message: string | null
  completed_at: string | null
}

export interface LeagueSummary {
  id: string
  name: string
  join_code: string
  registration_open: boolean
  starting_gameweek_id: string | null
  budget_million: number
  commissioner_id: string
}
