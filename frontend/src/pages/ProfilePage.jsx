import { Link } from 'react-router-dom'
import { useAuth } from "../hooks/useAuth";

function ProfilePage() {
  const { user } = useAuth()

  return (
    <div className="profile-page">
      <section className="profile-hero">
        <div className="profile-avatar">
          {user?.name?.charAt(0).toUpperCase()}
        </div>

        <div>
          <span className="section-kicker">
            PERSONAL PROFILE
          </span>

          <h1>
            Welcome back,
            {` ${user?.name}`}
          </h1>

          <p>
            Your Steamn’t account and personal
            game space.
          </p>
        </div>
      </section>

      <div className="profile-grid">
        <article className="profile-card">
          <span className="profile-card-label">
            EMAIL
          </span>

          <strong>
            {user?.email}
          </strong>
        </article>

        <article className="profile-card">
          <span className="profile-card-label">
            LIBRARY
          </span>

          <strong>
            0 games
          </strong>
        </article>

        <article className="profile-card">
          <span className="profile-card-label">
            WISHLIST
          </span>

          <strong>
            0 games
          </strong>
        </article>
      </div>

      <section className="profile-library-empty">
        <span>✦</span>

        <h2>
          Your library is waiting.
        </h2>

        <p>
          Start exploring and find games
          you want to remember.
        </p>

        <Link
          to="/catalog"
          className="primary-button"
        >
          Explore catalog
          <span>→</span>
        </Link>
      </section>
    </div>
  )
}

export default ProfilePage