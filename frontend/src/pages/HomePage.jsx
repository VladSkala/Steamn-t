import { useRef } from 'react'
import { Link } from 'react-router-dom'

import CatalogFeedback from '../components/CatalogFeedback'
import GameCard from '../components/GameCard'
import useCatalogData from '../hooks/useCatalogData'

function GameSection({ title, games }) {
  const sliderRef = useRef(null)

  const scrollGames = (direction) => {
    const slider = sliderRef.current

    if (!slider) {
      return
    }

    const firstCard = slider.querySelector('.game-card')
    const gap = 18
    const amount = firstCard
      ? firstCard.getBoundingClientRect().width + gap
      : slider.clientWidth * 0.85

    slider.scrollBy({
      left: direction * amount,
      behavior: 'smooth',
    })
  }

  return (
    <section className="game-section" aria-labelledby="home-catalog-heading">
      <div className="section-heading">
        <div>
          <p className="section-kicker">
            DISCOVER
          </p>

          <h2 id="home-catalog-heading">{title}</h2>
        </div>

        <div className="section-actions">
          {games.length > 1 && (
            <div className="slider-controls">
              <button
                type="button"
                className="slider-button"
                aria-label={`Previous games in ${title}`}
                onClick={() => scrollGames(-1)}
              >
                ←
              </button>

              <button
                type="button"
                className="slider-button"
                aria-label={`Next games in ${title}`}
                onClick={() => scrollGames(1)}
              >
                →
              </button>
            </div>
          )}

          <Link to="/catalog" className="section-link">
            View all
            <span>→</span>
          </Link>
        </div>
      </div>

      <div ref={sliderRef} className="games-slider">
        {games.map((game) => (
          <GameCard
            key={game.id}
            game={game}
          />
        ))}
      </div>
    </section>
  )
}

function HomePage() {
  const { games, loading, error, retry } = useCatalogData()
  const previewGames = games.slice(0, 12)

  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-background">
          <div className="hero-mountain hero-mountain-left" />
          <div className="hero-mountain hero-mountain-center" />
          <div className="hero-glow" />
          <div className="hero-stars" />
        </div>

        <div className="hero-content">
          <div className="hero-badge">
            Your next favorite game is waiting
          </div>

          <h1>
            Discover games
            <span>worth playing.</span>
          </h1>

          <p>
            Steamn’t is a place for discovering,
            exploring and organizing games.
            Find something new for your next adventure.
          </p>

          <div className="hero-actions">
            <Link to="/catalog" className="primary-button">
              Explore games
              <span>→</span>
            </Link>

            <Link to="/register" className="secondary-button">
              Join Steamn’t
            </Link>
          </div>
        </div>
      </section>

      <section className="quick-features">
        <article className="quick-feature">
          <div className="feature-icon">✦</div>
          <div>
            <h3>Discover</h3>
            <p>
              Find games that match your mood,
              interests and play style.
            </p>
          </div>
        </article>

        <article className="quick-feature">
          <div className="feature-icon">▣</div>
          <div>
            <h3>Track</h3>
            <p>
              Keep your gaming library organized
              and never lose track of great titles.
            </p>
          </div>
        </article>

        <article className="quick-feature">
          <div className="feature-icon">◉</div>
          <div>
            <h3>Play</h3>
            <p>
              Spend less time searching
              and more time enjoying games.
            </p>
          </div>
        </article>
      </section>

      {loading && (
        <CatalogFeedback
          kind="loading"
          title="Loading games"
          message="Getting the catalog ready for you."
          className="home-catalog-feedback"
        />
      )}

      {error && (
        <CatalogFeedback
          kind="error"
          title="Catalog unavailable"
          message={error}
          onRetry={retry}
          className="home-catalog-feedback"
        />
      )}

      {!loading && !error && previewGames.length === 0 && (
        <CatalogFeedback
          kind="empty"
          title="The catalog is empty"
          message="Games added to Steamn’t will appear here."
          className="home-catalog-feedback"
        />
      )}

      {!loading && !error && previewGames.length > 0 && (
        <GameSection
          title="Explore the catalog"
          games={previewGames}
        />
      )}

      <section className="home-bottom-cta">
        <div>
          <span className="section-kicker">
            YOUR LIBRARY STARTS HERE
          </span>

          <h2>
            Find something
            you want to play.
          </h2>

          <p>
            Browse games, discover new genres
            and build your personal collection.
          </p>
        </div>

        <Link to="/catalog" className="primary-button">
          Browse catalog
          <span>→</span>
        </Link>
      </section>
    </div>
  )
}

export default HomePage
