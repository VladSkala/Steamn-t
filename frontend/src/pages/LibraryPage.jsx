import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import {
  createLibraryCollection,
  deleteLibraryCollection,
  togglePostReaction,
  updateLibraryCollection,
  updateLibraryItem,
} from '../api/library'
import CatalogFeedback from '../components/CatalogFeedback'
import LibraryArtwork from '../components/library/LibraryArtwork'
import LibraryFrame from '../components/library/LibraryFrame'
import LibraryPostCard from '../components/library/LibraryPostCard'
import { useLibraryHome } from '../hooks/useLibraryExperience'

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const formatPrice = (value) => {
  const price = Number(value)
  if (!Number.isFinite(price)) return 'Unavailable'
  return price === 0 ? 'Free' : priceFormatter.format(price)
}

const formatDate = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Unavailable'
    : dateFormatter.format(date)
}

const getTimestamp = (value) => {
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

const getMutationError = (error, fallback) => {
  const data = error.response?.data
  if (typeof data?.detail === 'string') return data.detail
  if (Array.isArray(data?.name)) return data.name[0]
  if (Array.isArray(data?.game_ids)) return data.game_ids[0]
  return fallback
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  )
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6h12M8 12h12M8 18h12" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
    </svg>
  )
}

function StarIcon({ filled = false }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        className={filled ? 'filled' : ''}
        d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"
      />
    </svg>
  )
}

function EditorialSection({ title, linkLabel, posts, onLike, onComments }) {
  return (
    <section className="library-editorial-section">
      <div className="library-section-heading">
        <h2>{title}</h2>
        <Link className="library-section-link" to="/library/feed">
          <span>{linkLabel}</span>
          <span className="library-section-link-arrow" aria-hidden="true">
            →
          </span>
        </Link>
      </div>
      {posts.length > 0 ? (
        <div className="library-editorial-grid">
          {posts.map((post) => (
            <LibraryPostCard
              post={post}
              compact
              key={post.id}
              onLike={onLike}
              onComments={onComments}
            />
          ))}
        </div>
      ) : (
        <Link className="library-editorial-empty" to="/library/feed">
          <span aria-hidden="true">✦</span>
          <strong>Nothing published yet</strong>
          <small>Community updates will appear here automatically.</small>
        </Link>
      )}
    </section>
  )
}

function LibraryGridCard({ item, favoriteBusy, onFavorite }) {
  const game = item.game ?? {}
  const title = game.title?.trim() || 'Untitled game'

  return (
    <article className="library-grid-card">
      <Link className="library-grid-link" to={`/library/games/${game.id}`}>
        <LibraryArtwork game={game} className="library-grid-artwork" />
        <span className="library-grid-card-body">
          <strong>{title}</strong>
          <span>{game.developer || 'Steamnt catalog'}</span>
          <span className="library-grid-meta">
            <time dateTime={item.purchased_at || undefined}>
              {formatDate(item.purchased_at)}
            </time>
            <b>{formatPrice(item.price_at_purchase)}</b>
          </span>
        </span>
      </Link>
      <button
        type="button"
        className={`library-favorite-button${item.is_favorite ? ' active' : ''}`}
        aria-label={
          item.is_favorite
            ? `Remove ${title} from favorites`
            : `Add ${title} to favorites`
        }
        aria-pressed={item.is_favorite}
        disabled={favoriteBusy}
        onClick={() => onFavorite(item)}
      >
        <StarIcon filled={item.is_favorite} />
      </button>
    </article>
  )
}

function LibraryListCard({ item, favoriteBusy, onFavorite }) {
  const game = item.game ?? {}
  const title = game.title?.trim() || 'Untitled game'

  return (
    <article className="library-list-card">
      <Link
        className="library-list-cover-link"
        to={`/library/games/${game.id}`}
      >
        <LibraryArtwork game={game} className="library-list-artwork" wide />
      </Link>
      <div className="library-list-copy">
        <Link to={`/library/games/${game.id}`}>{title}</Link>
        <span>{game.developer || 'Steamnt catalog'}</span>
      </div>
      <div className="library-list-size">
        <span>Disk size</span>
        <strong>
          {game.disk_size_gb
            ? `${Number(game.disk_size_gb).toLocaleString()} GB`
            : 'Not specified'}
        </strong>
      </div>
      <div className="library-list-actions">
        {game.download_url ? (
          <a href={game.download_url} target="_blank" rel="noreferrer">
            Download
          </a>
        ) : (
          <Link to={`/library/games/${game.id}`}>Details</Link>
        )}
        <button
          type="button"
          className={item.is_favorite ? 'active' : ''}
          aria-label={
            item.is_favorite
              ? `Remove ${title} from favorites`
              : `Add ${title} to favorites`
          }
          aria-pressed={item.is_favorite}
          disabled={favoriteBusy}
          onClick={() => onFavorite(item)}
        >
          <StarIcon filled={item.is_favorite} />
        </button>
      </div>
    </article>
  )
}

