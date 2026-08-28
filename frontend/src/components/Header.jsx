import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCart } from '../hooks/useCart'

const navigationItems = [
  { label: 'Home', to: '/' },
  { label: 'Catalog', to: '/catalog' },
]

function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { isAuthenticated, logout } = useAuth()
  const { itemCount } = useCart()
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
            <Link to="/cart" className="cart-header-link" onClick={closeMenu} aria-label={`Cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}>
              <span className="cart-header-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M3.5 4h2l1.7 10.1a2 2 0 0 0 2 1.7h7.9a2 2 0 0 0 1.9-1.3L21 7H7" />
                  <path d="M9.4 18.8h.1M17.2 18.8h.1" />
                </svg>
              </span>
              <span>Cart</span>
              {isAuthenticated && itemCount > 0 && (
                <b className="cart-header-count">{itemCount}</b>
              )}
            </Link>
            {isAuthenticated ? (
              <>
                <Link to="/profile" className="login-button" onClick={closeMenu}>Profile</Link>
                <button type="button" className="signup-button" onClick={() => { logout(); closeMenu() }}>Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" className="login-button" onClick={closeMenu}>Login</Link>
                <Link to="/register" className="signup-button" onClick={closeMenu}>Sign up</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
