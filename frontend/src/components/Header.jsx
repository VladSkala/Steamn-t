import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'

const navigationItems = [
  { label: 'Home', to: '/' },
  { label: 'Catalog', to: '/catalog' },
]

function Header() {
  const [menuOpen, setMenuOpen] = useState(false)

  const closeMenu = () => setMenuOpen(false)

  return (
    <header className="site-header">
      <div className="header-container">
        <Link to="/" className="brand" onClick={closeMenu}>
          <span className="brand-text">Steamn&apos;t</span>
        </Link>

        <div
          id="main-header-menu"
          className={`header-menu${menuOpen ? ' is-open' : ''}`}
        >
          <nav className="main-nav" aria-label="Main navigation">
            {navigationItems.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                className="nav-link"
                onClick={closeMenu}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <Link to="/register" className="signup-button" onClick={closeMenu}>
            Sign up
          </Link>
        </div>

        <div className="header-mobile-controls">
          <Link to="/login" className="login-button" onClick={closeMenu}>
            Login
          </Link>

          <button
            type="button"
            className={`menu-toggle${menuOpen ? ' is-open' : ''}`}
            aria-expanded={menuOpen}
            aria-controls="main-header-menu"
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header
