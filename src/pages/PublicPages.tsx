import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signIn, signUp } from '../services/auth'

export function WelcomePage() {
  return (
    <section className="card">
      <h1>Arsenal-Only Fantasy League</h1>
      <p>Private league play with Arsenal players only. Shared squads, transfers, and live standings.</p>
      <div className="button-row">
        <Link className="button" to="/signin">Sign in</Link>
        <Link className="button button-secondary" to="/signup">Create account</Link>
      </div>
    </section>
  )
}

export function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      await signIn(email, password)
      navigate('/app/leagues')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in')
    }
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      <h1>Sign in</h1>
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="Email" />
      <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required placeholder="Password" />
      {error && <p className="error">{error}</p>}
      <button className="button" type="submit">Sign in</button>
    </form>
  )
}

export function SignUpPage() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    try {
      await signUp(email, password, displayName)
      setNotice('Account created. Check your inbox if email confirmation is enabled.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign up')
    }
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      <h1>Sign up</h1>
      <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required placeholder="Display name" />
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="Email" />
      <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required placeholder="Password" minLength={8} />
      {error && <p className="error">{error}</p>}
      {notice && <p>{notice}</p>}
      <button className="button" type="submit">Create account</button>
    </form>
  )
}
