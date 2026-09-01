import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'

import CatalogFeedback from '../components/CatalogFeedback'
import {
  getLibrary,
  getLibraryFeed,
  getLibraryGame,
  getPostComments,
} from '../api/library'
import { useAuth } from '../hooks/useAuth'
import useProfile from '../hooks/useProfile'

const ACTIVITY_METRICS = [
  { key: 'library_games', label: 'Games', icon: '▦' },
  { key: 'favorite_games', label: 'Favorites', icon: '★' },
  { key: 'wishlist_games', label: 'Wishlist', icon: '♡' },
  { key: 'reviews', label: 'Reviews', icon: '✎' },
  { key: 'posts', label: 'Posts', icon: '▣' },
]

const isCanceledRequest = (error) =>
  error?.code === 'ERR_CANCELED' ||
  error?.name === 'CanceledError' ||
  error?.name === 'AbortError'

const toCount = (value) => {
  const count = Number(value)
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
}

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

const formatNumber = (value) =>
  new Intl.NumberFormat('en-US').format(toCount(value))

const getUsername = (profile, user) =>
  profile?.username || user?.username || 'player'

const getFullName = (profile, user) => {
  const firstName = profile?.first_name || user?.first_name || ''
  const lastName = profile?.last_name || user?.last_name || ''
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()
  const displayName = String(
    profile?.display_name || user?.display_name || '',
  ).trim()
  const username = getUsername(profile, user)

  if (displayName && displayName.toLowerCase() !== username.toLowerCase()) {
    return displayName
  }

  return fullName && fullName.toLowerCase() !== username.toLowerCase()
    ? fullName
    : ''
}

const getMedia = (post) => post?.media || post?.game?.cover || null

const isVideoMedia = (value) =>
  typeof value === 'string' && /\.(mp4|webm|ogg)(?:$|[?#])/i.test(value)

const formatApiError = (error) => {
  const data = error?.response?.data
  if (typeof data === 'string' && data.trim()) return data
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return 'Could not save your profile. Please try again.'
  }

  const message = Object.entries(data)
    .flatMap(([field, value]) => {
      const messages = Array.isArray(value) ? value : [value]
      const label = field === 'non_field_errors' ? 'Profile' : field
      return messages.map((item) => `${label}: ${String(item)}`)
    })
    .join(' ')

  return message || 'Could not save your profile. Please try again.'
}

async function loadReviewPreviews(items, reviewCount, signal) {
  const targetCount = Math.min(toCount(reviewCount), 4)
  if (!targetCount) return []

  const reviews = []
  const batchSize = 6

  for (
    let index = 0;
    index < items.length && reviews.length < targetCount;
    index += batchSize
  ) {
    if (signal.aborted) return []

    const requests = items.slice(index, index + batchSize).map((item) => {
      const gameId = item?.game?.id
      return gameId ? getLibraryGame(gameId, { signal }) : Promise.resolve(null)
    })
    const results = await Promise.allSettled(requests)

    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value?.review) {
        reviews.push(result.value)
      }
    })
  }

  return reviews.slice(0, 4)
}

async function loadRecentComments(posts, signal) {
  const postsWithComments = posts
    .filter((post) => toCount(post?.comment_count) > 0)
    .slice(0, 6)

  if (!postsWithComments.length) return []

  const results = await Promise.allSettled(
    postsWithComments.map(async (post) => {
      const items = await getPostComments(post.id, { signal })
      return items.map((comment) => ({
        ...comment,
        postId: post.id,
        postTitle: post.title || post.game?.title || 'Post',
      }))
    }),
  )

  if (signal.aborted) return []

  return results
    .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
    .sort(
      (left, right) =>
        new Date(right.created_at).getTime() -
        new Date(left.created_at).getTime(),
    )
    .slice(0, 5)
}

function PostMedia({ post, className = '', controls = false }) {
  const media = getMedia(post)
  if (!media) return null

  if (isVideoMedia(media)) {
    return (
      <video
        className={className}
        src={media}
        controls={controls}
        muted={!controls}
        preload="metadata"
        playsInline
      />
    )
  }

  return <img className={className} src={media} alt="" loading="lazy" />
}

