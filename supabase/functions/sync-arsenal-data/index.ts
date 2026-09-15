import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !serviceRole) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
}

const supabase = createClient(supabaseUrl, serviceRole)

const positionMap: Record<number, 'GK' | 'DEF' | 'MID' | 'FWD'> = {
  1: 'GK',
  2: 'DEF',
  3: 'MID',
  4: 'FWD',
}

Deno.serve(async () => {
  try {
    const bootstrap = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/')
    if (!bootstrap.ok) {
      throw new Error(`bootstrap-static failed: ${bootstrap.status}`)
    }

    const data = await bootstrap.json()
    const arsenalTeam = data.teams.find((team: { short_name: string }) => team.short_name === 'ARS')

    if (!arsenalTeam) {
      throw new Error('Could not locate Arsenal in FPL team list')
    }

    const arsenalPlayers = data.elements.filter((element: { team: number }) => element.team === arsenalTeam.id)

    await supabase.from('players').upsert(
      arsenalPlayers.map((player: any) => ({
        id: player.id,
        name: `${player.first_name} ${player.second_name}`,
        position: positionMap[player.element_type],
        team_short_name: 'ARS',
        now_cost: player.now_cost,
        selected_by_percent: Number(player.selected_by_percent || 0),
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'id' },
    )

    await supabase.from('gameweeks').upsert(
      data.events.map((event: any) => ({
        id: event.id,
        deadline_time: event.deadline_time,
        finished: event.finished,
        data_checked_at: new Date().toISOString(),
      })),
      { onConflict: 'id' },
    )

    for (const event of data.events as any[]) {
      const liveRes = await fetch(`https://fantasy.premierleague.com/api/event/${event.id}/live/`)
      if (!liveRes.ok) {
        continue
      }

      const liveData = await liveRes.json()
      const statRows = (liveData.elements as any[])
        .filter((element) => arsenalPlayers.some((p: any) => p.id === element.id))
        .map((element) => ({
          player_id: element.id,
          gameweek_id: event.id,
          minutes: element.stats.minutes,
          points: element.stats.total_points,
          goals: element.stats.goals_scored,
          assists: element.stats.assists,
          clean_sheets: element.stats.clean_sheets,
          updated_at: new Date().toISOString(),
        }))

      if (statRows.length > 0) {
        await supabase.from('player_gameweek_stats').upsert(statRows, {
          onConflict: 'player_id,gameweek_id',
        })
      }
    }

    return new Response(JSON.stringify({ ok: true, playerCount: arsenalPlayers.length }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
