import { useEffect, useState } from 'react'

import {
  createPostComment,
  getPostComments,
  togglePostReaction,
} from '../api/library'
import CatalogFeedback from '../components/CatalogFeedback'
import LibraryFrame from '../components/library/LibraryFrame'
import LibraryPostCard from '../components/library/LibraryPostCard'
import useLibrary from '../hooks/useLibrary'
import { useLibraryFeed } from '../hooks/useLibraryExperience'

const tabs = [
  ['following', 'Following'],
  ['library', 'From library'],
  ['recommended', 'Recommended'],
]
const kinds = [
  ['all', 'All sections'],
  ['forum', 'Forum'],
  ['screenshot', 'Screenshots'],
  ['video', 'Video'],
  ['guide', 'Guides'],
  ['news', 'News'],
  ['community', 'Community'],
]

function CommentThread({ post, onCreated }) {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    getPostComments(post.id, { signal: controller.signal })
      .then((items) => {
        if (!controller.signal.aborted) {
          setComments(items)
          setLoading(false)
        }
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return
        setError(
          requestError.response?.data?.detail ||
            'Comments could not be loaded.',
        )
        setLoading(false)
      })
    return () => controller.abort()
  }, [post.id])

  const submit = async (event) => {
    event.preventDefault()
    if (!body.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const comment = await createPostComment(post.id, body.trim())
      setComments((current) => [...current, comment])
      setBody('')
      onCreated()
    } catch (requestError) {
      setError(
        requestError.response?.data?.body?.[0] ||
          requestError.response?.data?.detail ||
          'Your comment could not be published.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section
      className="library-comments"
      aria-label={`Comments on ${post.title}`}
    >
      {loading && <p>Loading comments…</p>}
      {!loading && !comments.length && <p>Be the first to comment.</p>}
      {comments.map((comment) => (
        <article key={comment.id}>
          <strong>{comment.author?.username || 'Steamnt player'}</strong>
          <p>{comment.body}</p>
        </article>
      ))}
      <form onSubmit={submit}>
        <input
          value={body}
          maxLength={1200}
          placeholder="Write a comment…"
          aria-label="Write a comment"
          onChange={(event) => setBody(event.target.value)}
        />
        <button type="submit" disabled={submitting || !body.trim()}>
          {submitting ? 'Posting…' : 'Post'}
        </button>
      </form>
      {error && <small role="alert">{error}</small>}
    </section>
  )
}

function LibraryFeedPage() {
  const sidebar = useLibrary()
  const [tab, setTab] = useState('recommended')
  const [kind, setKind] = useState('all')
  const [ordering, setOrdering] = useState('popular')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [openPostId, setOpenPostId] = useState(null)
  const { data, loading, error, retry, updatePost } = useLibraryFeed({
    tab,
    kind,
    search,
    ordering,
  })

  const like = async (post) =>
    updatePost(post.id, await togglePostReaction(post.id))
  const commentCreated = (post) =>
    updatePost(post.id, { comment_count: post.comment_count + 1 })

  return (
    <LibraryFrame
      items={sidebar.items}
      title="My library feed"
      className="library-feed-page"
    >
      <div className="library-feed-heading">
        <span>←</span>
        <nav aria-label="Feed sources">
          {tabs.map(([id, label]) => (
            <button
              type="button"
              key={id}
              className={tab === id ? 'active' : ''}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="library-feed-layout">
        <section className="library-feed-stream" aria-live="polite">
          {loading && (
            <CatalogFeedback
              kind="loading"
              title="Loading your feed"
              message="Collecting posts from the Steamnt community."
              className="library-feedback"
            />
          )}
          {!loading && error && (
            <CatalogFeedback
              kind="error"
              title="Feed unavailable"
              message={error}
              onRetry={retry}
              className="library-feedback"
            />
          )}
          {!loading && !error && !data?.items.length && (
            <section className="library-content-empty library-feed-empty">
              <span className="library-feed-empty-mark" aria-hidden="true">
                ✦
              </span>
              <small>YOUR PERSONAL FEED</small>
              <h2>No posts found</h2>
              <p>
                Try another source or clear the active section and search
                filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setTab('recommended')
                  setKind('all')
                  setSearch('')
                  setSearchInput('')
                }}
              >
                Reset feed
              </button>
            </section>
          )}
          {!loading &&
            !error &&
            data?.items.map((post) => (
              <LibraryPostCard
                post={post}
                key={post.id}
                onLike={like}
                commentsOpen={openPostId === post.id}
                onComments={() =>
                  setOpenPostId((current) =>
                    current === post.id ? null : post.id,
                  )
                }
              >
                {openPostId === post.id && (
                  <CommentThread
                    post={post}
                    onCreated={() => commentCreated(post)}
                  />
                )}
              </LibraryPostCard>
            ))}
        </section>

        <aside className="library-feed-filters">
          <label>
            <span>Sort by</span>
            <select
              value={ordering}
              onChange={(event) => setOrdering(event.target.value)}
            >
              <option value="popular">Popular</option>
              <option value="latest">Latest</option>
            </select>
          </label>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              setSearch(searchInput.trim())
            }}
          >
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search all sections"
              aria-label="Search feed"
            />
            <button type="submit">Search</button>
          </form>
          <nav aria-label="Feed sections">
            {kinds.map(([id, label]) => (
              <button
                type="button"
                key={id}
                className={kind === id ? 'active' : ''}
                onClick={() => setKind(id)}
              >
                {label}
              </button>
            ))}
          </nav>
        </aside>
      </div>
    </LibraryFrame>
  )
}

export default LibraryFeedPage
