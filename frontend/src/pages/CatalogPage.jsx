import { useMemo, useState } from 'react'

import CatalogFeedback from '../components/CatalogFeedback'
import GameCard from '../components/GameCard'
import useCatalogData from '../hooks/useCatalogData'

const collectGenres = (games, apiGenres) => {
  const genresById = new Map()

  apiGenres.forEach((genre) => {
    if (genre?.id != null && genre?.name) {
      genresById.set(String(genre.id), genre)
    }
  })

  games.forEach((game) => {
    game.genres?.forEach((genre) => {
      if (genre?.id != null && genre?.name) {
        genresById.set(String(genre.id), genre)
      }
    })
  })

  return [...genresById.values()].sort((first, second) =>
    first.name.localeCompare(second.name),
  )
}

function CatalogPage() {
  const [view, setView] = useState('grid')
  const [search, setSearch] = useState('')
  const [selectedGenre, setSelectedGenre] = useState('all')
  const { games, genres, loading, error, retry } = useCatalogData({
    includeGenres: true,
  })

  const availableGenres = useMemo(
    () => collectGenres(games, genres),
    [games, genres],
  )

  const filteredGames = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return games.filter((game) => {
      const matchesSearch = String(game.title ?? '')
        .toLowerCase()
        .includes(normalizedSearch)

      const matchesGenre =
        selectedGenre === 'all' ||
        game.genres?.some(
          (genre) => String(genre.id) === selectedGenre,
        )

      return matchesSearch && matchesGenre
    })
  }, [games, search, selectedGenre])

  const resetFilters = () => {
    setSearch('')
    setSelectedGenre('all')
  }

  const gameCountLabel = loading
    ? 'Loading games…'
    : `${filteredGames.length} ${filteredGames.length === 1 ? 'game' : 'games'} found`

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

      <section className="catalog-toolbar" aria-label="Catalog controls">
        <div className="catalog-search">
          <span className="search-icon" aria-hidden="true">⌕</span>

          <input
            type="search"
            aria-label="Search games by title"
            placeholder="Search games..."
            value={search}
            disabled={loading || Boolean(error)}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <span className="catalog-count" aria-live="polite">
          {gameCountLabel}
        </span>

        <div className="view-switcher" aria-label="Catalog view">
          <button
            type="button"
            className={view === 'grid' ? 'view-button active' : 'view-button'}
            aria-pressed={view === 'grid'}
            onClick={() => setView('grid')}
          >
            Grid
          </button>

          <button
            type="button"
            className={view === 'list' ? 'view-button active' : 'view-button'}
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
          >
            List
          </button>
        </div>
      </section>

      <div className="catalog-layout">
        <aside className="catalog-filters" aria-label="Catalog filters">
          <div className="filter-heading">
            <span>FILTERS</span>

            <button
              type="button"
              disabled={loading || Boolean(error)}
              onClick={resetFilters}
            >
              Reset
            </button>
          </div>

          <div className="filter-group">
            <h3>Genre</h3>

            <button
              type="button"
              className={
                selectedGenre === 'all'
                  ? 'filter-option active'
                  : 'filter-option'
              }
              disabled={loading || Boolean(error)}
              onClick={() => setSelectedGenre('all')}
            >
              <span>All</span>
              {selectedGenre === 'all' && <span>✓</span>}
            </button>

            {availableGenres.map((genre) => {
              const genreId = String(genre.id)
              const isActive = selectedGenre === genreId

              return (
                <button
                  type="button"
                  key={genre.id}
                  className={
                    isActive
                      ? 'filter-option active'
                      : 'filter-option'
                  }
                  disabled={loading || Boolean(error)}
                  onClick={() => setSelectedGenre(genreId)}
                >
                  <span>{genre.name}</span>
                  {isActive && <span>✓</span>}
                </button>
              )
            })}

            {!loading && !error && availableGenres.length === 0 && (
              <p className="filter-empty-note">
                No genres available yet.
              </p>
            )}
          </div>
        </aside>

        <section
          id="catalog-results"
          className="catalog-results"
          aria-label="Catalog results"
        >
          {loading && (
            <CatalogFeedback
              kind="loading"
              title="Loading catalog"
              message="Fetching games and genres."
            />
          )}

          {error && (
            <CatalogFeedback
              kind="error"
              title="Catalog unavailable"
              message={error}
              onRetry={retry}
            />
          )}

          {!loading && !error && games.length === 0 && (
            <CatalogFeedback
              kind="empty"
              title="The catalog is empty"
              message="Games added to Steamn’t will appear here."
            />
          )}

          {!loading && !error && games.length > 0 && filteredGames.length === 0 && (
            <CatalogFeedback
              kind="empty"
              title="No games found"
              message="Try changing your search or genre filter."
            />
          )}

          {!loading && !error && filteredGames.length > 0 && (
            <div
              className={
                view === 'grid'
                  ? 'catalog-games-grid'
                  : 'catalog-games-list'
              }
            >
              {filteredGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  variant="catalog"
                  view={view}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default CatalogPage
