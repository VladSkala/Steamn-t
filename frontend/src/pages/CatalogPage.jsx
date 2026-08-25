import { useMemo, useState } from 'react'

const games = [
  {
    title: 'Fallout 4',
    price: '19.99$',
    type: 'storm',
    genre: 'RPG',
  },
  {
    title: 'The Elder Scrolls V: Skyrim',
    price: '39.99$',
    type: 'stone',
    genre: 'RPG',
  },
  {
    title: 'Hogwarts Legacy',
    price: '59.99$',
    type: 'violet',
    genre: 'Adventure',
  },
  {
    title: 'Elden Ring',
    price: '59.99$',
    type: 'ember',
    genre: 'Action',
  },
  {
    title: 'Final Fantasy XVI',
    price: '69.99$',
    type: 'fire',
    genre: 'RPG',
  },
  {
    title: 'Black Desert',
    price: '29.99$',
    type: 'night',
    genre: 'MMORPG',
  },
  {
    title: 'Monster Hunter Wilds',
    price: '69.99$',
    type: 'forest',
    genre: 'Action',
  },
  {
    title: 'Sea of Thieves',
    price: '39.99$',
    type: 'ocean',
    genre: 'Adventure',
  },
  {
    title: 'Dying Light',
    price: '29.99$',
    type: 'fog',
    genre: 'Action',
  },
]

function CatalogCard({ game, view }) {
  return (
    <article className={`catalog-card ${view === 'list' ? 'list-view' : ''}`}>
      <div className={`game-cover game-cover-${game.type}`}>
        <div className="game-cover-overlay" />

        <span className="game-cover-mark">
          S
        </span>

        <span className="game-cover-title">
          {game.title}
        </span>
      </div>

      <div className="catalog-card-info">
        <div>
          <h3>{game.title}</h3>

          <p>{game.genre}</p>
        </div>

        <span className="game-price">
          {game.price}
        </span>
      </div>
    </article>
  )
}

function CatalogPage() {
  const [view, setView] = useState('grid')
  const [search, setSearch] = useState('')
  const [selectedGenre, setSelectedGenre] = useState('All')

  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      const matchesSearch = game.title
        .toLowerCase()
        .includes(search.toLowerCase())

      const matchesGenre =
        selectedGenre === 'All' ||
        game.genre === selectedGenre

      return matchesSearch && matchesGenre
    })
  }, [search, selectedGenre])

  return (
    <div className="catalog-page">
      <section className="catalog-hero">
        <span className="section-kicker">
          EXPLORE THE COLLECTION
        </span>

        <h1>
          Find your next
          favorite game.
        </h1>

        <p>
          Browse the catalog and discover something
          new to play.
        </p>
      </section>

      <section className="catalog-toolbar">
        <div className="catalog-search">
          <span className="search-icon" aria-hidden="true">⌕</span>

          <input
            type="text"
            placeholder="Search games..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>

        <span className="catalog-count" aria-live="polite">
          {filteredGames.length} games found
        </span>

        <div className="view-switcher">
          <button
            type="button"
            className={
              view === 'grid'
                ? 'view-button active'
                : 'view-button'
            }
            onClick={() => setView('grid')}
          >
            Grid
          </button>

          <button
            type="button"
            className={
              view === 'list'
                ? 'view-button active'
                : 'view-button'
            }
            onClick={() => setView('list')}
          >
            List
          </button>
        </div>
      </section>

      <div className="catalog-layout">
        <aside className="catalog-filters">
          <div className="filter-heading">
            <span>FILTERS</span>

            <button
              type="button"
              onClick={() => {
                setSearch('')
                setSelectedGenre('All')
              }}
            >
              Reset
            </button>
          </div>

          <div className="filter-group">
            <h3>Genre</h3>

            {[
              'All',
              'RPG',
              'Action',
              'Adventure',
              'MMORPG',
            ].map((genre) => (
              <button
                type="button"
                key={genre}
                className={
                  selectedGenre === genre
                    ? 'filter-option active'
                    : 'filter-option'
                }
                onClick={() =>
                  setSelectedGenre(genre)
                }
              >
                <span>{genre}</span>

                {selectedGenre === genre && (
                  <span>✓</span>
                )}
              </button>
            ))}
          </div>

          <div className="filter-group">
            <h3>Price</h3>

            <button type="button" className="filter-option">
              Under 20$
            </button>

            <button type="button" className="filter-option">
              Under 50$
            </button>

            <button type="button" className="filter-option">
              Premium
            </button>
          </div>

          <div className="filter-group">
            <h3>Other</h3>

            <button type="button" className="filter-option">
              Singleplayer
            </button>

            <button type="button" className="filter-option">
              Multiplayer
            </button>
          </div>
        </aside>

        <section className="catalog-results">
          {filteredGames.length > 0 ? (
            <div
              className={
                view === 'grid'
                  ? 'catalog-games-grid'
                  : 'catalog-games-list'
              }
            >
              {filteredGames.map((game) => (
                <CatalogCard
                  key={game.title}
                  game={game}
                  view={view}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span>⌕</span>

              <h3>No games found</h3>

              <p>
                Try changing your search or filters.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default CatalogPage