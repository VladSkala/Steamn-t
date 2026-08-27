import { Link, useParams } from 'react-router-dom'

import CatalogFeedback from '../components/CatalogFeedback'
import useGameDetails from '../hooks/useGameDetails'

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
    : new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date)
}

const getFallbackStyle = (game) => {
  const styles = ['ember', 'forest', 'gold', 'ocean', 'storm', 'violet', 'space']
  const seed = String(game?.id ?? game?.title ?? '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return styles[seed % styles.length]
}

function GameDetailsPage() {
  const { gameId } = useParams()
  const { game, loading, error, retry } = useGameDetails(gameId)

  if (loading) {
    return (
      <div className="game-details-page game-details-feedback">
        <CatalogFeedback kind="loading" title="Loading game" message="Fetching game details from the server." />
      </div>
    )
  }

  if (error === 'not-found') {
    return (
      <div className="game-details-page game-details-feedback">
        <CatalogFeedback kind="empty" title="Game not found" message="This game does not exist or may no longer be available." />
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

  const genres = Array.isArray(game?.genres) ? game.genres.filter((genre) => genre?.name) : []
  const fallbackStyle = getFallbackStyle(game)
  const requirements = game?.requirements?.trim()

  return (
    <div className="game-details-page">
      <Link className="details-back-link" to="/catalog">← Back to catalog</Link>

      <section className="game-details-hero">
        <div className={`game-details-cover game-cover-${fallbackStyle}`}>
          {game?.cover && <img src={game.cover} alt={`Cover of ${game.title}`} onError={(event) => { event.currentTarget.hidden = true }} />}
          <div className="game-details-cover-overlay" />
          <span className="game-details-cover-mark" aria-hidden="true">S</span>
        </div>

        <div className="game-details-summary">
          <span className="section-kicker">GAME DETAILS</span>
          <h1>{game?.title || 'Untitled game'}</h1>
          <p className="game-details-description">{game?.description || 'No description available yet.'}</p>

          <div className="game-details-meta">
            <div><span>Developer</span><strong>{game?.developer || 'Not specified'}</strong></div>
            <div><span>Release date</span><strong>{formatDate(game?.release_date)}</strong></div>
          </div>

          <div className="game-details-genres" aria-label="Game genres">
            {genres.length > 0 ? genres.map((genre) => <span key={genre.id ?? genre.name}>{genre.name}</span>) : <span>Genre not specified</span>}
          </div>

          <div className="game-details-purchase">
            <strong className="game-details-price">{formatPrice(game?.price)}</strong>
            <div className="game-details-actions">
              <button type="button" className="details-button details-button-primary">Add to Cart</button>
              <button type="button" className="details-button details-button-secondary">Add to Wishlist</button>
            </div>
          </div>
        </div>
      </section>

      <section className="game-requirements">
        <span className="section-kicker">SYSTEM REQUIREMENTS</span>
        <h2>Requirements</h2>
        {requirements ? <pre>{requirements}</pre> : <p>System requirements are not available yet.</p>}
      </section>
    </div>
  )
}

export default GameDetailsPage
