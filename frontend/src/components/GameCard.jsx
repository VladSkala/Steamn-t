const fallbackStyles = [
  'ember',
  'forest',
  'gold',
  'ocean',
  'sand',
  'garden',
  'storm',
  'silver',
  'night',
  'green',
  'fire',
  'space',
  'violet',
  'stone',
  'sun',
  'orange',
  'fog',
  'blue',
]

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const getFallbackStyle = (game) => {
  const seed = String(game.id ?? game.title ?? '')
    .split('')
    .reduce((total, character) => total + character.charCodeAt(0), 0)

  return fallbackStyles[seed % fallbackStyles.length]
}

const getGenreLabel = (genres) => {
  if (!Array.isArray(genres)) {
    return 'Genre not specified'
  }

  const names = genres
    .map((genre) => genre?.name?.trim())
    .filter(Boolean)

  return names.length > 0
    ? names.join(' · ')
    : 'Genre not specified'
}

const formatPrice = (price) => {
  const numericPrice = Number(price)

  if (!Number.isFinite(numericPrice)) {
    return 'Price unavailable'
  }

  if (numericPrice === 0) {
    return 'Free'
  }

  return priceFormatter.format(numericPrice)
}

const hideBrokenCover = (event) => {
  event.currentTarget.hidden = true
}

function GameCard({ game, variant = 'home', view = 'grid' }) {
  const title = game?.title?.trim() || 'Untitled game'
  const genreLabel = getGenreLabel(game?.genres)
  const developer = game?.developer?.trim() || 'Steamn’t catalog'
  const fallbackStyle = getFallbackStyle(game ?? {})
  const cardClasses = [
    'game-card',
    variant === 'catalog' ? 'catalog-card' : '',
    variant === 'catalog' && view === 'list' ? 'list-view' : '',
  ].filter(Boolean).join(' ')

  return (
    <article className={cardClasses}>
      <div className={`game-cover game-cover-${fallbackStyle}`}>
        {game?.cover && (
          <img
            className="game-cover-image"
            src={game.cover}
            alt={`Cover of ${title}`}
            loading="lazy"
            decoding="async"
            onError={hideBrokenCover}
          />
        )}

        <div className="game-cover-overlay" />

        <span className="game-cover-mark" aria-hidden="true">
          S
        </span>

        <span className="game-cover-title">
          {title}
        </span>
      </div>

      <div className="game-card-content">
        <div className="game-card-copy">
          <h3 title={title}>{title}</h3>
          <p className="game-genres" title={genreLabel}>
            {genreLabel}
          </p>
        </div>

        <div className="game-card-bottom">
          <span className="game-developer" title={developer}>
            {developer}
          </span>

          <span className="game-price">
            {formatPrice(game?.price)}
          </span>
        </div>
      </div>
    </article>
  )
}

export default GameCard
