import { supabase } from './supabase'
import type { FootballPlayer, Gameweek, LeagueSummary, SyncRun } from '../types/domain'

export async function listMyLeagues(userId: string): Promise<LeagueSummary[]> {
  const { data, error } = await supabase
    .from('league_members')
    .select('leagues(id, name, join_code, registration_open, starting_gameweek_id, budget_million, commissioner_id)')
    .eq('profile_id', userId)

  if (error) throw error

  return (data ?? [])
    .map((row) => (Array.isArray(row.leagues) ? row.leagues[0] : row.leagues))
    .filter(Boolean) as LeagueSummary[]
}

export async function listArsenalPlayers(): Promise<FootballPlayer[]> {
  const { data, error } = await supabase
    .from('football_players')
    .select('id, external_id, team_id, name, position, price, status, total_points')
    .order('position')
    .order('name')

  if (error) throw error
  return (data ?? []) as FootballPlayer[]
}

export async function listGameweeks(): Promise<Gameweek[]> {
  const { data, error } = await supabase
    .from('gameweeks')
    .select('id, external_id, name, deadline_at, is_current, is_finished')
    .order('external_id')

  if (error) throw error
  return (data ?? []) as Gameweek[]
}

export async function latestSyncRun(leagueId: string): Promise<SyncRun | null> {
  const { data, error } = await supabase
    .from('sync_runs')
    .select('id, status, source, message, completed_at')
    .eq('league_id', leagueId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data as SyncRun | null) ?? null
}

export async function triggerSync(leagueId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('sync-football-data', {
    body: { leagueId, source: 'manual' },
  })
  if (error) throw error
}
