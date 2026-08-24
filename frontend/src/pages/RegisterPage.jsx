import { Link } from 'react-router-dom'

function RegisterPage() {
  return (
    <section className="auth-page">
      <div className="auth-card">
        <p className="section-kicker">Join Steamn&apos;t</p>
        <h1>Create your account</h1>
        <p className="auth-intro">
          Registration routing is ready. Real account creation will be connected in a later task.
        </p>

        <form className="auth-form">
          <label>
            <span>Username</span>
            <input type="text" placeholder="Your username" />
          </label>
          <label>
            <span>Email</span>
            <input type="email" placeholder="you@example.com" />
          </label>
          <label>
            <span>Password</span>
            <input type="password" placeholder="••••••••" />
          </label>
          <button type="button" className="primary-button auth-submit">
            Create account
          </button>
        </form>

        <p className="auth-bottom-text">
          Already have an account?{' '}
          <Link to="/login">Log in</Link>
        </p>
      </div>
    </section>
  )
}

export default RegisterPage
