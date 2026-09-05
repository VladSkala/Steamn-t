import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  deleteGameReview,
  saveGameReview,
  togglePostReaction,
  updateLibraryItem,
} from "../api/library";
import CatalogFeedback from "../components/CatalogFeedback";
import LibraryFrame from "../components/library/LibraryFrame";
import LibraryPostCard from "../components/library/LibraryPostCard";
import useLibrary from "../hooks/useLibrary";
import { useLibraryGame } from "../hooks/useLibraryExperience";

function StarIcon({ filled = false }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        className={filled ? "filled" : ""}
        d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"
      />
    </svg>
  );
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
                      event.currentTarget.hidden = true;
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
  );
}

const REVIEW_MAX_IMAGES = 4;
const REVIEW_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const REVIEW_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function getReviewSaveError(requestError) {
  const payload = requestError?.response?.data;
  const imageError = payload?.images || payload?.image;
  if (Array.isArray(imageError)) return imageError[0];
  if (typeof imageError === "string") return imageError;
  if (typeof payload?.detail === "string") return payload.detail;
  return "Unable to save your review.";
}

function ReviewImageTile({ source, alt, onRemove, removeLabel }) {
  return (
    <figure className="library-review-image-tile">
      <img src={source} alt={alt} />
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={removeLabel}>
          ×
        </button>
      )}
    </figure>
  );
}

function ReviewEditor({ gameId, review, onSaved }) {
  const [editing, setEditing] = useState(!review);
  const [rating, setRating] = useState(review?.rating || 5);
  const [body, setBody] = useState(review?.body || "");
  const [existingImages, setExistingImages] = useState(review?.images || []);
  const [newImages, setNewImages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const previewUrls = useRef(new Set());

  const releaseNewImages = () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current.clear();
    setNewImages([]);
  };

  useEffect(
    () => () => {
      previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.current.clear();
    },
    [],
  );

  const imageCount = existingImages.length + newImages.length;

  const handleImages = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    setError("");
    if (imageCount + files.length > REVIEW_MAX_IMAGES) {
      setError(`You can attach up to ${REVIEW_MAX_IMAGES} images.`);
      return;
    }
    const invalidFile = files.find((file) => {
      const validExtension = /\.(jpe?g|png|webp)$/i.test(file.name);
      return (
        (file.type && !REVIEW_IMAGE_TYPES.has(file.type)) || !validExtension
      );
    });
    if (invalidFile) {
      setError("Review images must be JPG, PNG, or WebP files.");
      return;
    }
    if (files.some((file) => file.size > REVIEW_MAX_IMAGE_BYTES)) {
      setError("Each review image must be 5 MB or smaller.");
      return;
    }
    // Object URLs are allocated in the event, never in a StrictMode state updater.
    const additions = files.map((file) => {
      const preview = URL.createObjectURL(file);
      previewUrls.current.add(preview);
      return { file, preview, key: `${file.name}-${file.size}-${preview}` };
    });
    setNewImages((current) => [...current, ...additions]);
  };

  const removeNewImage = (key) => {
    const removed = newImages.find((image) => image.key === key);
    if (removed) {
      URL.revokeObjectURL(removed.preview);
      previewUrls.current.delete(removed.preview);
    }
    setNewImages((current) => current.filter((image) => image.key !== key));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload = new FormData();
    payload.append("rating", String(rating));
    payload.append("body", body);
    payload.append("replace_images", "1");
    existingImages.forEach((image) =>
      payload.append("keep_image_ids", String(image.id)),
    );
    newImages.forEach(({ file }) => payload.append("images", file));
    try {
      await saveGameReview(gameId, payload);
      releaseNewImages();
      setEditing(false);
      onSaved();
    } catch (requestError) {
      setError(getReviewSaveError(requestError));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    setError("");
    try {
      await deleteGameReview(gameId);
      releaseNewImages();
      setExistingImages([]);
      setRating(5);
      setBody("");
      setEditing(true);
      onSaved();
    } catch {
      setError("Unable to delete your review.");
    } finally {
      setSaving(false);
    }
  };

  const cancelEditing = () => {
    setRating(review?.rating || 5);
    setBody(review?.body || "");
    setExistingImages(Array.isArray(review?.images) ? review.images : []);
    releaseNewImages();
    setError("");
    setEditing(false);
  };

  if (!editing && review) {
    return (
      <div className="library-review-saved">
        <span>{"★".repeat(Number(review.rating))}</span>
        <p>{review.body}</p>
        {Array.isArray(review.images) && review.images.length > 0 && (
          <div className="library-review-gallery" aria-label="Review images">
            {review.images.map((image, index) => (
              <ReviewImageTile
                key={image.id}
                source={image.image}
                alt={`Review image ${index + 1}`}
              />
            ))}
          </div>
        )}
        <div className="library-review-actions">
          <button type="button" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button
            type="button"
            className="danger"
            onClick={handleDelete}
            disabled={saving}
          >
            Delete
          </button>
        </div>
        {error && <small role="alert">{error}</small>}
      </div>
    );
  }

  return (
    <form className="library-review-form" onSubmit={handleSubmit}>
      <label>
        Rating
        <select
          value={rating}
          onChange={(event) => setRating(event.target.value)}
          disabled={saving}
        >
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {value} / 5
            </option>
          ))}
        </select>
      </label>
      <label>
        Review
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          minLength={3}
          maxLength={4000}
          required
          disabled={saving}
          placeholder="What did you think about this game?"
        />
      </label>
      <div className="library-review-photo-field">
        <div className="library-review-photo-heading">
          <div>
            <strong>Photos</strong>
            <span>JPG, PNG, or WebP · 5 MB each</span>
          </div>
          <span>
            {imageCount} / {REVIEW_MAX_IMAGES}
          </span>
        </div>
        {imageCount > 0 && (
          <div className="library-review-gallery is-editing">
            {existingImages.map((image, index) => (
              <ReviewImageTile
                key={image.id}
                source={image.image}
                alt={`Saved review image ${index + 1}`}
                removeLabel={`Remove saved image ${index + 1}`}
                onRemove={() =>
                  setExistingImages((current) =>
                    current.filter((candidate) => candidate.id !== image.id),
                  )
                }
              />
            ))}
            {newImages.map((image, index) => (
              <ReviewImageTile
                key={image.key}
                source={image.preview}
                alt={`New review image ${index + 1}`}
                removeLabel={`Remove new image ${index + 1}`}
                onRemove={() => removeNewImage(image.key)}
              />
            ))}
          </div>
        )}
        {imageCount < REVIEW_MAX_IMAGES && (
          <label className="library-review-upload">
            <span aria-hidden="true">＋</span> Add photos
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              multiple
              onChange={handleImages}
              disabled={saving}
            />
          </label>
        )}
      </div>
      {error && <small role="alert">{error}</small>}
      <div className="library-review-actions">
        {review && (
          <button type="button" onClick={cancelEditing} disabled={saving}>
            Cancel
          </button>
        )}
        <button type="submit" className="primary" disabled={saving}>
          {saving ? "Saving…" : "Save review"}
        </button>
      </div>
    </form>
  );
}

