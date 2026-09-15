import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { supabase } from './services/supabase'
import {
  AccountSettingsPage,
  ArsenalPlayersPage,
  CommissionerJoinCodePage,
  CommissionerLeagueSettingsPage,
  CommissionerMembersPage,
  CommissionerStartGameweekPage,
  CommissionerSyncPage,
  CreateLeaguePage,
  GameweekStandingsPage,
  JoinLeaguePage,
  LeagueDashboardPage,
  ManagerTeamPage,
  MyLeaguesPage,
  MySquadPage,
  OverallStandingsPage,
  RulesPage,
  TransfersPage,
} from './pages/AppPages'
import { SignInPage, SignUpPage, WelcomePage } from './pages/PublicPages'

function RequireAuth({ children }: { children: ReactElement }) {
  const [loading, setLoading] = useState(true)
  const [isAuthed, setIsAuthed] = useState(false)

  useEffect(() => {
    let mounted = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setIsAuthed(Boolean(data.session))
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(Boolean(session))
      setLoading(false)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  if (loading) return <div className="state-card">Checking session…</div>
  if (!isAuthed) return <Navigate to="/signin" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/signup" element={<SignUpPage />} />

      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="leagues" element={<MyLeaguesPage />} />
        <Route path="leagues/create" element={<CreateLeaguePage />} />
        <Route path="leagues/join" element={<JoinLeaguePage />} />
        <Route path="dashboard" element={<LeagueDashboardPage />} />
        <Route path="standings" element={<OverallStandingsPage />} />
        <Route path="gameweek-standings" element={<GameweekStandingsPage />} />
        <Route path="squad" element={<MySquadPage />} />
        <Route path="transfers" element={<TransfersPage />} />
        <Route path="players" element={<ArsenalPlayersPage />} />
        <Route path="manager" element={<ManagerTeamPage />} />
        <Route path="rules" element={<RulesPage />} />
        <Route path="account" element={<AccountSettingsPage />} />
        <Route path="commissioner/settings" element={<CommissionerLeagueSettingsPage />} />
        <Route path="commissioner/members" element={<CommissionerMembersPage />} />
        <Route path="commissioner/join-code" element={<CommissionerJoinCodePage />} />
        <Route path="commissioner/start-gameweek" element={<CommissionerStartGameweekPage />} />
        <Route path="commissioner/sync" element={<CommissionerSyncPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
