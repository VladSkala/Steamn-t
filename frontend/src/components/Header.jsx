import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'

const navigationItems = [
  { label: 'Home', to: '/' },
  { label: 'Catalog', to: '/catalog' },
]

function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const headerRef = useRef(null)

  const closeMenu = () => setMenuOpen(false)

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }

    const handlePointerDown = (event) => {
      if (menuOpen && !headerRef.current?.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    const handleResize = () => {
      if (window.innerWidth > 700) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('resize', handleResize)

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('resize', handleResize)
    }
  }, [menuOpen])

  return (
    <header ref={headerRef} className="site-header">
      <div className="header-container">
        <Link to="/" className="brand" onClick={closeMenu}>
          <span className="brand-text">
            Steam<span>n</span>’t
          </span>
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

        <div
          id="main-header-menu"
          className={`header-menu${menuOpen ? ' is-open' : ''}`}
        >
          <nav className="main-nav" aria-label="Main navigation">
            {navigationItems.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `nav-link${isActive ? ' active' : ''}`
                }
                onClick={closeMenu}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="header-actions">
            <Link to="/login" className="login-button" onClick={closeMenu}>
              Login
            </Link>

            <Link to="/register" className="signup-button" onClick={closeMenu}>
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
