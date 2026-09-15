import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlocks'
import { useAsyncState } from '../hooks/useAsyncState'
import { listArsenalPlayers, listGameweeks, latestSyncRun, listMyLeagues, triggerSync } from '../services/api'
import { supabase } from '../services/supabase'
import type { LeagueSummary } from '../types/domain'

function StubPage({ title, message }: { title: string; message: string }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      <p>{message}</p>
    </section>
  )
}

export function MyLeaguesPage() {
  const leaguesState = useAsyncState<LeagueSummary[]>([])
  const { run } = leaguesState

  useEffect(() => {
    void run(async () => {
      const user = (await supabase.auth.getUser()).data.user
      if (!user) return []
      return listMyLeagues(user.id)
    })
  }, [run])

  if (leaguesState.loading) return <LoadingState label="Loading your leagues…" />
  if (leaguesState.error) return <ErrorState message={leaguesState.error} />
  if (!leaguesState.data.length) {
    return <EmptyState title="You have not joined any leagues yet." action={<Link className="button" to="/app/leagues/create">Create your first league</Link>} />
  }

  return (
    <section className="card">
      <h2>My leagues</h2>
      <ul>
        {leaguesState.data.map((league) => (
          <li key={league.id}>{league.name} • Join code: {league.join_code}</li>
        ))}
      </ul>
    </section>
  )
}

export function CreateLeaguePage() {
  return <StubPage title="Create league" message="Create a private league and set a configurable starting budget (default £45.0m)." />
}

export function JoinLeaguePage() {
  return <StubPage title="Join league" message="Enter a private join code to join your Arsenal supporters league." />
}

export function LeagueDashboardPage() {
  const state = useAsyncState<{ syncStatus: string; gameweekLabel: string }>({ syncStatus: 'Unknown', gameweekLabel: 'Unknown' })
  const { run } = state

  useEffect(() => {
    void run(async () => {
      const gameweeks = await listGameweeks()
      const current = gameweeks.find((gw) => gw.is_current)
      const gameweekLabel = current ? `${current.name} (${current.is_finished ? 'complete' : 'live/upcoming'})` : 'Upcoming'

      const user = (await supabase.auth.getUser()).data.user
      let syncStatus = 'No sync record yet'
      if (user) {
        const leagues = await listMyLeagues(user.id)
        if (leagues[0]) {
          const latest = await latestSyncRun(leagues[0].id)
          syncStatus = latest?.completed_at ? `Last success: ${new Date(latest.completed_at).toLocaleString()}` : 'Sync pending'
        }
      }

      return { syncStatus, gameweekLabel }
    })
  }, [run])

  if (state.loading) return <LoadingState label="Loading league dashboard…" />
  if (state.error) return <ErrorState message={`External data temporarily unavailable: ${state.error}`} />

  return (
    <section className="card">
      <h2>League dashboard</h2>
      <p>{state.data.syncStatus}</p>
      <p>Current gameweek: {state.data.gameweekLabel}</p>
    </section>
  )
}

export function OverallStandingsPage() {
  return <StubPage title="Overall standings" message="Ranks include total points, gameweek wins, captain points, and transfer deductions tie-breakers." />
}

export function GameweekStandingsPage() {
  return <StubPage title="Gameweek standings" message="Shows current and past gameweek rankings based on immutable squad snapshots." />
}

export function MySquadPage() {
  return <StubPage title="My squad" message="Pick exactly 6 Arsenal players: 1 GKP, 2 DEF, 2 MID, 1 FWD, within budget." />
}

export function TransfersPage() {
  return <StubPage title="Transfers" message="One free transfer per gameweek, rollover up to 2, -4 points for extras, immutable transfer history." />
}

export function ArsenalPlayersPage() {
  const playersState = useAsyncState<{ count: number; names: string[] }>({ count: 0, names: [] })
  const { run } = playersState

  useEffect(() => {
    void run(async () => {
      const players = await listArsenalPlayers()
      return { count: players.length, names: players.slice(0, 12).map((player) => player.name) }
    })
  }, [run])

  if (playersState.loading) return <LoadingState label="Loading Arsenal players…" />
  if (playersState.error) return <ErrorState message={playersState.error} />
  if (!playersState.data.count) return <EmptyState title="No Arsenal players imported yet. Run data sync." />

  return (
    <section className="card">
      <h2>Arsenal players ({playersState.data.count})</h2>
      <p>{playersState.data.names.join(', ')}{playersState.data.count > playersState.data.names.length ? '…' : ''}</p>
    </section>
  )
}

export function ManagerTeamPage() {
  return <StubPage title="Manager team view" message="View selected captain/vice-captain, transfer history, and gameweek squad snapshots." />
}

export function RulesPage() {
  return <StubPage title="Rules" message="Starting gameweek excludes previous gameweeks. Captain doubles unless zero minutes, then vice-captain." />
}

export function AccountSettingsPage() {
  return <StubPage title="Account settings" message="Manage display name and sign-out." />
}

export function CommissionerLeagueSettingsPage() {
  return <StubPage title="League settings" message="Commissioner can rename league and set starting budget before league scoring begins." />
}

export function CommissionerMembersPage() {
  return <StubPage title="Members" message="Commissioner can remove league members and manage registration state." />
}

export function CommissionerJoinCodePage() {
  return <StubPage title="Join-code controls" message="Commissioner can regenerate join code and open/close registration." />
}

export function CommissionerStartGameweekPage() {
  return (
    <StubPage
      title="Starting-gameweek controls"
      message="Commissioner chooses current/future starting gameweek. Once first counted gameweek starts, changing this is blocked."
    />
  )
}

export function CommissionerSyncPage() {
  return (
    <section className="card">
      <h2>Data synchronization status</h2>
      <p>Run secure imports from server-side function. Client never holds service-role keys.</p>
      <button
        className="button"
        type="button"
        onClick={async () => {
          const user = (await supabase.auth.getUser()).data.user
          if (!user) return
          const leagues = await listMyLeagues(user.id)
          if (leagues[0]) await triggerSync(leagues[0].id)
        }}
      >
        Trigger sync
      </button>
    </section>
  )
}
