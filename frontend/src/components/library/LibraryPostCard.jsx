import { useState } from 'react'
import { Link } from 'react-router-dom'

const hideBrokenImage = (event) => {
  event.currentTarget.hidden = true
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const formatDate = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Recently' : dateFormatter.format(date)
}

function AuthorAvatar({ author }) {
  const name = author?.username?.trim() || 'Steamnt player'
  return (
    <span className="library-post-avatar" aria-hidden="true">
      <span>{name.charAt(0).toUpperCase()}</span>
      {author?.avatar && (
        <img src={author.avatar} alt="" onError={hideBrokenImage} />
      )}
    </span>
  )
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 5.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.3 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
    </svg>
  )
}

function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5h14v11H9l-4 3V5Z" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 13v6h14v-6" />
    </svg>
  )
}

function LibraryPostCard({
  post,
  compact = false,
  onLike,
  onComments,
  commentsOpen = false,
  children,
}) {
  const [likeBusy, setLikeBusy] = useState(false)
  const [shared, setShared] = useState(false)
  const authorName = post.author?.username?.trim() || 'Steamnt player'
  const hasMedia = Boolean(post.media)

  const handleLike = async () => {
    if (!onLike || likeBusy) return
    setLikeBusy(true)
    try {
      await onLike(post)
    } finally {
      setLikeBusy(false)
    }
  }

  const handleShare = async () => {
    const url = `${window.location.origin}/library/feed#post-${post.id}`
    try {
      if (navigator.share) {
        await navigator.share({ title: post.title, text: post.body, url })
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
      }
      setShared(true)
    } catch {
      setShared(false)
    }
  }

  return (
    <article
      className={`library-post-card${compact ? ' is-compact' : ''}`}
      id={`post-${post.id}`}
    >
      <header className="library-post-header">
        <div className="library-post-author">
          <AuthorAvatar author={post.author} />
          <div>
            <strong>{authorName}</strong>
            <time dateTime={post.created_at || undefined}>
              {formatDate(post.created_at)}
            </time>
          </div>
        </div>
        <span className="library-post-kind">{post.kind}</span>
      </header>

      {hasMedia && (
        <div className="library-post-media">
          <span aria-hidden="true">S</span>
          <img
            src={post.media}
            alt=""
            loading="lazy"
            decoding="async"
            onError={hideBrokenImage}
          />
          {post.kind === 'video' && (
            <span className="library-post-play" aria-label="Video preview">
              ▶
            </span>
          )}
        </div>
      )}

      <div className="library-post-copy">
        {post.game && (
          <Link className="library-post-game" to={`/games/${post.game.id}`}>
            {post.game.title}
          </Link>
        )}
        <h3>{post.title}</h3>
        {post.body && <p>{post.body}</p>}
      </div>

      <footer className="library-post-actions">
        <button
          type="button"
          className={post.is_liked ? 'active' : ''}
          aria-pressed={post.is_liked}
          onClick={handleLike}
          disabled={likeBusy}
        >
          <HeartIcon />
          <span>{post.like_count}</span>
        </button>
        <button
          type="button"
          className={commentsOpen ? 'active' : ''}
          aria-expanded={commentsOpen}
          onClick={() => onComments?.(post)}
        >
          <CommentIcon />
          <span>{post.comment_count}</span>
        </button>
        <button type="button" onClick={handleShare}>
          <ShareIcon />
          <span>{shared ? 'Copied' : 'Share'}</span>
        </button>
      </footer>

      {children}
    </article>
  )
}

export default LibraryPostCard