function LibraryGamePage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const sidebar = useLibrary();
  const { data, loading, error, retry, refresh, updatePost } =
    useLibraryGame(gameId);
  const [favoriteBusy, setFavoriteBusy] = useState(false);

  const likePost = async (post) => {
    updatePost(post.id, await togglePostReaction(post.id));
  };

  const toggleFavorite = async () => {
    if (!data?.library_item || favoriteBusy) return;
    setFavoriteBusy(true);
    try {
      await updateLibraryItem(data.library_item.id, {
        is_favorite: !data.library_item.is_favorite,
      });
      refresh();
      sidebar.retry();
    } finally {
      setFavoriteBusy(false);
    }
  };

  const frame = (children, title = "Library game") => (
    <LibraryFrame items={sidebar.items} activeGameId={gameId} title={title}>
      {children}
    </LibraryFrame>
  );

  if (loading) {
    return frame(
      <CatalogFeedback
        kind="loading"
        title="Loading your game"
        message="Fetching ownership, news, and community activity."
        className="library-feedback"
      />,
      "Loading library game",
    );
  }

  if (error) {
    return frame(
      <>
        <CatalogFeedback
          kind={error === "not-found" ? "empty" : "error"}
          title={
            error === "not-found"
              ? "Game not in your library"
              : "Game unavailable"
          }
          message={
            error === "not-found"
              ? "Purchase this game before opening its library page."
              : error
          }
          onRetry={error === "not-found" ? undefined : retry}
          className="library-feedback"
        />
        <Link className="library-back-link" to="/library">
          ← Back to library
        </Link>
      </>,
    );
  }

  const game = data.game;
  const item = data.library_item;
  const heroSource = game.hero_image_url || game.cover;
  const heroStyle = heroSource
    ? { backgroundImage: `url("${heroSource}")` }
    : undefined;
  const heroMonogram = game.title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return (
    <LibraryFrame
      items={sidebar.items}
      activeGameId={game.id}
      title={`${game.title} library page`}
      className="library-owned-game-page"
    >
      <section
        className={`library-game-hero ${heroSource ? "has-artwork" : "is-fallback"}`}
        style={heroStyle}
      >
        {!heroSource && (
          <div className="library-game-hero-fallback" aria-hidden="true">
            <span>{heroMonogram || "S"}</span>
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
                  : "Not specified"}
              </strong>
            </span>
          </div>
        </div>
        <div className="library-game-hero-actions">
          <button
            type="button"
            className={item.is_favorite ? "active" : ""}
            aria-label="Toggle favorite"
            aria-pressed={item.is_favorite}
            disabled={favoriteBusy}
            onClick={toggleFavorite}
          >
            <StarIcon filled={item.is_favorite} />
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
            key={`${game.id}:${data.review?.updated_at || "new"}`}
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
          <p>{game.description || "No description is available yet."}</p>
        </div>
        <dl>
          <div>
            <dt>Developer</dt>
            <dd>{game.developer}</dd>
          </div>
          <div>
            <dt>Released</dt>
            <dd>{game.release_date || "Not specified"}</dd>
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
  );
}

export default LibraryGamePage;
