import { Link } from 'react-router-dom'

function LoginPage() {
  return (
    <section className="auth-page">
      <div className="auth-card">
        <p className="section-kicker">Steamn&apos;t account</p>
        <h1>Welcome back</h1>
        <p className="auth-intro">Sign in to continue discovering games.</p>

        <form className="auth-form">
          <label>
            <span>Email</span>
            <input type="email" placeholder="you@example.com" />
          </label>

          <label>
            <span>Password</span>
            <input type="password" placeholder="Enter your password" />
          </label>

          <button type="button" className="primary-button auth-submit">
            Sign in
          </button>
        </form>

        <p className="auth-bottom-text">
          Don&apos;t have an account?{' '}
          <Link to="/register">Create one</Link>
        </p>
      </div>
    </section>
  )
}

export default LoginPage
