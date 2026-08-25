import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', email: '', password: '', password_confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const submit = async (event) => {
    event.preventDefault(); setError('')
    if (form.password !== form.password_confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      await register(form); navigate('/profile', { replace: true })
    } catch (err) {
      const data = err.response?.data
      setError(data ? (Object.values(data).flat()[0] || 'Unable to create your account.') : 'Unable to create your account.')
    } finally { setLoading(false) }
  }

  return <section className="auth-page"><div className="auth-card auth-card-enter">
    <p className="section-kicker">Join Steamn&apos;t</p><h1>Create your account</h1>
    <p className="auth-intro">Create an account and keep your game library in one place.</p>
    <form className="auth-form" onSubmit={submit}>
      <label><span>Username</span><input name="username" type="text" placeholder="Your username" value={form.username} onChange={change} autoComplete="username" required /></label>
      <label><span>Email</span><input name="email" type="email" placeholder="you@example.com" value={form.email} onChange={change} autoComplete="email" required /></label>
      <label><span>Password</span><input name="password" type="password" placeholder="At least 8 characters" value={form.password} onChange={change} autoComplete="new-password" required /></label>
      <label><span>Confirm password</span><input name="password_confirm" type="password" placeholder="Repeat your password" value={form.password_confirm} onChange={change} autoComplete="new-password" required /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" className="primary-button auth-submit" disabled={loading}>{loading ? 'Creating account…' : 'Create account'}</button>
    </form>
    <p className="auth-bottom-text">Already have an account? <Link to="/login">Log in</Link></p>
  </div></section>
}
export default RegisterPage
