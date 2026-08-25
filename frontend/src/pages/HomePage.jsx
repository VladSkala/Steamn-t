import { useRef } from 'react'
import { Link } from 'react-router-dom'

const recommendedGames = [
  {
    title: 'Black Myth: Wukong',
    price: '59.99$',
    type: 'ember',
  },
  {
    title: 'The Witcher 3',
    price: '39.99$',
    type: 'forest',
  },
  {
    title: 'Manor Lords',
    price: '34.99$',
    type: 'gold',
  },
  {
    title: 'Avatar: Frontiers',
    price: '69.99$',
    type: 'ocean',
  },
]

const popularGames = [
  {
    title: 'Bellwright',
    price: '29.99$',
    type: 'sand',
  },
  {
    title: 'Stardew Valley',
    price: '14.99$',
    type: 'garden',
  },
  {
    title: 'Ghost of Tsushima',
    price: '59.99$',
    type: 'storm',
  },
  {
    title: 'Avatar: Frontiers',
    price: '69.99$',
    type: 'ocean',
  },
]

const affordableGames = [
  {
    title: 'FAR: Lone Sails',
    price: '9.99$',
    type: 'silver',
  },
  {
    title: 'A Placid Plastic Duck',
    price: '7.99$',
    type: 'duck',
  },
  {
    title: 'The Escape Together',
    price: '12.99$',
    type: 'night',
  },
  {
    title: 'Juno: New World',
    price: '19.99$',
    type: 'green',
  },
]

const moreGames = [
  {
    title: 'Baldur’s Gate 3',
    price: '59.99$',
    type: 'fire',
  },
  {
    title: 'Destiny 2',
    price: 'Free',
    type: 'space',
  },
  {
    title: 'Soul Dossier',
    price: '24.99$',
    type: 'violet',
  },
  {
    title: 'Kingdom Come',
    price: '39.99$',
    type: 'stone',
  },
  {
    title: 'Sun Haven',
    price: '24.99$',
    type: 'sun',
  },
  {
    title: 'Counter-Strike 2',
    price: 'Free',
    type: 'orange',
  },
  {
    title: 'Project Zomboid',
    price: '19.99$',
    type: 'fog',
  },
  {
    title: 'Subnautica',
    price: '29.99$',
    type: 'blue',
  },
]

function GameCard({ game }) {
  return (
    <article className="game-card">
      <div className={`game-cover game-cover-${game.type}`}>
        <div className="game-cover-overlay" />

        <span className="game-cover-mark">
          S
        </span>

        <span className="game-cover-title">
          {game.title}
        </span>
      </div>

      <div className="game-card-content">
        <h3>{game.title}</h3>

        <div className="game-card-bottom">
          <span className="game-platform">
            Steamn’t
          </span>

          <span className="game-price">
            {game.price}
          </span>
        </div>
      </div>
    </article>
  )
}

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
    <section className="game-section">
      <div className="section-heading">
        <div>
          <p className="section-kicker">
            DISCOVER
          </p>

          <h2>{title}</h2>
        </div>

        <div className="section-actions">
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

          <Link to="/catalog" className="section-link">
            View all
            <span>→</span>
          </Link>
        </div>
      </div>

      <div ref={sliderRef} className="games-slider">
        {games.map((game) => (
          <GameCard
            key={game.title}
            game={game}
          />
        ))}
      </div>
    </section>
  )
}

function HomePage() {
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
            <Link
              to="/catalog"
              className="primary-button"
            >
              Explore games
              <span>→</span>
            </Link>

            <Link
              to="/login"
              className="secondary-button"
            >
              Join Steamn’t
            </Link>
          </div>
        </div>


      </section>

      <section className="quick-features">
        <article className="quick-feature">
          <div className="feature-icon">
            ✦
          </div>

          <div>
            <h3>Discover</h3>
            <p>
              Find games that match your mood,
              interests and play style.
            </p>
          </div>
        </article>

        <article className="quick-feature">
          <div className="feature-icon">
            ▣
          </div>

          <div>
            <h3>Track</h3>
            <p>
              Keep your gaming library organized
              and never lose track of great titles.
            </p>
          </div>
        </article>

        <article className="quick-feature">
          <div className="feature-icon">
            ◉
          </div>

          <div>
            <h3>Play</h3>
            <p>
              Spend less time searching
              and more time enjoying games.
            </p>
          </div>
        </article>
      </section>

      <GameSection
        title="Recommended for you"
        games={recommendedGames}
      />

      <GameSection
        title="Recommended now"
        games={popularGames}
      />

      <GameSection
        title="Under 100"
        games={affordableGames}
      />

      <GameSection
        title="Popular and trending"
        games={moreGames}
      />

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

        <Link
          to="/catalog"
          className="primary-button"
        >
          Browse catalog
          <span>→</span>
        </Link>
      </section>
    </div>
  )
}

export default HomePage