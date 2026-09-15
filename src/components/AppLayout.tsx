import { Link, NavLink, Outlet } from 'react-router-dom'

const links = [
  ['My leagues', '/app/leagues'],
  ['Create league', '/app/leagues/create'],
  ['Join league', '/app/leagues/join'],
  ['League dashboard', '/app/dashboard'],
  ['Overall standings', '/app/standings'],
  ['Gameweek standings', '/app/gameweek-standings'],
  ['My squad', '/app/squad'],
  ['Transfers', '/app/transfers'],
  ['Arsenal players', '/app/players'],
  ['Manager team view', '/app/manager'],
  ['Rules', '/app/rules'],
  ['Account settings', '/app/account'],
  ['League settings', '/app/commissioner/settings'],
  ['Members', '/app/commissioner/members'],
  ['Join-code controls', '/app/commissioner/join-code'],
  ['Starting-gameweek controls', '/app/commissioner/start-gameweek'],
  ['Data synchronization status', '/app/commissioner/sync'],
] as const

export function AppLayout() {
  return (
    <div className="app-shell">
      <header className="top-bar">
        <Link to="/" className="brand">
          Arsenal Fantasy League
        </Link>
      </header>
      <nav className="nav-grid">
        {links.map(([label, href]) => (
          <NavLink key={href} to={href} className={({ isActive }) => (isActive ? 'pill active' : 'pill')}>
            {label}
          </NavLink>
        ))}
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