function ProfileEditModal({ profile, onClose, onSaved, onSave }) {
  const [form, setForm] = useState({
    username: profile?.username || '',
    email: profile?.email || '',
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    avatar: null,
  })
  const [preview, setPreview] = useState(profile?.avatar || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const avatarInputRef = useRef(null)
  const dialogRef = useRef(null)
  const firstFieldRef = useRef(null)
  const savingRef = useRef(false)

  useEffect(() => {
    savingRef.current = saving
  }, [saving])

  useEffect(() => {
    if (!preview?.startsWith('blob:')) return undefined
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const previousActiveElement = document.activeElement
    const dialog = dialogRef.current
    const focusFrame = window.requestAnimationFrame(() => {
      firstFieldRef.current?.focus()
    })

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !savingRef.current) {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab' || !dialog) return

      const focusable = Array.from(
        dialog.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (!focusable.length) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      if (previousActiveElement instanceof HTMLElement) {
        previousActiveElement.focus()
      }
    }
  }, [onClose])

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setError('')
  }

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Your avatar must be 5 MB or smaller.')
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPG, PNG, or WebP image.')
      return
    }

    setForm((current) => ({
      ...current,
      avatar: file,
      remove_avatar: false,
    }))
    setPreview(URL.createObjectURL(file))
    setError('')
  }

  const clearAvatar = () => {
    setForm((current) => ({
      ...current,
      avatar: null,
      remove_avatar: true,
    }))
    setPreview('')
    setError('')
    if (avatarInputRef.current) avatarInputRef.current.value = ''
  }

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const payload = {
        username: form.username.trim(),
        email: form.email.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
      }
      if (typeof File !== 'undefined' && form.avatar instanceof File) {
        payload.avatar = form.avatar
      } else if (form.remove_avatar) {
        payload.avatar = null
      }

      await onSave(payload)
      await onSaved()
      onClose()
    } catch (requestError) {
      setError(formatApiError(requestError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="profile-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose()
      }}
    >
      <section
        ref={dialogRef}
        className="profile-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-edit-title"
        aria-describedby={error ? 'profile-edit-error' : undefined}
        tabIndex={-1}
      >
        <div className="profile-modal-head">
          <div>
            <span className="section-kicker">PROFILE</span>
            <h2 id="profile-edit-title">Edit profile</h2>
          </div>
          <button
            type="button"
            className="profile-modal-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Close profile editor"
          >
            ×
          </button>
        </div>
        <form className="profile-edit-form" onSubmit={submit}>
          <div className="profile-edit-avatar-row">
            <div className="profile-edit-avatar">
              {preview ? (
                <img src={preview} alt="Profile preview" />
              ) : (
                <span>
                  {(profile?.username || 'P').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <strong>Avatar</strong>
              <p>JPG, PNG, or WebP, up to 5 MB.</p>
              <div className="profile-edit-avatar-actions">
                <label className="profile-modal-button profile-upload-button">
                  Choose image
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleAvatarChange}
                  />
                </label>
                {(preview || profile?.avatar) && (
                  <button
                    type="button"
                    className="profile-remove-button"
                    onClick={clearAvatar}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="profile-form-grid">
            <label>
              Username
              <input
                ref={firstFieldRef}
                name="username"
                autoComplete="username"
                value={form.username}
                onChange={(event) => update('username', event.target.value)}
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                name="email"
                autoComplete="email"
                value={form.email}
                onChange={(event) => update('email', event.target.value)}
                required
              />
            </label>
            <label>
              First name
              <input
                name="firstName"
                autoComplete="given-name"
                value={form.first_name}
                onChange={(event) => update('first_name', event.target.value)}
              />
            </label>
            <label>
              Last name
              <input
                name="lastName"
                autoComplete="family-name"
                value={form.last_name}
                onChange={(event) => update('last_name', event.target.value)}
              />
            </label>
          </div>
          {error && (
            <div
              id="profile-edit-error"
              className="profile-form-error"
              role="alert"
            >
              {error}
            </div>
          )}
          <div className="profile-form-actions">
            <button
              type="button"
              className="profile-modal-button secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="profile-modal-button primary"
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function GalleryPostCard({ post, compact = false }) {
  const media = getMedia(post)

  return (
    <article className={`profile-post-card${compact ? ' compact' : ''}`}>
      <div className="profile-post-meta">
        <span className="profile-game-chip">
          {post?.game?.title || 'Community'}
        </span>
        <span>{formatDate(post?.created_at)}</span>
      </div>
      {post?.title && <h3>{post.title}</h3>}
      {post?.body && <p>{post.body}</p>}
      {media && (
        <PostMedia
          post={post}
          className="profile-post-image"
          controls={post?.kind === 'video'}
        />
      )}
      <div className="profile-post-actions" aria-label="Post activity">
        <span>♡ {formatNumber(post?.like_count)}</span>
        <span>▢ {formatNumber(post?.comment_count)}</span>
      </div>
    </article>
  )
}

function ReviewCard({ item }) {
  const review = item?.review
  if (!review) return null

  const rating = Math.min(
    5,
    Math.max(0, Math.round(Number(review.rating) || 0)),
  )

  return (
    <article className="profile-review-card">
      <div className="profile-review-media">
        {item.game?.cover ? (
          <img src={item.game.cover} alt="" loading="lazy" />
        ) : (
          <div />
        )}
      </div>
      <div className="profile-review-body">
        <div className="profile-post-meta">
          <span className="profile-game-chip">
            {item.game?.title || 'Game'}
          </span>
          <span>{formatDate(review.created_at)}</span>
        </div>
        <h3>{item.game?.title}</h3>
        <div className="profile-stars" aria-label={`Rating ${rating} out of 5`}>
          {'★'.repeat(rating)}
          {'☆'.repeat(5 - rating)}
        </div>
        <p>{review.body}</p>
      </div>
    </article>
  )
}

function ProfilePage() {
  const { user, reloadProfile } = useAuth()
  const {
    profile: fetchedProfile,
    loading: profileLoading,
    error: profileError,
    reload,
    save,
  } = useProfile()
  const [library, setLibrary] = useState({
    items: [],
    loading: true,
    error: null,
  })
  const [posts, setPosts] = useState({
    all: [],
    screenshot: [],
    video: [],
    guide: [],
    community: [],
    loading: true,
    error: null,
  })
  const [reviews, setReviews] = useState({
    items: [],
    loading: true,
    error: null,
  })
  const [comments, setComments] = useState({
    items: [],
    loading: true,
    error: null,
  })
  const [modalOpen, setModalOpen] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const successTimerRef = useRef(null)

  const profile = fetchedProfile || user
  const stats = useMemo(() => fetchedProfile?.stats || {}, [fetchedProfile])
  const reviewCount = toCount(stats.reviews)

  useEffect(() => {
    if (!fetchedProfile?.id) return undefined

    const controller = new AbortController()

    const loadProfileContent = async () => {
      const [libraryResult, feedResult] = await Promise.allSettled([
        getLibrary({ signal: controller.signal }),
        getLibraryFeed(
          {
            tab: 'mine',
            kind: 'all',
            ordering: 'latest',
            search: '',
          },
          { signal: controller.signal },
        ),
      ])

      if (controller.signal.aborted) return

      const libraryItems =
        libraryResult.status === 'fulfilled' ? libraryResult.value : []
      const activityPosts =
        feedResult.status === 'fulfilled' ? feedResult.value.items : []

      setLibrary(
        libraryResult.status === 'fulfilled'
          ? { items: libraryItems, loading: false, error: null }
          : {
              items: [],
              loading: false,
              error: 'Your game collection could not be loaded.',
            },
      )
      setPosts(
        feedResult.status === 'fulfilled'
          ? {
              all: activityPosts,
              screenshot: activityPosts.filter(
                (post) => post.kind === 'screenshot',
              ),
              video: activityPosts.filter((post) => post.kind === 'video'),
              guide: activityPosts.filter((post) => post.kind === 'guide'),
              community: activityPosts.filter(
                (post) => post.kind === 'community' || post.kind === 'news',
              ),
              loading: false,
              error: null,
            }
          : {
              all: [],
              screenshot: [],
              video: [],
              guide: [],
              community: [],
              loading: false,
              error: 'Your profile activity could not be loaded.',
            },
      )

      const [reviewItems, recentComments] = await Promise.all([
        libraryResult.status === 'fulfilled'
          ? loadReviewPreviews(libraryItems, reviewCount, controller.signal)
          : Promise.resolve([]),
        feedResult.status === 'fulfilled'
          ? loadRecentComments(activityPosts, controller.signal)
          : Promise.resolve([]),
      ])

      if (controller.signal.aborted) return

      setReviews({
        items: reviewItems,
        loading: false,
        error:
          libraryResult.status === 'fulfilled'
            ? null
            : 'Your review previews could not be loaded.',
      })
      setComments({
        items: recentComments,
        loading: false,
        error:
          feedResult.status === 'fulfilled'
            ? null
            : 'Comments on your posts could not be loaded.',
      })
    }

    loadProfileContent().catch((error) => {
      if (controller.signal.aborted || isCanceledRequest(error)) return
      setLibrary({
        items: [],
        loading: false,
        error: 'Your game collection could not be loaded.',
      })
      setPosts((current) => ({
        ...current,
        loading: false,
        error: 'Your profile activity could not be loaded.',
      }))
      setReviews({
        items: [],
        loading: false,
        error: 'Your review previews could not be loaded.',
      })
      setComments({
        items: [],
        loading: false,
        error: 'Comments on your posts could not be loaded.',
      })
    })

    return () => controller.abort()
  }, [fetchedProfile?.id, reviewCount])

  useEffect(
    () => () => {
      if (successTimerRef.current) {
        window.clearTimeout(successTimerRef.current)
      }
    },
    [],
  )

  const openModal = useCallback(() => setModalOpen(true), [])
  const closeModal = useCallback(() => setModalOpen(false), [])

  const handleSaved = useCallback(async () => {
    await reloadProfile()
    setSuccessMessage('Your profile was updated successfully.')
    if (successTimerRef.current) {
      window.clearTimeout(successTimerRef.current)
    }
    successTimerRef.current = window.setTimeout(
      () => setSuccessMessage(''),
      3000,
    )
  }, [reloadProfile])

  const username = getUsername(profile, user)
  const fullName = getFullName(profile, user)
  const libraryPreview = library.items.slice(0, 4)
  const coverImage =
    libraryPreview[0]?.game?.hero_image_url ||
    libraryPreview[0]?.game?.cover ||
    ''
  const completedProfileFields = [
    profile?.username,
    profile?.email,
    profile?.first_name || profile?.last_name,
    profile?.avatar,
  ].filter(Boolean).length
  const completion = Math.round((completedProfileFields / 4) * 100)

  const sideSections = useMemo(
    () => [
      ['Activity', '#activity', null],
      ['Games', '#games', stats.library_games],
      ['Reviews', '#reviews', stats.reviews],
      ['Screenshots', '#screenshots', posts.screenshot.length],
      ['Videos', '#videos', posts.video.length],
      ['Posts', '#community-posts', stats.posts],
      ['Guides', '#guides', posts.guide.length],
      ['Comments', '#comments', comments.items.length],
    ],
    [comments.items.length, posts, stats],
  )

  if (profileLoading && !fetchedProfile) {
    return (
      <div className="profile-page profile-feedback-page">
        <CatalogFeedback
          kind="loading"
          title="Loading profile"
          message="Preparing your profile and activity."
        />
      </div>
    )
  }

  if (profileError) {
    return (
      <div className="profile-page profile-feedback-page">
        <CatalogFeedback
          kind="error"
          title="Profile unavailable"
          message={profileError}
          onRetry={reload}
        />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="profile-page profile-feedback-page">
        <CatalogFeedback
          kind="error"
          title="Profile unavailable"
          message="Your profile could not be loaded."
          onRetry={reload}
        />
      </div>
    )
  }

  return (
    <div className="profile-page">
      <section className="profile-hero" id="profile-overview">
        <div
          className="profile-cover"
          style={
            coverImage
              ? {
                  backgroundImage: `linear-gradient(180deg, rgba(1, 35, 44, .06), rgba(1, 22, 29, .28)), url(${coverImage})`,
                }
              : undefined
          }
        />
        <div className="profile-hero-info">
          <div className="profile-avatar-wrap">
            <div className="profile-avatar">
              {profile.avatar ? (
                <img src={profile.avatar} alt="" />
              ) : (
                <span>{username.charAt(0).toUpperCase()}</span>
              )}
            </div>
          </div>
          <div className="profile-user-block">
            <div className="profile-user-line">
              <h1>{username}</h1>
            </div>
            {fullName && <span className="profile-full-name">{fullName}</span>}
            <span className="profile-member-since">
              Member since {formatDate(profile.created_at)}
            </span>
          </div>
          <button
            type="button"
            className="profile-edit-button"
            onClick={openModal}
          >
            <span aria-hidden="true">✎</span>
            <span>Edit profile</span>
          </button>
        </div>
      </section>

      {successMessage && (
        <div className="profile-success" role="status">
          ✓ {successMessage}
        </div>
      )}

      <div className="profile-layout">
        <main className="profile-main">
          <section className="profile-section" id="activity">
            <div className="profile-section-title">
              <h2>Profile activity</h2>
            </div>
            <div className="profile-activity-grid">
              {ACTIVITY_METRICS.map((metric) => (
                <div className="profile-activity-card" key={metric.key}>
                  <span className="profile-activity-icon" aria-hidden="true">
                    {metric.icon}
                  </span>
                  <strong>{formatNumber(stats[metric.key])}</strong>
                  <span>{metric.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="profile-section" id="games">
            <div className="profile-section-title">
              <h2>Game collection</h2>
            </div>
            <div className="profile-stat-row">
              <div>
                <strong>{formatNumber(stats.library_games)}</strong>
                <span>Games</span>
              </div>
              <div>
                <strong>{formatNumber(stats.favorite_games)}</strong>
                <span>Favorites</span>
              </div>
              <div>
                <strong>{formatNumber(stats.wishlist_games)}</strong>
                <span>Wishlist</span>
              </div>
            </div>
            {library.loading ? (
              <div className="profile-inline-state">Loading collection…</div>
            ) : library.error ? (
              <div className="profile-inline-state profile-inline-error">
                {library.error}
              </div>
            ) : library.items.length === 0 ? (
              <div className="profile-inline-state">
                Your library does not have any games yet.
              </div>
            ) : (
              <div className="profile-game-grid">
                {libraryPreview.map((item) => (
                  <Link
                    to={`/library/games/${item.game?.id}`}
                    className="profile-game-card"
                    key={item.id}
                    aria-label={`Open ${item.game?.title || 'library game'}`}
                  >
                    <div className="profile-game-cover">
                      {item.game?.cover ? (
                        <img src={item.game.cover} alt="" loading="lazy" />
                      ) : (
                        <span>S</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="profile-section" id="reviews">
            <div className="profile-section-title">
              <h2>
                Reviews <span>{formatNumber(stats.reviews)}</span>
              </h2>
            </div>
            {reviews.loading ? (
              <div className="profile-inline-state">Loading reviews…</div>
            ) : reviews.error ? (
              <div className="profile-inline-state profile-inline-error">
                {reviews.error}
              </div>
            ) : reviews.items.length ? (
              <div className="profile-review-list">
                {reviews.items.map((item) => (
                  <ReviewCard item={item} key={item.game?.id} />
                ))}
              </div>
            ) : reviewCount ? (
              <div className="profile-inline-state">
                Review previews are unavailable. Open a game in your Library to
                view and manage its review.
              </div>
            ) : (
              <div className="profile-inline-state">
                You have not reviewed any games yet.
              </div>
            )}
          </section>

          <section className="profile-section" id="screenshots">
            <div className="profile-section-title">
              <h2>Screenshots</h2>
            </div>
            {posts.loading ? (
              <div className="profile-inline-state">Loading screenshots…</div>
            ) : posts.error ? (
              <div className="profile-inline-state profile-inline-error">
                {posts.error}
              </div>
            ) : posts.screenshot.length ? (
              <div className="profile-media-gallery">
                {posts.screenshot.slice(0, 4).map((post) => (
                  <div className="profile-media-card" key={post.id}>
                    {getMedia(post) ? (
                      <PostMedia post={post} />
                    ) : (
                      <div className="profile-media-fallback">
                        {post.game?.title || 'Screenshot'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="profile-inline-state">
                You have not shared any screenshots yet.
              </div>
            )}
          </section>

          <section className="profile-section" id="videos">
            <div className="profile-section-title">
              <h2>Videos</h2>
            </div>
            {posts.loading ? (
              <div className="profile-inline-state">Loading videos…</div>
            ) : posts.error ? (
              <div className="profile-inline-state profile-inline-error">
                {posts.error}
              </div>
            ) : posts.video.length ? (
              <div className="profile-video-gallery">
                <div className="profile-video-main">
                  <GalleryPostCard post={posts.video[0]} compact />
                  {!isVideoMedia(getMedia(posts.video[0])) && (
                    <span className="profile-play" aria-hidden="true">
                      ▶
                    </span>
                  )}
                </div>
                <div className="profile-video-thumbs">
                  {posts.video.slice(1, 4).map((post) => (
                    <div key={post.id}>
                      {getMedia(post) ? (
                        <PostMedia post={post} />
                      ) : (
                        <span>Video</span>
                      )}
                      {!isVideoMedia(getMedia(post)) && (
                        <b aria-hidden="true">▶</b>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="profile-inline-state">
                You have not shared any videos yet.
              </div>
            )}
          </section>

          <section className="profile-section" id="community-posts">
            <div className="profile-section-title">
              <h2>Community posts</h2>
            </div>
            {posts.loading ? (
              <div className="profile-inline-state">Loading posts…</div>
            ) : posts.error ? (
              <div className="profile-inline-state profile-inline-error">
                {posts.error}
              </div>
            ) : posts.community.length ? (
              <div className="profile-post-list">
                {posts.community.slice(0, 2).map((post) => (
                  <GalleryPostCard post={post} key={post.id} />
                ))}
              </div>
            ) : (
              <div className="profile-inline-state">
                You have not published any community posts yet.
              </div>
            )}
          </section>

          <section className="profile-section" id="guides">
            <div className="profile-section-title">
              <h2>Guides</h2>
            </div>
            {posts.loading ? (
              <div className="profile-inline-state">Loading guides…</div>
            ) : posts.error ? (
              <div className="profile-inline-state profile-inline-error">
                {posts.error}
              </div>
            ) : posts.guide.length ? (
              <div className="profile-post-list">
                {posts.guide.slice(0, 2).map((post) => (
                  <GalleryPostCard post={post} compact key={post.id} />
                ))}
              </div>
            ) : (
              <div className="profile-inline-state">
                You have not published any guides yet.
              </div>
            )}
          </section>

          <section className="profile-section" id="comments">
            <div className="profile-section-title">
              <h2>
                Recent comments on your posts{' '}
                <span>{comments.items.length}</span>
              </h2>
            </div>
            {comments.loading ? (
              <div className="profile-inline-state">Loading comments…</div>
            ) : comments.error ? (
              <div className="profile-inline-state profile-inline-error">
                {comments.error}
              </div>
            ) : comments.items.length ? (
              <div className="profile-comments">
                {comments.items.map((comment) => (
                  <article key={comment.id}>
                    <div className="mini-avatar">
                      {comment.author?.username?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                      <div className="profile-comment-meta">
                        <strong>{comment.author?.username || 'User'}</strong>
                        <span>{formatDate(comment.created_at)}</span>
                      </div>
                      <span className="profile-comment-context">
                        On {comment.postTitle}
                      </span>
                      <p>{comment.body}</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="profile-inline-state">
                Your posts do not have any comments yet.
              </div>
            )}
          </section>
        </main>

        <aside className="profile-sidebar">
          <section className="profile-side-card">
            <div className="profile-side-title">
              <strong>Profile completeness</strong>
              <span className="profile-progress-number">{completion}%</span>
            </div>
            <div
              className="profile-progress-line"
              role="progressbar"
              aria-label="Profile completeness"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={completion}
            >
              <span style={{ width: `${completion}%` }} />
            </div>
            <div className="profile-progress-caption">
              {completedProfileFields} of 4 profile details completed
            </div>
            <nav className="profile-side-links" aria-label="Profile sections">
              {sideSections.map(([label, href, count]) => (
                <a href={href} key={label}>
                  <span>{label}</span>
                  {count !== null && <b>{formatNumber(count)}</b>}
                </a>
              ))}
            </nav>
          </section>
          <section className="profile-side-card">
            <div className="profile-side-title">
              <strong>Connections</strong>
            </div>
            <div className="profile-friends-list">
              <div>
                <span className="mini-avatar">F</span>
                <span>Followers</span>
                <b>{formatNumber(stats.followers)}</b>
              </div>
              <div>
                <span className="mini-avatar">F</span>
                <span>Following</span>
                <b>{formatNumber(stats.following)}</b>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {modalOpen &&
        createPortal(
          <ProfileEditModal
            profile={profile}
            onClose={closeModal}
            onSaved={handleSaved}
            onSave={save}
          />,
          document.body,
        )}
    </div>
  )
}

export default ProfilePage
