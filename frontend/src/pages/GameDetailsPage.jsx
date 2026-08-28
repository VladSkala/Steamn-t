import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'

import CatalogFeedback from '../components/CatalogFeedback'
import useGameDetails from '../hooks/useGameDetails'
import { useAuth } from '../hooks/useAuth'
import { useCart } from '../hooks/useCart'

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const formatPrice = (price) => {
  const value = Number(price)
  if (!Number.isFinite(value)) return 'Price unavailable'
  return value === 0 ? 'Free' : priceFormatter.format(value)
}

const formatDate = (value) => {
  if (!value) return 'Release date unavailable'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(date)
}

const getFallbackStyle = (game) => {
  const styles = ['ember', 'forest', 'gold', 'ocean', 'storm', 'violet', 'space']
  const seed = String(game?.id ?? game?.title ?? '')
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return styles[seed % styles.length]
}

const getAddError = (requestError) => {
  const gameIdError = requestError.response?.data?.game_id

  if (Array.isArray(gameIdError)) {
    return gameIdError[0]
  }

  return (
    gameIdError ||
    requestError.response?.data?.detail ||
    'Unable to add this game to your cart.'
  )
}

function CartActionButton({ gameId }) {
  const location = useLocation()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const {
    addToCart,
    isInCart,
    isLoading: cartLoading,
    refreshCart,
  } = useCart()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (authLoading) {
    return (
      <button
        type="button"
        className="details-button details-button-primary"
        disabled
      >
        Checking session…
      </button>
    )
  }

  if (!isAuthenticated) {
    return (
      <Link
        className="details-button details-button-primary"
        to="/login"
        state={{ from: location }}
      >
        Sign in to add
      </Link>
    )
  }

  if (cartLoading) {
    return (
      <button
        type="button"
        className="details-button details-button-primary"
        disabled
      >
        Loading cart…
      </button>
    )
  }

  if (isInCart(gameId)) {
    return (
      <Link
        className="details-button details-button-primary details-button-in-cart"
        to="/cart"
      >
        <span className="details-cart-check" aria-hidden="true">✓</span>
        In cart · View
      </Link>
    )
  }

  const handleAdd = async () => {
    setSubmitting(true)
    setError('')

    try {
      await addToCart(gameId)
    } catch (requestError) {
      const message = getAddError(requestError)
      const duplicate =
        requestError.response?.status === 400 &&
        message?.toLowerCase().includes('already')

      if (duplicate) {
        try {
          await refreshCart()
          return
        } catch {
          // Fall through to the original, more useful duplicate error.
        }
      }

      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="details-cart-action">
      <button
        type="button"
        className="details-button details-button-primary"
        disabled={submitting}
        onClick={handleAdd}
      >
        {submitting ? 'Adding…' : 'Add to Cart'}
      </button>
      {error && (
        <span className="details-cart-error" role="alert">{error}</span>
      )}
    </div>
  )
}

function GameDetailsPage() {
  const { gameId } = useParams()
  const { game, loading, error, retry } = useGameDetails(gameId)

  if (loading) {
    return (
      <div className="game-details-page game-details-feedback">
        <CatalogFeedback
          kind="loading"
          title="Loading game"
          message="Fetching game details from the server."
        />
      </div>
    )
  }

  if (error === 'not-found') {
    return (
      <div className="game-details-page game-details-feedback">
        <CatalogFeedback
          kind="empty"
          title="Game not found"
          message="This game does not exist or may no longer be available."
        />
        <Link className="details-back-link" to="/catalog">Back to catalog</Link>
      </div>
    )
  }

  if (error) {
    const errorMessage =
      error === 'error'
        ? 'The game service had a problem. Please try again.'
        : error

    return (
      <div className="game-details-page game-details-feedback">
        <CatalogFeedback
          kind="error"
          title="Game unavailable"
          message={errorMessage}
          onRetry={retry}
        />
        <Link className="details-back-link" to="/catalog">
          Back to catalog
        </Link>
      </div>
    )
  }

  const genres = Array.isArray(game?.genres)
    ? game.genres.filter((genre) => genre?.name)
    : []
  const fallbackStyle = getFallbackStyle(game)
  const requirements = game?.requirements?.trim()

  return (
    <div className="game-details-page">
      <Link className="details-back-link" to="/catalog">
        ← Back to catalog
      </Link>

      <section className="game-details-hero">
        <div className={`game-details-cover game-cover-${fallbackStyle}`}>
          {game?.cover && (
            <img
              src={game.cover}
              alt={`Cover of ${game.title}`}
              onError={(event) => {
                event.currentTarget.hidden = true
              }}
            />
          )}
          <div className="game-details-cover-overlay" />
          <span className="game-details-cover-mark" aria-hidden="true">S</span>
        </div>

        <div className="game-details-summary">
          <span className="section-kicker">GAME DETAILS</span>
          <h1>{game?.title || 'Untitled game'}</h1>
          <p className="game-details-description">
            {game?.description || 'No description available yet.'}
          </p>

          <div className="game-details-meta">
            <div>
              <span>Developer</span>
              <strong>{game?.developer || 'Not specified'}</strong>
            </div>
            <div>
              <span>Release date</span>
              <strong>{formatDate(game?.release_date)}</strong>
            </div>
          </div>

          <div className="game-details-genres" aria-label="Game genres">
            {genres.length > 0 ? (
              genres.map((genre) => (
                <span key={genre.id ?? genre.name}>{genre.name}</span>
              ))
            ) : (
              <span>Genre not specified</span>
            )}
          </div>

          <div className="game-details-purchase">
            <strong className="game-details-price">
              {formatPrice(game?.price)}
            </strong>
            <div className="game-details-actions">
              <CartActionButton gameId={game?.id} />
              <button
                type="button"
                className="details-button details-button-secondary"
                disabled
                title="Wishlist is coming in a later card"
              >
                Add to Wishlist
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="game-requirements">
        <span className="section-kicker">SYSTEM REQUIREMENTS</span>
        <h2>Requirements</h2>
        {requirements ? (
          <pre>{requirements}</pre>
        ) : (
          <p>System requirements are not available yet.</p>
        )}
      </section>
    </div>
  )
}

export default GameDetailsPage
