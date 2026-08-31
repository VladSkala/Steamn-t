import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import {
  deleteGameReview,
  saveGameReview,
  toggleGameWishlist,
  togglePostReaction,
  updateLibraryItem,
} from '../api/library'
import CatalogFeedback from '../components/CatalogFeedback'
import LibraryFrame from '../components/library/LibraryFrame'
import LibraryPostCard from '../components/library/LibraryPostCard'
import useLibrary from '../hooks/useLibrary'
import { useLibraryGame } from '../hooks/useLibraryExperience'

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

function FriendGroup({ title, users }) {
  return (
    <section className="library-friend-group">
      <h3>
        {title}: {users.length}
      </h3>
      {users.length ? (
        <div className="library-friend-list">
          {users.map((user) => (
            <span key={user.id} aria-label={user.username}>
              <span className="library-friend-avatar" aria-hidden="true">
                <b>{user.username.charAt(0).toUpperCase()}</b>
                {user.avatar && (
                  <img
                    src={user.avatar}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.hidden = true
                    }}
                  />
                )}
              </span>
              {user.username}
            </span>
          ))}
        </div>
      ) : (
        <p>No followed players here yet.</p>
      )}
    </section>
  )
}

function ReviewEditor({ gameId, review, onSaved }) {
  const [rating, setRating] = useState(review?.rating || 5)
  const [body, setBody] = useState(review?.body || '')
  const [editing, setEditing] = useState(!review)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await saveGameReview(gameId, { rating: Number(rating), body })
      setEditing(false)
      onSaved()
    } catch (requestError) {
      setError(
        requestError.response?.data?.body?.[0] ||
          requestError.response?.data?.detail ||
          'Your review could not be saved.',
      )
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    setError('')
    try {
      await deleteGameReview(gameId)
      setBody('')
      setRating(5)
      setEditing(true)
      onSaved()
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          'Your review could not be deleted.',
      )
    } finally {
      setBusy(false)
    }
  }

  if (review && !editing) {
    return (
      <div className="library-review-saved">
        <span>
          {'★'.repeat(review.rating)}
          {'☆'.repeat(5 - review.rating)}
        </span>
        <p>{review.body}</p>
        <div>
          <button type="button" onClick={() => setEditing(true)}>
            Edit review
          </button>
          <button
            type="button"
            className="danger"
            disabled={busy}
            onClick={remove}
          >
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
        {error && <small role="alert">{error}</small>}
      </div>
    )
  }

  return (
    <form className="library-review-form" onSubmit={submit}>
      <label>
        <span>Rating</span>
        <select
          value={rating}
          onChange={(event) => setRating(event.target.value)}
        >
          {[5, 4, 3, 2, 1].map((value) => (
            <option value={value} key={value}>
              {value} / 5
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Your review</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={4000}
          placeholder="Share what you think about this game…"
        />
      </label>
      {error && <small role="alert">{error}</small>}
      <div>
        {review && (
          <button type="button" onClick={() => setEditing(false)}>
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="primary"
          disabled={busy || !body.trim()}
        >
          {busy ? 'Saving…' : 'Publish review'}
        </button>
      </div>
    </form>
  )
}

function LibraryGamePage() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const sidebar = useLibrary()
  const { data, loading, error, retry, refresh, updatePost } =
    useLibraryGame(gameId)
  const [favoriteBusy, setFavoriteBusy] = useState(false)
  const [wishlistBusy, setWishlistBusy] = useState(false)

  const likePost = async (post) => {
    updatePost(post.id, await togglePostReaction(post.id))
  }

  const toggleFavorite = async () => {
    if (!data?.library_item || favoriteBusy) return
    setFavoriteBusy(true)
    try {
      await updateLibraryItem(data.library_item.id, {
        is_favorite: !data.library_item.is_favorite,
      })
      refresh()
      sidebar.retry()
    } finally {
      setFavoriteBusy(false)
    }
  }

  const toggleWishlist = async () => {
    if (wishlistBusy) return
    setWishlistBusy(true)
    try {
      await toggleGameWishlist(gameId)
      refresh()
    } finally {
      setWishlistBusy(false)
    }
  }

  const frame = (children, title = 'Library game') => (
    <LibraryFrame items={sidebar.items} activeGameId={gameId} title={title}>
      {children}
    </LibraryFrame>
  )

  if (loading) {
    return frame(
      <CatalogFeedback
        kind="loading"
        title="Loading your game"
        message="Fetching ownership, news, and community activity."
        className="library-feedback"
      />,
      'Loading library game',
    )
  }

  if (error) {
    return frame(
      <>
        <CatalogFeedback
          kind={error === 'not-found' ? 'empty' : 'error'}
          title={
            error === 'not-found'
              ? 'Game not in your library'
              : 'Game unavailable'
          }
          message={
            error === 'not-found'
              ? 'Purchase this game before opening its library page.'
              : error
          }
          onRetry={error === 'not-found' ? undefined : retry}
          className="library-feedback"
        />
        <Link className="library-back-link" to="/library">
          ← Back to library
        </Link>
      </>,
    )
  }

  const game = data.game
  const item = data.library_item
  const heroSource = game.hero_image_url || game.cover
  const heroStyle = heroSource
    ? { backgroundImage: `url("${heroSource}")` }
    : undefined
  const heroMonogram = game.title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()

  return (
    <LibraryFrame
      items={sidebar.items}
      activeGameId={game.id}
      title={`${game.title} library page`}
      className="library-owned-game-page"
    >
      <section
        className={`library-game-hero ${heroSource ? 'has-artwork' : 'is-fallback'}`}
        style={heroStyle}
      >
        {!heroSource && (
          <div className="library-game-hero-fallback" aria-hidden="true">
            <span>{heroMonogram || 'S'}</span>
          </div>
        )}
        <div className="library-game-hero-overlay" />
        <div className="library-game-hero-content">
          <Link to="/library" className="library-game-back">
            ← Library
          </Link>
          <h2>{game.title}</h2>
          <div className="library-game-hero-meta">
            {game.download_url ? (
              <a
                className="library-download-button"
                href={game.download_url}
                target="_blank"
                rel="noreferrer"
              >
                Download
              </a>
            ) : (
              <button
                type="button"
                className="library-download-button"
                disabled
              >
                Download unavailable
              </button>
            )}
            <span>
              <small>Disk size</small>
              <strong>
                {game.disk_size_gb
                  ? `${Number(game.disk_size_gb).toLocaleString()} GB`
                  : 'Not specified'}
              </strong>
            </span>
          </div>
        </div>
        <div className="library-game-hero-actions">
          <button
            type="button"
            className={item.is_favorite ? 'active' : ''}
            aria-label="Toggle favorite"
            aria-pressed={item.is_favorite}
            disabled={favoriteBusy}
            onClick={toggleFavorite}
          >
            <StarIcon filled={item.is_favorite} />
          </button>
          <button
            type="button"
            className="text-action"
            aria-pressed={data.is_wishlisted}
            disabled={wishlistBusy}
            onClick={toggleWishlist}
          >
            {data.is_wishlisted ? 'Wishlisted' : 'Wishlist'}
          </button>
        </div>
      </section>

      <nav className="library-game-tabs" aria-label="Game page sections">
        <Link to={`/games/${game.id}`}>Store page</Link>
        <a href="#library-game-details">Game details</a>
        <span>{game.developer}</span>
        <a href="#library-game-community">Community</a>
      </nav>

      <section className="library-review-section">
        <div className="library-review-main">
          <div className="library-section-heading">
            <h2>My review</h2>
          </div>
          <ReviewEditor
            key={data.review?.updated_at || 'new'}
            gameId={game.id}
            review={data.review}
            onSaved={refresh}
          />
        </div>
        <aside className="library-friends-panel">
          <FriendGroup
            title="Followed players want this"
            users={data.friends_want}
          />
          <FriendGroup
            title="Followed players own this"
            users={data.friends_own}
          />
        </aside>
      </section>

      <section className="library-game-details" id="library-game-details">
        <div>
          <span>ABOUT THIS GAME</span>
          <h2>{game.title}</h2>
          <p>{game.description || 'No description is available yet.'}</p>
        </div>
        <dl>
          <div>
            <dt>Developer</dt>
            <dd>{game.developer}</dd>
          </div>
          <div>
            <dt>Released</dt>
            <dd>{game.release_date || 'Not specified'}</dd>
          </div>
          <div>
            <dt>Purchased for</dt>
            <dd>${item.price_at_purchase}</dd>
          </div>
        </dl>
      </section>

      {data.news.length > 0 && (
        <section className="library-game-news">
          <div className="library-section-heading">
            <h2>What’s new</h2>
            <Link to="/library/feed">All news →</Link>
          </div>
          <div className="library-game-news-list">
            {data.news.map((post) => (
              <LibraryPostCard
                post={post}
                key={post.id}
                onLike={likePost}
                onComments={() => navigate(`/library/feed#post-${post.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      <section className="library-game-community" id="library-game-community">
        <div className="library-section-heading">
          <h2>Interesting from the community</h2>
          <Link to="/library/feed">My feed →</Link>
        </div>
        {data.community.length ? (
          <div className="library-community-grid">
            {data.community.map((post) => (
              <LibraryPostCard
                post={post}
                compact
                key={post.id}
                onLike={likePost}
                onComments={() => navigate(`/library/feed#post-${post.id}`)}
              />
            ))}
          </div>
        ) : (
          <p className="library-content-empty">
            No published community posts for this game yet.
          </p>
        )}
      </section>
    </LibraryFrame>
  )
}

export default LibraryGamePage
