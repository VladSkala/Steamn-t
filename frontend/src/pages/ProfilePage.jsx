import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'

import { getLibrary, getLibraryFeed, getLibraryGame, getPostComments } from '../api/library'
import { useAuth } from '../hooks/useAuth'
import useProfile from '../hooks/useProfile'
import CatalogFeedback from '../components/CatalogFeedback'

const badgeIcons = ['◈', '⚔', '♥', '♡', '⌘']

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

const formatNumber = (value) => new Intl.NumberFormat('uk-UA').format(Number(value) || 0)

const getUsername = (profile, user) =>
  profile?.username ||
  user?.username ||
  'player'

const getFullName = (profile, user) => {
  const fullName = [
    profile?.first_name,
    profile?.last_name,
    user?.first_name,
    user?.last_name,
  ]
    .filter(Boolean)
    .join(' ')
    .trim()

  const displayName = String(profile?.display_name || '').trim()
  const username = getUsername(profile, user)

  if (displayName && displayName.toLowerCase() !== username.toLowerCase()) {
    return displayName
  }

  return fullName && fullName.toLowerCase() !== username.toLowerCase() ? fullName : ''
}

const getBio = (profile) => {
  const value = profile?.bio ?? profile?.description ?? profile?.about
  return typeof value === 'string' ? value.trim() : ''
}

