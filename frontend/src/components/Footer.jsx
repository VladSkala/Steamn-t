import { Link } from 'react-router-dom'

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-container">
        <div className="footer-brand">
          <p className="footer-logo">
            Steam<span>n</span>’t
          </p>

        </div>

        <div className="footer-links">
          <Link to="/">Home</Link>
          <Link to="/catalog">Catalog</Link>
          <Link to="/profile">Profile</Link>
        </div>

        <p className="footer-copy">
          © 2026 Steamn’t
        </p>
      </div>
    </footer>
  )
}

export default Footer