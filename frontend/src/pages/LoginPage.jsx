import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event) => {
    event.preventDefault(); setError(''); setLoading(true)
    try {
      await login(form)
      navigate(location.state?.from?.pathname || '/profile', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to sign in. Check your email and password.')
    } finally { setLoading(false) }
  }

  return <section className="auth-page"><div className="auth-card auth-card-enter">
    <p className="section-kicker">Steamn&apos;t account</p><h1>Welcome back</h1>
    <p className="auth-intro">Sign in to continue discovering games.</p>
    <form className="auth-form" onSubmit={submit}>
      <label><span>Email</span><input name="email" type="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" required /></label>
      <label><span>Password</span><input name="password" type="password" placeholder="Enter your password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="current-password" required /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" className="primary-button auth-submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
    </form>
    <p className="auth-bottom-text">Don&apos;t have an account? <Link to="/register">Create one</Link></p>
  </div></section>
}
export default LoginPage
