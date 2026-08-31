const getArtworkTone = (gameId) => {
  const numericId = Number(gameId)
  const tone = Number.isFinite(numericId) ? Math.abs(numericId) % 6 : 0
  return `library-artwork-tone-${tone + 1}`
}

const hideBrokenImage = (event) => {
  event.currentTarget.hidden = true
}

function LibraryArtwork({ game, className = '', wide = false }) {
  const title = game?.title?.trim() || 'Game'
  const source = wide ? game?.hero_image_url || game?.cover : game?.cover
  const classes = [
    'library-artwork',
    getArtworkTone(game?.id),
    wide ? 'is-wide' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={classes} aria-hidden="true">
      <span className="library-artwork-fallback">
        {title.charAt(0).toUpperCase()}
      </span>
      {source && (
        <img
          src={source}
          alt=""
          loading="lazy"
          decoding="async"
          onError={hideBrokenImage}
        />
      )}
    </span>
  )
}

export default LibraryArtwork
