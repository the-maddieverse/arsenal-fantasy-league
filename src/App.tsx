import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { expectedSnakePick } from './lib/league'
import { applyCaptainRules } from './lib/scoring'

type Member = { league_id: string; user_id: string; manager_name: string; draft_position: number }
type Player = { id: number; name: string; position: 'GK' | 'DEF' | 'MID' | 'FWD'; now_cost: number }
type Draft = { league_id: string; status: 'open' | 'closed' | 'complete'; current_pick: number }
type DraftPick = { id: number; overall_pick: number; manager_id: string; player_id: number; player_name?: string }
type Roster = { id: number; league_id: string; user_id: string; player_id: number; dropped_at: string | null }
type Gameweek = { id: number; finished: boolean }
type Stat = { player_id: number; gameweek_id: number; points: number; minutes: number }
type CaptainChoice = { user_id: string; captain_player_id: number; vice_captain_player_id: number }
type WaiverClaim = { id: number; user_id: string; add_player_id: number; drop_player_id: number | null; status: string }
type Txn = { id: number; user_id: string; transaction_type: string; created_at: string; details: Record<string, unknown> }
type League = { id: string; name: string; invite_code: string; commissioner_id: string }

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [inviteCode, setInviteCode] = useState('NORTHBANK')
  const [managerName, setManagerName] = useState('')
  const [league, setLeague] = useState<League | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [picks, setPicks] = useState<DraftPick[]>([])
  const [rosters, setRosters] = useState<Roster[]>([])
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([])
  const [stats, setStats] = useState<Stat[]>([])
  const [captains, setCaptains] = useState<CaptainChoice[]>([])
  const [claims, setClaims] = useState<WaiverClaim[]>([])
  const [transactions, setTransactions] = useState<Txn[]>([])
  const [search, setSearch] = useState('')
  const [positionFilter, setPositionFilter] = useState<'ALL' | 'GK' | 'DEF' | 'MID' | 'FWD'>('ALL')
  const [captain, setCaptain] = useState<number | null>(null)
  const [viceCaptain, setViceCaptain] = useState<number | null>(null)
  const [waiverAddPlayerId, setWaiverAddPlayerId] = useState<number | null>(null)
  const [waiverDropPlayerId, setWaiverDropPlayerId] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const userId = session?.user.id ?? null

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function bootstrapUserData() {
    if (!session) return

    const fallback = session.user.email?.split('@')[0] || 'Manager'
    const name = displayName || (session.user.user_metadata.display_name as string | undefined) || fallback

    await supabase.from('profiles').upsert({ id: session.user.id, display_name: name })

    const { data: myMembership, error: membershipError } = await supabase
      .from('league_members')
      .select('league_id')
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (membershipError) throw membershipError

    if (!myMembership?.league_id) {
      setLeague(null)
      setMembers([])
      return
    }

    await loadLeague(myMembership.league_id)
  }

  useEffect(() => {
    if (!session) return
    bootstrapUserData().catch((err: Error) => setMessage(err.message))
  }, [session, displayName])

  async function loadLeague(leagueId: string) {
    const [leagueRes, membersRes, playersRes, draftRes, picksRes, rostersRes, gwRes, statsRes, claimsRes, txRes] =
      await Promise.all([
        supabase.from('leagues').select('id,name,invite_code,commissioner_id').eq('id', leagueId).single(),
        supabase
          .from('league_members')
          .select('league_id,user_id,manager_name,draft_position')
          .eq('league_id', leagueId)
          .order('draft_position'),
        supabase.from('players').select('id,name,position,now_cost').order('name'),
        supabase.from('drafts').select('league_id,status,current_pick').eq('league_id', leagueId).maybeSingle(),
        supabase
          .from('draft_picks')
          .select('id,overall_pick,manager_id,player_id,players(name)')
          .eq('league_id', leagueId)
          .order('overall_pick'),
        supabase.from('rosters').select('id,league_id,user_id,player_id,dropped_at').eq('league_id', leagueId),
        supabase.from('gameweeks').select('id,finished').order('id', { ascending: false }).limit(10),
        supabase.from('player_gameweek_stats').select('player_id,gameweek_id,points,minutes').order('gameweek_id', { ascending: false }),
        supabase.from('waiver_claims').select('id,user_id,add_player_id,drop_player_id,status').eq('league_id', leagueId).order('id', { ascending: false }),
        supabase.from('transactions').select('id,user_id,transaction_type,created_at,details').eq('league_id', leagueId).order('id', { ascending: false }).limit(30),
      ])

    const firstError =
      leagueRes.error ||
      membersRes.error ||
      playersRes.error ||
      draftRes.error ||
      picksRes.error ||
      rostersRes.error ||
      gwRes.error ||
      statsRes.error ||
      claimsRes.error ||
      txRes.error

    if (firstError) throw firstError

    setLeague(leagueRes.data as League)
    setMembers((membersRes.data ?? []) as Member[])
    setPlayers((playersRes.data ?? []) as Player[])
    setDraft((draftRes.data ?? null) as Draft | null)
    setPicks(
      ((picksRes.data ?? []) as any[]).map((pick) => ({
        id: pick.id,
        overall_pick: pick.overall_pick,
        manager_id: pick.manager_id,
        player_id: pick.player_id,
        player_name: pick.players?.name,
      })),
    )
    setRosters((rostersRes.data ?? []) as Roster[])
    setGameweeks((gwRes.data ?? []) as Gameweek[])
    setStats((statsRes.data ?? []) as Stat[])
    setClaims((claimsRes.data ?? []) as WaiverClaim[])
    setTransactions((txRes.data ?? []) as Txn[])

    const latestGw = (gwRes.data ?? []).find((gw) => gw.finished)
    if (latestGw) {
      const { data: captainRows } = await supabase
        .from('captain_choices')
        .select('user_id,captain_player_id,vice_captain_player_id')
        .eq('league_id', leagueId)
        .eq('gameweek_id', latestGw.id)
      setCaptains((captainRows ?? []) as CaptainChoice[])
    } else {
      setCaptains([])
    }
  }

  const myMembership = useMemo(() => members.find((m) => m.user_id === userId) ?? null, [members, userId])
  const isCommissioner = Boolean(league && userId && league.commissioner_id === userId)
  const activeRosters = useMemo(() => rosters.filter((row) => row.dropped_at === null), [rosters])

  const availablePlayers = useMemo(() => {
    const taken = new Set(activeRosters.map((r) => r.player_id))
    return players
      .filter((p) => !taken.has(p.id))
      .filter((p) => (positionFilter === 'ALL' ? true : p.position === positionFilter))
      .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
  }, [activeRosters, players, positionFilter, search])

  const myRoster = useMemo(() => {
    if (!userId) return []
    return activeRosters.filter((r) => r.user_id === userId)
  }, [activeRosters, userId])

  const latestFinishedGameweek = useMemo(() => gameweeks.find((gw) => gw.finished) ?? null, [gameweeks])

  const leaderboard = useMemo(() => {
    if (!latestFinishedGameweek) return [] as { managerName: string; points: number }[]

    return members
      .map((member) => {
        const managerRoster = activeRosters.filter((r) => r.user_id === member.user_id)
        const managerStats = managerRoster
          .map((r) => {
            const stat = stats.find(
              (s) => s.player_id === r.player_id && s.gameweek_id === latestFinishedGameweek.id,
            )
            return { playerId: r.player_id, points: stat?.points ?? 0, minutes: stat?.minutes ?? 0 }
          })

        const captainChoice = captains.find((c) => c.user_id === member.user_id)
        const total = applyCaptainRules(
          managerStats,
          captainChoice?.captain_player_id ?? null,
          captainChoice?.vice_captain_player_id ?? null,
        )

        return { managerName: member.manager_name, points: total }
      })
      .sort((a, b) => b.points - a.points)
  }, [activeRosters, captains, latestFinishedGameweek, members, stats])

  const myTurn = useMemo(() => {
    if (!draft || !myMembership) return false
    if (members.length !== 5) return false
    return expectedSnakePick(
      members.map((m) => ({ userId: m.user_id, draftPosition: m.draft_position })),
      draft.current_pick,
    ) === myMembership.user_id
  }, [draft, members, myMembership])

  async function handleSignUp(event: FormEvent) {
    event.preventDefault()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    })
    setMessage(error ? error.message : 'Signup successful. Check your email if confirmation is enabled.')
  }

  async function handleSignIn(event: FormEvent) {
    event.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setMessage(error ? error.message : 'Signed in')
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setLeague(null)
    setMembers([])
    setMessage('Signed out')
  }

  async function handleJoinLeague(event: FormEvent) {
    event.preventDefault()
    const { data, error } = await supabase.rpc('join_league_by_code', {
      p_invite_code: inviteCode.trim().toUpperCase(),
      p_manager_name: managerName.trim(),
    })

    if (error) {
      setMessage(error.message)
      return
    }

    await loadLeague(data as string)
    setMessage('Joined North Bank Fantasy')
  }

  async function makeDraftPick(playerId: number) {
    if (!league) return
    const { error } = await supabase.rpc('make_draft_pick', {
      p_league_id: league.id,
      p_player_id: playerId,
    })

    if (error) {
      setMessage(error.message)
      return
    }

    await loadLeague(league.id)
    setMessage('Draft pick submitted')
  }

  async function saveCaptainChoices() {
    if (!league || !userId || !latestFinishedGameweek || !captain || !viceCaptain) return

    const { error } = await supabase.from('captain_choices').upsert({
      league_id: league.id,
      user_id: userId,
      gameweek_id: latestFinishedGameweek.id,
      captain_player_id: captain,
      vice_captain_player_id: viceCaptain,
    })

    if (error) {
      setMessage(error.message)
      return
    }

    await loadLeague(league.id)
    setMessage('Captain selections saved')
  }

  async function submitWaiver() {
    if (!league || !userId || !waiverAddPlayerId || !myMembership) return
    const { error } = await supabase.from('waiver_claims').insert({
      league_id: league.id,
      user_id: userId,
      add_player_id: waiverAddPlayerId,
      drop_player_id: waiverDropPlayerId,
      priority: myMembership.draft_position,
    })

    if (error) {
      setMessage(error.message)
      return
    }

    await loadLeague(league.id)
    setMessage('Waiver claim submitted')
  }

  async function processClaim(claimId: number, approve: boolean) {
    if (!league) return
    const { error } = await supabase.rpc('process_waiver_claim', {
      p_claim_id: claimId,
      p_approve: approve,
    })

    if (error) {
      setMessage(error.message)
      return
    }

    await loadLeague(league.id)
    setMessage(approve ? 'Waiver approved' : 'Waiver rejected')
  }

  async function updateDraftStatus(nextStatus: Draft['status']) {
    if (!league || !draft) return
    const { error } = await supabase.from('drafts').update({ status: nextStatus }).eq('league_id', league.id)
    if (error) {
      setMessage(error.message)
      return
    }
    await loadLeague(league.id)
  }

  async function syncArsenalData() {
    const token = (await supabase.auth.getSession()).data.session?.access_token
    if (!token) return

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-arsenal-data`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
    })

    const payload = await res.json()
    setMessage(payload.ok ? `Synced ${payload.playerCount} Arsenal players` : payload.error)

    if (league) {
      await loadLeague(league.id)
    }
  }

  if (loading) {
    return <main className="container">Loading North Bank Fantasy…</main>
  }

  if (!session) {
    return (
      <main className="container">
        <h1>North Bank Fantasy</h1>
        <p className="tagline">An unofficial Arsenal supporter fantasy league.</p>
        <div className="grid auth-grid">
          <form className="card" onSubmit={handleSignUp}>
            <h2>Create account</h2>
            <input placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="submit">Sign up</button>
          </form>
          <form className="card" onSubmit={handleSignIn}>
            <h2>Sign in</h2>
            <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="submit">Sign in</button>
          </form>
        </div>
        {message && <p className="message">{message}</p>}
      </main>
    )
  }

  if (!league) {
    return (
      <main className="container">
        <header className="topbar">
          <h1>North Bank Fantasy</h1>
          <button onClick={handleSignOut}>Sign out</button>
        </header>
        <p className="tagline">Enter your private invite code to join the league.</p>
        <form className="card" onSubmit={handleJoinLeague}>
          <h2>Join private league</h2>
          <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="Invite code" required />
          <input value={managerName} onChange={(e) => setManagerName(e.target.value)} placeholder="Manager name" required />
          <button type="submit">Join league</button>
        </form>
        {message && <p className="message">{message}</p>}
      </main>
    )
  }

  return (
    <main className="container">
      <header className="topbar">
        <div>
          <h1>{league.name}</h1>
          <p className="tagline">An unofficial Arsenal supporter fantasy league.</p>
          <p className="meta">Invite code: {league.invite_code}</p>
        </div>
        <div className="toolbar">
          <button onClick={syncArsenalData}>Sync Arsenal data</button>
          <button onClick={handleSignOut}>Sign out</button>
        </div>
      </header>

      <section className="grid league-overview">
        <article className="card">
          <h2>Draft room</h2>
          <p>Status: <strong>{draft?.status ?? 'open'}</strong></p>
          <p>Current pick: <strong>{draft?.current_pick ?? 1}</strong></p>
          <p>{myTurn ? 'It is your turn to draft.' : 'Waiting for another manager.'}</p>
        </article>

        <article className="card">
          <h2>Managers</h2>
          <ul>
            {members.map((member) => (
              <li key={member.user_id}>
                #{member.draft_position} {member.manager_name}
              </li>
            ))}
          </ul>
        </article>

        <article className="card">
          <h2>Weekly standings</h2>
          <ol className="leaderboard">
            {leaderboard.map((row, idx) => (
              <li key={row.managerName}>
                <span className={`rank rank-${idx + 1}`}>{idx + 1}</span>
                <span>{row.managerName}</span>
                <strong>{row.points} pts</strong>
              </li>
            ))}
          </ol>
        </article>
      </section>

      <section className="card">
        <h2>Arsenal player pool</h2>
        <div className="filters">
          <input placeholder="Search players" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value as any)}>
            <option value="ALL">All</option>
            <option value="GK">GK</option>
            <option value="DEF">DEF</option>
            <option value="MID">MID</option>
            <option value="FWD">FWD</option>
          </select>
        </div>
        <ul className="players">
          {availablePlayers.map((player) => (
            <li key={player.id}>
              <div>
                <strong>{player.name}</strong>
                <span>{player.position} · £{(player.now_cost / 10).toFixed(1)}m</span>
              </div>
              <button disabled={!myTurn || draft?.status !== 'open'} onClick={() => makeDraftPick(player.id)}>
                Draft
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid two-up">
        <article className="card">
          <h2>Your roster</h2>
          <ul>
            {myRoster.map((slot) => {
              const player = players.find((p) => p.id === slot.player_id)
              if (!player) return null
              return (
                <li key={slot.id}>{player.name} ({player.position})</li>
              )
            })}
          </ul>
          <div className="filters">
            <select value={captain ?? ''} onChange={(e) => setCaptain(Number(e.target.value) || null)}>
              <option value="">Captain</option>
              {myRoster.map((slot) => {
                const player = players.find((p) => p.id === slot.player_id)
                if (!player) return null
                return (
                  <option key={`c-${player.id}`} value={player.id}>
                    {player.name}
                  </option>
                )
              })}
            </select>
            <select value={viceCaptain ?? ''} onChange={(e) => setViceCaptain(Number(e.target.value) || null)}>
              <option value="">Vice captain</option>
              {myRoster.map((slot) => {
                const player = players.find((p) => p.id === slot.player_id)
                if (!player) return null
                return (
                  <option key={`v-${player.id}`} value={player.id}>
                    {player.name}
                  </option>
                )
              })}
            </select>
            <button onClick={saveCaptainChoices} disabled={!captain || !viceCaptain || captain === viceCaptain}>
              Save captain picks
            </button>
          </div>
        </article>

        <article className="card">
          <h2>Transfers & waiver wire</h2>
          <div className="filters">
            <select value={waiverAddPlayerId ?? ''} onChange={(e) => setWaiverAddPlayerId(Number(e.target.value) || null)}>
              <option value="">Add player</option>
              {availablePlayers.map((player) => (
                <option key={`a-${player.id}`} value={player.id}>{player.name}</option>
              ))}
            </select>
            <select value={waiverDropPlayerId ?? ''} onChange={(e) => setWaiverDropPlayerId(Number(e.target.value) || null)}>
              <option value="">Drop player (optional)</option>
              {myRoster.map((slot) => {
                const player = players.find((p) => p.id === slot.player_id)
                if (!player) return null
                return <option key={`d-${player.id}`} value={player.id}>{player.name}</option>
              })}
            </select>
            <button onClick={submitWaiver} disabled={!waiverAddPlayerId}>Submit waiver claim</button>
          </div>
          <ul>
            {claims.map((claim) => (
              <li key={claim.id}>
                Claim #{claim.id} · {claim.status}
                {isCommissioner && claim.status === 'pending' && (
                  <span className="actions">
                    <button onClick={() => processClaim(claim.id, true)}>Approve</button>
                    <button onClick={() => processClaim(claim.id, false)}>Reject</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="grid two-up">
        <article className="card">
          <h2>Draft board</h2>
          <ol>
            {picks.map((pick) => {
              const manager = members.find((m) => m.user_id === pick.manager_id)
              return (
                <li key={pick.id}>
                  #{pick.overall_pick} {manager?.manager_name}: {pick.player_name ?? pick.player_id}
                </li>
              )
            })}
          </ol>
        </article>

        <article className="card">
          <h2>Transaction history</h2>
          <ul>
            {transactions.map((txn) => {
              const manager = members.find((m) => m.user_id === txn.user_id)
              return (
                <li key={txn.id}>
                  <strong>{txn.transaction_type}</strong> · {manager?.manager_name ?? 'Manager'} ·{' '}
                  {new Date(txn.created_at).toLocaleString()}
                </li>
              )
            })}
          </ul>
        </article>
      </section>

      {isCommissioner && (
        <section className="card">
          <h2>Commissioner controls</h2>
          <div className="actions">
            <button onClick={() => updateDraftStatus('open')}>Open draft</button>
            <button onClick={() => updateDraftStatus('closed')}>Close draft</button>
            <button onClick={() => updateDraftStatus('complete')}>Mark complete</button>
          </div>
        </section>
      )}

      {message && <p className="message">{message}</p>}
    </main>
  )
}

export default App