const getMedia = (post) => post?.media || post?.game?.cover || null

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
  const inputRef = useRef(null)

  useEffect(() => () => {
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
  }, [preview])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) onClose()
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, saving])

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setError('')
  }

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return setError('Аватар має бути не більшим за 5 МБ.')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setError('Дозволені JPG, PNG або WebP.')
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
    setForm((current) => ({ ...current, avatar: file, remove_avatar: false }))
    setPreview(URL.createObjectURL(file))
    setError('')
  }

  const clearAvatar = () => {
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
    setForm((current) => ({ ...current, avatar: null, remove_avatar: true }))
    setPreview('')
    if (inputRef.current) inputRef.current.value = ''
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
      if (form.avatar instanceof File) payload.avatar = form.avatar
      else if (form.remove_avatar) payload.avatar = null
      const updated = await onSave(payload)
      await onSaved(updated)
      onClose()
    } catch (requestError) {
      const data = requestError?.response?.data
      const message = data && typeof data === 'object'
        ? Object.entries(data).map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(', ') : value}`).join(' ')
        : ''
      setError(message || 'Не вдалося зберегти профіль. Спробуй ще раз.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="profile-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose()
    }}>
      <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-edit-title">
        <div className="profile-modal-head">
          <div><span className="section-kicker">ПРОФІЛЬ</span><h2 id="profile-edit-title">Редагувати профіль</h2></div>
          <button type="button" className="profile-modal-close" onClick={onClose} disabled={saving} aria-label="Закрити">×</button>
        </div>
        <form className="profile-edit-form" onSubmit={submit}>
          <div className="profile-edit-avatar-row">
            <div className="profile-edit-avatar">
              {preview ? <img src={preview} alt="" /> : <span>{(profile?.username || 'P').charAt(0).toUpperCase()}</span>}
            </div>
            <div>
              <strong>Аватар</strong>
              <p>JPG, PNG або WebP, до 5 МБ.</p>
              <div className="profile-edit-avatar-actions">
                <label className="profile-modal-button profile-upload-button">Обрати<input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarChange} /></label>
                {(preview || profile?.avatar) && <button type="button" className="profile-remove-button" onClick={clearAvatar}>Видалити</button>}
              </div>
            </div>
          </div>
          <div className="profile-form-grid">
            <label>Username<input value={form.username} onChange={(event) => update('username', event.target.value)} required /></label>
            <label>Email<input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} required /></label>
            <label>Ім’я<input value={form.first_name} onChange={(event) => update('first_name', event.target.value)} /></label>
            <label>Прізвище<input value={form.last_name} onChange={(event) => update('last_name', event.target.value)} /></label>
          </div>
          {error && <div className="profile-form-error" role="alert">{error}</div>}
          <div className="profile-form-actions">
            <button type="button" className="profile-modal-button secondary" onClick={onClose} disabled={saving}>Скасувати</button>
            <button type="submit" className="profile-modal-button primary" disabled={saving}>{saving ? 'Збереження…' : 'Зберегти'}</button>
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
        <span className="profile-game-chip">{post?.game?.title || 'Спільнота'}</span>
        <span>{formatDate(post?.created_at)}</span>
        <button type="button" aria-label="Додаткові дії">•••</button>
      </div>
      {post?.title && <h3>{post.title}</h3>}
      {post?.body && <p>{post.body}</p>}
      {media && <img className="profile-post-image" src={media} alt="" loading="lazy" />}
      <div className="profile-post-actions">
        <span>♡ {formatNumber(post?.like_count)}</span>
        <span>▢ {formatNumber(post?.comment_count)}</span>
        <span>↗ Поділитися</span>
      </div>
    </article>
  )
}

function ReviewCard({ item }) {
  const review = item?.review
  if (!review) return null
  return (
    <article className="profile-review-card">
      <div className="profile-review-media">
        {item.game?.cover ? <img src={item.game.cover} alt="" loading="lazy" /> : <div />}
      </div>
      <div className="profile-review-body">
        <div className="profile-post-meta">
          <span className="profile-game-chip">{item.game?.title || 'Гра'}</span>
          <span>{formatDate(review.created_at)}</span>
          <button type="button" aria-label="Додаткові дії">•••</button>
        </div>
        <h3>{item.game?.title}</h3>
        <div className="profile-stars" aria-label={`Оцінка ${review.rating} з 5`}>{'★'.repeat(Math.max(0, Number(review.rating) || 0))}{'☆'.repeat(Math.max(0, 5 - (Number(review.rating) || 0)))}</div>
        <p>{review.body}</p>
        <div className="profile-post-actions"><span>♡</span><span>▢</span><span>↗ Поділитися</span></div>
      </div>
    </article>
  )
}

function ProfilePage() {
  const { user, reloadProfile } = useAuth()
  const { profile: fetchedProfile, loading: profileLoading, error: profileError, reload, save } = useProfile()
  const [library, setLibrary] = useState({ items: [], loading: true, error: null })
  const [posts, setPosts] = useState({ screenshot: [], video: [], guide: [], loading: true })
  const [reviews, setReviews] = useState([])
  const [comments, setComments] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const profile = fetchedProfile || user
  const username = getUsername(profile, user)
  const fullName = getFullName(profile, user)
  const bio = getBio(profile)
  const stats = useMemo(() => profile?.stats || {}, [profile])

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      getLibrary({ signal: controller.signal }),
      getLibraryFeed({ tab: 'library', kind: 'screenshot', ordering: 'latest', search: '' }, { signal: controller.signal }),
      getLibraryFeed({ tab: 'library', kind: 'video', ordering: 'latest', search: '' }, { signal: controller.signal }),
      getLibraryFeed({ tab: 'library', kind: 'guide', ordering: 'latest', search: '' }, { signal: controller.signal }),
    ]).then(async ([items, screenshot, video, guide]) => {
      if (controller.signal.aborted) return
      setLibrary({ items, loading: false, error: null })
      setPosts({ screenshot: screenshot.items, video: video.items, guide: guide.items, loading: false })
      const owned = items.slice(0, 4)
      const details = await Promise.all(owned.map((item) => getLibraryGame(item.game?.id, { signal: controller.signal }).catch(() => null)))
      const validReviews = details.filter((detail) => detail?.review).map((detail) => detail)
      setReviews(validReviews)
      const firstPost = [...screenshot.items, ...video.items, ...guide.items][0]
      if (firstPost?.id) {
        const loadedComments = await getPostComments(firstPost.id, { signal: controller.signal }).catch(() => [])
        if (!controller.signal.aborted) setComments(loadedComments.slice(0, 5))
      }
    }).catch((error) => {
      if (controller.signal.aborted || error?.code === 'ERR_CANCELED') return
      setLibrary({ items: [], loading: false, error: 'Не вдалося завантажити дані бібліотеки.' })
      setPosts((current) => ({ ...current, loading: false }))
    })
    return () => controller.abort()
  }, [])

  const libraryPreview = library.items.slice(0, 4)
  const coverImage = libraryPreview[0]?.game?.hero_image_url || libraryPreview[0]?.game?.cover || ''
  const progress = Math.round(([profile?.username, profile?.email, profile?.first_name || profile?.last_name, profile?.avatar].filter(Boolean).length / 4) * 100)

  const handleSaved = async () => {
    await reloadProfile()
    reload()
    setSuccessMessage('Профіль успішно оновлено.')
    window.setTimeout(() => setSuccessMessage(''), 3000)
  }

  const sideSections = useMemo(() => [
    ['Профіль', '#profile-overview', null],
    ['Значки', '#badges', 5],
    ['Ігри', '#games', stats.library_games],
    ['Бажане', '#games', stats.wishlist_games],
    ['Огляди', '#reviews', stats.reviews],
    ['Скріншоти', '#screenshots', posts.screenshot.length],
    ['Відео', '#videos', posts.video.length],
    ['Гайди', '#guides', posts.guide.length],
  ], [stats, posts])

  if (profileLoading && !profile) return <div className="profile-page profile-feedback-page"><CatalogFeedback kind="loading" title="Завантаження профілю" message="Підготовка профілю користувача." /></div>
  if (profileError && !profile) return <div className="profile-page profile-feedback-page"><CatalogFeedback kind="error" title="Профіль недоступний" message={profileError} onRetry={reload} /></div>

  return (
    <div className="profile-page">
      <section className="profile-hero" id="profile-overview">
        <div className="profile-cover" style={coverImage ? { backgroundImage: `linear-gradient(180deg, rgba(1, 35, 44, .06), rgba(1, 22, 29, .28)), url(${coverImage})` } : undefined} />
        <div className="profile-hero-info">
          <div className="profile-avatar-wrap">
            <div className="profile-avatar">{profile?.avatar ? <img src={profile.avatar} alt="" /> : <span>{username.charAt(0).toUpperCase()}</span>}</div>
            <span className="profile-online-dot" />
          </div>
          <div className="profile-user-block">
            <div className="profile-user-line">
              <h1>{username}</h1>
              <span className="profile-online-label">онлайн</span>
            </div>
            {fullName && <span className="profile-full-name">{fullName}</span>}
          </div>
          <button type="button" className="profile-edit-button" onClick={() => setModalOpen(true)}>✎ <span>Редагувати профіль</span></button>
        </div>
        {bio && <p className="profile-description">{bio}</p>}
      </section>

      {successMessage && <div className="profile-success" role="status">✓ {successMessage}</div>}

      <div className="profile-layout">
        <main className="profile-main">
          <section className="profile-section" id="badges">
            <div className="profile-section-title"><h2>Галерея значків</h2></div>
            <div className="badge-gallery">
              <div className="badge-stat-card"><strong>5</strong><span>Значків</span></div>
              {badgeIcons.map((icon, index) => <div className="badge-tile" key={index}><span>{icon}</span></div>)}
            </div>
          </section>

          <section className="profile-section" id="games">
            <div className="profile-section-title"><h2>Колекція ігор</h2></div>
            <div className="profile-stat-row">
              <div><strong>{formatNumber(stats.library_games)}</strong><span>Ігор</span></div>
              <div><strong>0</strong><span>DLC</span></div>
              <div><strong>{formatNumber(stats.wishlist_games)}</strong><span>Бажаних</span></div>
            </div>
            {library.loading ? <div className="profile-inline-state">Завантаження колекції…</div> : library.error ? <div className="profile-inline-state profile-inline-error">{library.error}</div> : library.items.length === 0 ? <div className="profile-inline-state">У бібліотеці поки немає ігор.</div> : (
              <div className="profile-game-grid">
                {libraryPreview.map((item) => <Link to={`/library/games/${item.game?.id}`} className="profile-game-card" key={item.id}>
                  <div className="profile-game-cover">{item.game?.cover ? <img src={item.game.cover} alt="" loading="lazy" /> : <span>S</span>}</div>
                </Link>)}
              </div>
            )}
          </section>

          <section className="profile-section" id="reviews">
            <div className="profile-section-title"><h2>Галерея оглядів</h2></div>
            {reviews.length ? <div className="profile-review-list">{reviews.map((item) => <ReviewCard item={item} key={item.game?.id} />)}</div> : <div className="profile-inline-state">У профілі ще немає оглядів ігор.</div>}
          </section>

          <section className="profile-section" id="screenshots">
            <div className="profile-section-title"><h2>Галерея скріншотів</h2></div>
            {posts.screenshot.length ? <div className="profile-media-gallery">
              {posts.screenshot.slice(0, 4).map((post) => <div className="profile-media-card" key={post.id}>{getMedia(post) ? <img src={getMedia(post)} alt="" loading="lazy" /> : <div className="profile-media-fallback">{post.game?.title || 'Screenshot'}</div>}</div>)}
            </div> : <div className="profile-inline-state">Скріншотів для цього профілю ще немає.</div>}
          </section>

          <section className="profile-section" id="videos">
            <div className="profile-section-title"><h2>Галерея відео</h2></div>
            {posts.video.length ? <div className="profile-video-gallery"><div className="profile-video-main"><GalleryPostCard post={posts.video[0]} compact /><span className="profile-play">▶</span></div><div className="profile-video-thumbs">{posts.video.slice(1, 4).map((post) => <div key={post.id}>{getMedia(post) ? <img src={getMedia(post)} alt="" /> : <span>▶</span>}<b>▶</b></div>)}</div></div> : <div className="profile-inline-state">Відео для цього профілю ще немає.</div>}
          </section>

          <section className="profile-section" id="community-reviews">
            <div className="profile-section-title"><h2>Галерея рецензій</h2></div>
            {posts.screenshot.length || posts.video.length ? <div className="profile-post-list">{[...posts.screenshot, ...posts.video].slice(0, 2).map((post) => <GalleryPostCard post={post} key={post.id} />)}</div> : <div className="profile-inline-state">Публікацій поки немає.</div>}
          </section>

          <section className="profile-section" id="guides">
            <div className="profile-section-title"><h2>Галерея гайдів</h2></div>
            {posts.guide.length ? <div className="profile-post-list">{posts.guide.slice(0, 2).map((post) => <GalleryPostCard post={post} compact key={post.id} />)}</div> : <div className="profile-inline-state">Гайдів поки немає.</div>}
          </section>

          <section className="profile-section" id="comments">
            <div className="profile-section-title"><h2>Коментарі <span>{comments.length}</span></h2></div>
            {comments.length ? <div className="profile-comments">{comments.map((comment) => <article key={comment.id}><div className="mini-avatar">{comment.author?.username?.charAt(0).toUpperCase() || 'U'}</div><div><div className="profile-comment-meta"><strong>{comment.author?.username || 'User'}</strong><span>{formatDate(comment.created_at)}</span></div><p>{comment.body}</p></div><button type="button">•••</button></article>)}</div> : <div className="profile-inline-state">Коментарів поки немає.</div>}
          </section>
        </main>

        <aside className="profile-sidebar">
          <section className="profile-side-card profile-level-card">
            <div className="profile-side-title"><strong>Рівень</strong><span className="profile-level-number">99</span></div>
            <div className="profile-level-line"><span style={{ width: `${Math.max(8, progress)}%` }} /></div>
            <div className="profile-level-points">{formatNumber(stats.library_games || 0)} очків</div>
            <div className="profile-side-links">{sideSections.slice(1).map(([label, href, count]) => <a href={href} key={label}><span>{label}</span><b>{count ?? 0}</b></a>)}</div>
          </section>
          <section className="profile-side-card">
            <div className="profile-side-title"><strong>Друзі</strong><span>{formatNumber(stats.followers)}</span></div>
            <div className="profile-friends-list">
              <div><span className="mini-avatar">F</span><span>Підписники</span><b>{formatNumber(stats.followers)}</b></div>
              <div><span className="mini-avatar">F</span><span>Підписки</span><b>{formatNumber(stats.following)}</b></div>
            </div>
          </section>
        </aside>
      </div>

      {modalOpen && createPortal(
        <ProfileEditModal
          profile={profile}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
          onSave={save}
        />,
        document.body,
      )}
    </div>
  )
}

export default ProfilePage
