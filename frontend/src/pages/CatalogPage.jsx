import { useEffect, useMemo, useState } from 'react'

import CatalogFeedback from '../components/CatalogFeedback'
import GameCard from '../components/GameCard'
import useCatalogData from '../hooks/useCatalogData'
import { getLibrary } from '../api/library'
import { useAuth } from '../hooks/useAuth'

const SORT_OPTIONS = [
  { value: '', label: 'Title: A to Z' },
  { value: '-title', label: 'Title: Z to A' },
  { value: 'price', label: 'Price: Low to High' },
  { value: '-price', label: 'Price: High to Low' },
]

const EMPTY_SET = new Set()

const collectGenres = (apiGenres) =>
  [...apiGenres]
    .filter((genre) => genre?.id != null && genre?.name)
    .sort((first, second) => first.name.localeCompare(second.name))

function CatalogPage() {
  const [view, setView] = useState('grid')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [selectedGenre, setSelectedGenre] = useState('all')
  const [ordering, setOrdering] = useState('')

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setSearch(searchInput), 300)
    return () => window.clearTimeout(timeoutId)
  }, [searchInput])

  const { games, genres, loading, error, retry } = useCatalogData({
    includeGenres: true,
    search,
    genre: selectedGenre,
    ordering,
  })
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const [libraryState, setLibraryState] = useState({ ownerId: null, gameIds: new Set() })

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      return undefined
    }

    const controller = new AbortController()

    getLibrary({ signal: controller.signal })
      .then((items) => {
        if (!controller.signal.aborted) {
          setLibraryState({
            ownerId: String(user.id),
            gameIds: new Set(
              items
                .map((item) => item?.game?.id ?? item?.game_id)
                .filter((id) => id != null)
                .map(String),
            ),
          })
        }
      })
      .catch((requestError) => {
        if (controller.signal.aborted || requestError?.code === 'ERR_CANCELED') return
        setLibraryState({ ownerId: String(user.id), gameIds: new Set() })
      })

    return () => controller.abort()
  }, [authLoading, isAuthenticated, user?.id])

  const libraryGameIds =
    isAuthenticated && libraryState.ownerId === String(user?.id)
      ? libraryState.gameIds
      : EMPTY_SET

  const availableGenres = useMemo(() => collectGenres(genres), [genres])

  const resetFilters = () => {
    setSearchInput('')
    setSearch('')
    setSelectedGenre('all')
    setOrdering('')
  }

  const hasActiveFilters =
    searchInput.trim() !== '' || selectedGenre !== 'all' || ordering !== ''

  const gameCountLabel = loading
    ? 'Loading games…'
    : `${games.length} ${games.length === 1 ? 'game' : 'games'} found`

  return (
    <div className="catalog-page">
      <section className="catalog-hero">
        <span className="section-kicker">EXPLORE THE COLLECTION</span>
        <h1>Find your next favorite game.</h1>
        <p>Browse the catalog and discover something new to play.</p>
      </section>

      <section className="catalog-toolbar" aria-label="Catalog controls">
        <div className="catalog-search">
          <span className="search-icon" aria-hidden="true">⌕</span>
          <input
            type="search"
            aria-label="Search games by title"
            placeholder="Search games..."
            value={searchInput}
            disabled={loading || Boolean(error)}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>

        <label className="catalog-sort">
          <span className="catalog-sort-label">Sort</span>
          <span className="sort-select-control">
            <select
              aria-label="Sort games"
              value={ordering}
              disabled={loading || Boolean(error)}
              onChange={(event) => setOrdering(event.target.value)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value || 'default'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </span>
        </label>

        <span className="catalog-count" aria-live="polite">{gameCountLabel}</span>

        <div className="view-switcher" aria-label="Catalog view">
          <button type="button" className={view === 'grid' ? 'view-button active' : 'view-button'} aria-pressed={view === 'grid'} onClick={() => setView('grid')}>Grid</button>
          <button type="button" className={view === 'list' ? 'view-button active' : 'view-button'} aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button>
        </div>
      </section>

      <div className="catalog-layout">
        <aside className="catalog-filters" aria-label="Catalog filters">
          <div className="filter-heading">
            <span>FILTERS</span>
            <button type="button" disabled={loading || Boolean(error) || !hasActiveFilters} onClick={resetFilters}>Reset</button>
          </div>

          <div className="filter-group">
            <h3>Genre</h3>
            <button type="button" className={selectedGenre === 'all' ? 'filter-option active' : 'filter-option'} disabled={loading || Boolean(error)} onClick={() => setSelectedGenre('all')}>
              <span>All</span>{selectedGenre === 'all' && <span>✓</span>}
            </button>

            {availableGenres.map((genre) => {
              const genreId = String(genre.id)
              const isActive = selectedGenre === genreId
              return (
                <button type="button" key={genre.id} className={isActive ? 'filter-option active' : 'filter-option'} disabled={loading || Boolean(error)} onClick={() => setSelectedGenre(genreId)}>
                  <span>{genre.name}</span>{isActive && <span>✓</span>}
                </button>
              )
            })}

            {!loading && !error && availableGenres.length === 0 && <p className="filter-empty-note">No genres available yet.</p>}
          </div>
        </aside>

        <section id="catalog-results" className="catalog-results" aria-label="Catalog results">
          {loading && <CatalogFeedback kind="loading" title="Loading catalog" message="Fetching games from the server." />}
          {error && <CatalogFeedback kind="error" title="Catalog unavailable" message={error} onRetry={retry} />}
          {!loading && !error && games.length === 0 && (
            <CatalogFeedback
              kind="empty"
              title={hasActiveFilters ? 'No games found' : 'The catalog is empty'}
              message={hasActiveFilters ? 'Try changing your search, genre filter, or sorting.' : 'Games added to Steamn’t will appear here.'}
            />
          )}
          {!loading && !error && games.length > 0 && (
            <div className={view === 'grid' ? 'catalog-games-grid' : 'catalog-games-list'}>
              {games.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  variant="catalog"
                  view={view}
                  isOwned={libraryGameIds.has(String(game.id))}
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
