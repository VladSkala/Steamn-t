import { useState } from 'react'
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

const getFallbackStyle = (game) => {
  const styles = ['ember', 'forest', 'gold', 'ocean', 'storm', 'violet', 'space']
  const seed = String(game?.id ?? game?.title ?? '')
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0)

  return styles[seed % styles.length]
}

const normalizeRequirements = (requirements) => {
  if (!requirements?.trim()) return []

  return requirements
    .split(/\n|\r|;/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, ...rest] = line.split(':')

      return {
        label: rest.length ? label : 'Requirement',
        value: rest.length ? rest.join(':').trim() : line,
      }
    })
}

function GameDetailsPage() {
  const { gameId } = useParams()
  const { game, loading, error, retry } = useGameDetails(gameId)
  const [activeTab, setActiveTab] = useState('about')

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
    return (
      <div className="game-details-page game-details-feedback">
        <CatalogFeedback
          kind="error"
          title="Game unavailable"
          message={error === 'error' ? 'The game service had a problem. Please try again.' : error}
          onRetry={retry}
        />
        <Link className="details-back-link" to="/catalog">Back to catalog</Link>
      </div>
    )
  }

  const genres = Array.isArray(game?.genres)
    ? game.genres.filter((genre) => genre?.name)
    : []
  const fallbackStyle = getFallbackStyle(game)
  const requirements = normalizeRequirements(game?.requirements)
  const title = game?.title || 'Untitled game'
  const description = game?.description || 'No description available yet.'
  const genreLabel = genres.map((genre) => genre.name).join(' · ') || 'Game'

  const renderTabContent = () => {
    if (activeTab === 'characteristics') {
      return (
        <section className="details-section details-characteristics">
          <div className="details-section-heading">
            <h2>System requirements</h2>
            <span>Minimum / recommended</span>
          </div>

          <div className="requirements-grid">
            <article className="requirements-card">
              <h3>Minimum</h3>
              {requirements.length > 0 ? (
                requirements.map((item, index) => (
                  <div className="requirement-row" key={`${item.label}-${index}`}>
                    <strong>{item.label}</strong>
                    <span>{item.value}</span>
                  </div>
                ))
              ) : (
                <p>System requirements are not available yet.</p>
              )}
            </article>

            <article className="requirements-card recommended">
              <h3>Recommended</h3>
              {requirements.length > 0 ? (
                requirements.map((item, index) => (
                  <div className="requirement-row" key={`${item.label}-${index}`}>
                    <strong>{item.label}</strong>
                    <span>{item.value}</span>
                  </div>
                ))
              ) : (
                <p>Contact the publisher for recommended specifications.</p>
              )}
            </article>
          </div>
        </section>
      )
    }

    if (activeTab === 'community') {
      return (
        <section className="details-section details-community">
          <div className="details-section-heading">
            <h2>Community</h2>
            <span>Player activity</span>
          </div>
          <p className="details-empty-state">
            Community content will appear here as reviews and discussions are added.
          </p>
        </section>
      )
    }

    return (
      <>
        <section className="details-about-card">
          <h2>About the game</h2>
          <p>{description}</p>
          <div className="details-tags">
            {genres.length > 0 ? (
              genres.map((genre) => (
                <span key={genre.id ?? genre.name}>{genre.name}</span>
              ))
            ) : (
              <span>Genre not specified</span>
            )}
          </div>
        </section>

        <section className="details-section details-editions">
          <div className="details-section-heading">
            <h2>Packages</h2>
            <span>Available editions</span>
          </div>

          <article className="edition-card">
            <h3>{title}</h3>
            <p>{description}</p>
            <div>
              <strong>{formatPrice(game?.price)}</strong>
              <button type="button" className="details-button details-button-primary">
                Add to cart
              </button>
            </div>
          </article>
        </section>
      </>
    )
  }

  return (
    <div className="game-details-page">
      <div className="game-details-breadcrumb">
        <Link to="/catalog">Store</Link>
        <span>/</span>
        <span>{genreLabel}</span>
      </div>

      <div className="game-details-layout">
        <div className="game-details-main">
          <div className={`details-hero-cover game-cover-${fallbackStyle}`}>
            {game?.cover && (
              <img
                src={game.cover}
                alt={`Cover of ${title}`}
                onError={(event) => { event.currentTarget.hidden = true }}
              />
            )}
            <div className="details-hero-shade" />
            <div className="details-hero-title">
              <span>SLUSH</span>
              <strong>{title}</strong>
            </div>
          </div>

          <div className="details-tabs" role="tablist" aria-label="Game details">
            {[
              ['about', 'About'],
              ['characteristics', 'Characteristics'],
              ['community', 'Community'],
            ].map(([tab, label]) => (
              <button
                key={tab}
                className={activeTab === tab ? 'active' : ''}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
              >
                {label}
              </button>
            ))}
          </div>

          {renderTabContent()}
        </div>

        <aside className="game-purchase-sidebar">
          <div className="sidebar-cover game-cover-storm">
            {game?.cover && (
              <img
                src={game.cover}
                alt=""
                onError={(event) => { event.currentTarget.hidden = true }}
              />
            )}
          </div>
          <div className="rating-line">
            <span>{genres.length ? '★'.repeat(Math.min(5, Math.max(3, genres.length + 3))) : '★★★★★'}</span>
            <small>5.0</small>
          </div>
          <strong className="sidebar-price">{formatPrice(game?.price)}</strong>
          <button type="button" className="details-button details-button-primary sidebar-buy">
            Buy now
          </button>
          <div className="sidebar-action-row">
            <button type="button">Add to cart</button>
            <button type="button" aria-label="Add to wishlist">♡</button>
          </div>
          <div className="sidebar-links">
            <button type="button">⇧ Share</button>
            <button type="button">▣ Follow</button>
            <button type="button">▢ Write review</button>
          </div>
          <dl className="game-facts">
            <div><dt>Release date</dt><dd>{game?.release_date || 'Not specified'}</dd></div>
            <div><dt>Developer</dt><dd>{game?.developer || 'Not specified'}</dd></div>
            <div><dt>Publisher</dt><dd>{game?.developer || 'Not specified'}</dd></div>
          </dl>
          <div className="friend-panel">
            <h3>Friends who want this game</h3>
            <div className="avatar-stack"><span>G</span><span>S</span><span>K</span><b>+2</b></div>
          </div>
          <div className="friend-panel">
            <h3>Friends who own this game</h3>
            <div className="friend-list"><span>GhostRogue</span><span>slimrock</span><span>whysurky</span><span>+5</span></div>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default GameDetailsPage
