import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const FPL_BASE = 'https://fantasy.premierleague.com/api'

type FplBootstrap = {
  teams: Array<{ id: number; name: string; short_name: string }>
  elements: Array<{
    id: number
    team: number
    web_name: string
    element_type: 1 | 2 | 3 | 4
    now_cost: number
    status: string
    total_points: number
  }>
  events: Array<{
    id: number
    name: string
    deadline_time: string
    is_current: boolean
    finished: boolean
  }>
}

function positionFromType(type: number) {
  switch (type) {
    case 1:
      return 'GKP'
    case 2:
      return 'DEF'
    case 3:
      return 'MID'
    case 4:
      return 'FWD'
    default:
      return 'MID'
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed fetch: ${url}`)
  return response.json()
}

Deno.serve(async (request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Missing server credentials' }), { status: 500 })
  }

  const body = await request.json().catch(() => ({}))
  const leagueId = body.leagueId ?? null
  const source = body.source ?? 'scheduled'

  const admin = createClient(supabaseUrl, serviceRoleKey)

  const { data: run } = await admin
    .from('sync_runs')
    .insert({ league_id: leagueId, source, status: 'running' })
    .select('id')
    .single()

  try {
    const bootstrap = await fetchJson<FplBootstrap>(`${FPL_BASE}/bootstrap-static/`)
    const arsenalTeam = bootstrap.teams.find((team) => team.name.toLowerCase() === 'arsenal')

    if (!arsenalTeam) throw new Error('Arsenal team not found from source')

    const upsertTeam = await admin.from('football_teams').upsert(
      {
        external_id: arsenalTeam.id,
        name: arsenalTeam.name,
        short_name: arsenalTeam.short_name,
      },
      { onConflict: 'external_id' },
    ).select('id').single()

    if (upsertTeam.error || !upsertTeam.data) throw upsertTeam.error ?? new Error('Team upsert failed')

    await admin.from('gameweeks').upsert(
      bootstrap.events.map((event) => ({
        external_id: event.id,
        name: event.name,
        deadline_at: event.deadline_time,
        is_current: event.is_current,
        is_finished: event.finished,
      })),
      { onConflict: 'external_id' },
    )

    const arsenalPlayers = bootstrap.elements.filter((player) => player.team === arsenalTeam.id)
    await admin.from('football_players').upsert(
      arsenalPlayers.map((player) => ({
        external_id: player.id,
        team_id: upsertTeam.data.id,
        name: player.web_name,
        position: positionFromType(player.element_type),
        price: player.now_cost / 10,
        status: player.status,
        total_points: player.total_points,
      })),
      { onConflict: 'external_id' },
    )

    const { data: mappedPlayers, error: mappedPlayersError } = await admin
      .from('football_players')
      .select('id, external_id')
      .eq('team_id', upsertTeam.data.id)

    if (mappedPlayersError) throw mappedPlayersError

    const { data: gameweeks, error: gameweeksError } = await admin
      .from('gameweeks')
      .select('id, external_id')

    if (gameweeksError) throw gameweeksError

    const pointsRows: Array<{ player_id: string; gameweek_id: string; points: number; minutes: number; status: string }> = []

    for (const event of bootstrap.events) {
      const live = await fetchJson<{ elements: Array<{ id: number; stats: { total_points: number; minutes: number } }> }>(
        `${FPL_BASE}/event/${event.id}/live/`,
      )

      const gameweekId = gameweeks?.find((row) => row.external_id === event.id)?.id
      if (!gameweekId) continue

      for (const player of arsenalPlayers) {
        const eventStats = live.elements.find((element) => element.id === player.id)?.stats
        const playerId = mappedPlayers?.find((row) => row.external_id === player.id)?.id
        if (!eventStats || !playerId) continue

        pointsRows.push({
          player_id: playerId,
          gameweek_id: gameweekId,
          points: eventStats.total_points,
          minutes: eventStats.minutes,
          status: player.status,
        })
      }
    }

    if (pointsRows.length) {
      await admin.from('player_gameweek_points').upsert(pointsRows, { onConflict: 'player_id,gameweek_id' })
    }

    await admin.from('sync_runs').update({ status: 'success', completed_at: new Date().toISOString() }).eq('id', run?.id)

    return new Response(
      JSON.stringify({ ok: true, syncedPlayers: arsenalPlayers.length, syncedPointRows: pointsRows.length }),
      { headers: { 'content-type': 'application/json' } },
    )
  } catch (error) {
    await admin
      .from('sync_runs')
      .update({ status: 'failed', completed_at: new Date().toISOString(), message: error instanceof Error ? error.message : 'Unknown error' })
      .eq('id', run?.id)

    return new Response(
      JSON.stringify({
        ok: false,
        message: error instanceof Error ? error.message : 'External data source unavailable',
      }),
      { status: 502, headers: { 'content-type': 'application/json' } },
    )
  }
})