function CollectionDialog({
  items,
  collection,
  submitting,
  error,
  onClose,
  onSave,
  onDelete,
}) {
  const [name, setName] = useState(collection?.name || '')
  const [selectedIds, setSelectedIds] = useState(
    collection?.game_ids?.map(String) || [],
  )
  const [nameError, setNameError] = useState('')
  const [gameQuery, setGameQuery] = useState('')

  const toggleGame = (gameId) => {
    const key = String(gameId)
    setSelectedIds((current) =>
      current.includes(key)
        ? current.filter((id) => id !== key)
        : [...current, key],
    )
  }

  const normalizedGameQuery = gameQuery.trim().toLocaleLowerCase()
  const filteredItems = normalizedGameQuery
    ? items.filter((item) =>
        String(item.game?.title || '')
          .toLocaleLowerCase()
          .includes(normalizedGameQuery),
      )
    : items
  const selectedItems = items.filter((item) =>
    selectedIds.includes(String(item.game?.id)),
  )

  return (
    <div
      className="library-dialog-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="library-collection-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="collection-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="library-dialog-heading">
          <div>
            <span>COLLECTION</span>
            <h2 id="collection-dialog-title">
              {collection ? 'Edit collection' : 'New collection'}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </div>

        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            const normalizedName = name.trim()
            if (!normalizedName) {
              setNameError('Enter a collection name.')
              return
            }
            setNameError('')
            onSave({ name: normalizedName, gameIds: selectedIds.map(Number) })
          }}
        >
          <label className="library-dialog-name">
            <span className="library-dialog-label-row">
              <span>Name</span>
              <small>{name.length}/40</small>
            </span>
            <input
              value={name}
              maxLength={40}
              autoFocus
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? 'collection-name-error' : undefined}
              onChange={(event) => {
                setName(event.target.value)
                if (nameError) setNameError('')
              }}
              placeholder="Name your collection…"
            />
          </label>

          <fieldset className="library-dialog-fieldset">
            <legend>Add games</legend>
            <label className="library-dialog-game-search">
              <span className="library-visually-hidden">Search games</span>
              <span className="library-dialog-search-icon" aria-hidden="true">
                <SearchIcon />
              </span>
              <input
                type="search"
                value={gameQuery}
                onChange={(event) => setGameQuery(event.target.value)}
                placeholder="Search games by title…"
                disabled={items.length === 0}
              />
            </label>
            <p className="library-dialog-hint">
              Select games now or add them to this collection later.
            </p>

            {selectedItems.length > 0 && (
              <div className="library-dialog-selected-games">
                {selectedItems.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => toggleGame(item.game.id)}
                    aria-label={`Remove ${item.game.title} from collection`}
                  >
                    <span>{item.game.title}</span>
                    <span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
            )}

            <div className="library-dialog-games">
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <label key={item.id}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(String(item.game.id))}
                      onChange={() => toggleGame(item.game.id)}
                    />
                    <LibraryArtwork
                      game={item.game}
                      className="library-dialog-artwork"
                    />
                    <span>{item.game.title}</span>
                  </label>
                ))
              ) : (
                <p className="library-dialog-games-empty">No matching games.</p>
              )}
            </div>
          </fieldset>

          {nameError && (
            <p
              id="collection-name-error"
              className="library-dialog-error"
              role="alert"
            >
              {nameError}
            </p>
          )}
          {error && (
            <p className="library-dialog-error" role="alert">
              {error}
            </p>
          )}

          <div className="library-dialog-actions">
            {collection && (
              <button
                type="button"
                className="danger"
                disabled={submitting}
                onClick={onDelete}
              >
                Delete
              </button>
            )}
            <button type="button" disabled={submitting} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={submitting}>
              {submitting
                ? 'Saving…'
                : collection
                  ? 'Save changes'
                  : 'Create collection'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function LibraryPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { data, loading, error, retry, refresh, updatePost } = useLibraryHome()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('recent')
  const [view, setView] = useState('grid')
  const [section, setSection] = useState('all')
  const [favoriteBusyId, setFavoriteBusyId] = useState(null)
  const [dialogCollection, setDialogCollection] = useState(undefined)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogBusy, setDialogBusy] = useState(false)
  const [dialogError, setDialogError] = useState('')

  const items = useMemo(() => data?.items ?? [], [data?.items])
  const collections = data?.collections ?? []
  const order = location.state?.order
  const checkoutSuccess = Boolean(
    location.state?.checkoutSuccess === true && order?.status === 'completed',
  )

  const displayedItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    let next = items.filter((item) => {
      if (section === 'favorites' && !item.is_favorite) return false
      if (section.startsWith('collection:')) {
        const collectionId = Number(section.split(':')[1])
        if (!item.collection_ids.includes(collectionId)) return false
      }
      if (!normalized) return true
      return [item.game?.title, item.game?.developer]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(normalized))
    })

    next = [...next].sort((first, second) => {
      if (sort === 'title') {
        return (first.game?.title || '').localeCompare(second.game?.title || '')
      }
      if (sort === 'oldest') {
        return (
          getTimestamp(first.purchased_at) - getTimestamp(second.purchased_at)
        )
      }
      if (sort === 'size') {
        return (
          Number(second.game?.disk_size_gb || 0) -
          Number(first.game?.disk_size_gb || 0)
        )
      }
      return (
        getTimestamp(second.purchased_at) - getTimestamp(first.purchased_at)
      )
    })

    return next
  }, [items, query, section, sort])

  const selectedCollection = section.startsWith('collection:')
    ? collections.find((item) => item.id === Number(section.split(':')[1]))
    : null

  const handleFavorite = async (item) => {
    setFavoriteBusyId(item.id)
    try {
      await updateLibraryItem(item.id, { is_favorite: !item.is_favorite })
      refresh()
    } finally {
      setFavoriteBusyId(null)
    }
  }

  const handlePostLike = async (post) => {
    const result = await togglePostReaction(post.id)
    updatePost(post.id, result)
  }

  const openCollectionDialog = (collection) => {
    setDialogCollection(collection)
    setDialogError('')
    setDialogOpen(true)
  }

  const closeCollectionDialog = () => {
    if (dialogBusy) return
    setDialogOpen(false)
    setDialogCollection(undefined)
    setDialogError('')
  }

  const saveCollection = async (payload) => {
    setDialogBusy(true)
    setDialogError('')
    try {
      if (dialogCollection) {
        await updateLibraryCollection(dialogCollection.id, payload)
      } else {
        await createLibraryCollection(payload)
      }
      closeCollectionDialog()
      refresh()
    } catch (requestError) {
      setDialogError(
        getMutationError(requestError, 'The collection could not be saved.'),
      )
    } finally {
      setDialogBusy(false)
    }
  }

  const removeCollection = async () => {
    if (!dialogCollection) return
    setDialogBusy(true)
    setDialogError('')
    try {
      await deleteLibraryCollection(dialogCollection.id)
      setSection('all')
      setDialogOpen(false)
      setDialogCollection(undefined)
      refresh()
    } catch (requestError) {
      setDialogError(
        getMutationError(requestError, 'The collection could not be deleted.'),
      )
    } finally {
      setDialogBusy(false)
    }
  }

  return (
    <LibraryFrame
      items={items}
      title="Your library"
      className="library-home-page"
    >
      <header className="library-toolbar">
        <label className="library-search">
          <span className="library-search-icon">
            <SearchIcon />
          </span>
          <span className="library-visually-hidden">Search your library</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your library…"
            disabled={loading || Boolean(error) || items.length === 0}
          />
        </label>
        <div className="library-toolbar-controls">
          <label className="library-sort">
            <span>Sort</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              disabled={loading || Boolean(error) || items.length === 0}
            >
              <option value="recent">Recently purchased</option>
              <option value="oldest">Oldest purchases</option>
              <option value="title">Title A–Z</option>
              <option value="size">Largest install</option>
            </select>
          </label>
          <div className="library-view-switcher">
            <button
              type="button"
              className={view === 'grid' ? 'is-grid' : 'is-list'}
              aria-label={
                view === 'grid' ? 'Switch to list view' : 'Switch to grid view'
              }
              onClick={() =>
                setView((current) => (current === 'grid' ? 'list' : 'grid'))
              }
              disabled={loading || Boolean(error) || items.length === 0}
            >
              <span className="library-view-icon library-view-icon-grid">
                <GridIcon />
              </span>
              <span className="library-view-icon library-view-icon-list">
                <ListIcon />
              </span>
            </button>
          </div>
        </div>
      </header>

      {checkoutSuccess && (
        <section className="library-purchase-banner" role="status">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>Purchase complete</strong>
            <p>Order #{order.id} is complete. Your new games are ready here.</p>
          </div>
        </section>
      )}

      {loading && (
        <CatalogFeedback
          kind="loading"
          title="Loading your library"
          message="Syncing owned games, news, and community activity."
          className="library-feedback"
        />
      )}

      {!loading && error && (
        <CatalogFeedback
          kind="error"
          title="Library unavailable"
          message={error}
          onRetry={retry}
          className="library-feedback"
        />
      )}

      {!loading && !error && items.length === 0 && (
        <section className="library-empty-state">
          <div className="library-empty-art" aria-hidden="true">
            <span>S</span>
          </div>
          <span>YOUR COLLECTION</span>
          <h2>Your library is ready for its first game.</h2>
          <p>
            Complete a demo checkout and every purchased title will appear here
            automatically.
          </p>
          <Link to="/catalog" className="primary-button">
            Explore catalog <span>→</span>
          </Link>
        </section>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <EditorialSection
            title="News"
            linkLabel="All news"
            posts={data.news}
            onLike={handlePostLike}
            onComments={(post) => navigate(`/library/feed#post-${post.id}`)}
          />
          <EditorialSection
            title="Interesting from the community"
            linkLabel="My feed"
            posts={data.community}
            onLike={handlePostLike}
            onComments={(post) => navigate(`/library/feed#post-${post.id}`)}
          />

          <section className="library-collection" id="library-all-games">
            <div className="library-collection-heading">
              <nav
                className="library-collection-tabs"
                aria-label="Library collections"
              >
                <button
                  type="button"
                  className={section === 'all' ? 'active' : ''}
                  onClick={() => setSection('all')}
                >
                  All games
                </button>
                <button
                  type="button"
                  className={section === 'favorites' ? 'active' : ''}
                  onClick={() => setSection('favorites')}
                >
                  Favorites
                </button>
                {collections.map((collection) => (
                  <button
                    type="button"
                    key={collection.id}
                    className={
                      section === `collection:${collection.id}` ? 'active' : ''
                    }
                    onClick={() => setSection(`collection:${collection.id}`)}
                  >
                    {collection.name}
                  </button>
                ))}
                <button
                  type="button"
                  className="library-add-collection"
                  aria-label="Create collection"
                  onClick={() => openCollectionDialog(undefined)}
                >
                  <span className="library-plus-icon" aria-hidden="true" />
                </button>
              </nav>
              <div className="library-collection-summary">
                {selectedCollection && (
                  <button
                    type="button"
                    onClick={() => openCollectionDialog(selectedCollection)}
                  >
                    Edit
                  </button>
                )}
                <span>
                  {displayedItems.length}{' '}
                  {displayedItems.length === 1 ? 'game' : 'games'}
                </span>
              </div>
            </div>

            {displayedItems.length === 0 ? (
              <section className="library-search-empty">
                <div aria-hidden="true">⌕</div>
                <h2>No games in this view</h2>
                <p>Try another search or choose a different collection.</p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    setSection('all')
                  }}
                >
                  Show all games
                </button>
              </section>
            ) : view === 'grid' ? (
              <div className="library-games-grid">
                {displayedItems.map((item) => (
                  <LibraryGridCard
                    item={item}
                    key={item.id}
                    favoriteBusy={favoriteBusyId === item.id}
                    onFavorite={handleFavorite}
                  />
                ))}
              </div>
            ) : (
              <div className="library-games-list">
                {displayedItems.map((item) => (
                  <LibraryListCard
                    item={item}
                    key={item.id}
                    favoriteBusy={favoriteBusyId === item.id}
                    onFavorite={handleFavorite}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {dialogOpen && (
        <CollectionDialog
          key={dialogCollection?.id ?? 'new'}
          items={items}
          collection={dialogCollection}
          submitting={dialogBusy}
          error={dialogError}
          onClose={closeCollectionDialog}
          onSave={saveCollection}
          onDelete={removeCollection}
        />
      )}
    </LibraryFrame>
  )
}

export default LibraryPage
