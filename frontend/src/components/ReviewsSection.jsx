import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import {
  createGameReview,
  deleteGameReviewById,
  getGameReviews,
  updateGameReview,
} from "../api/reviews";
import { useAuth } from "../hooks/useAuth";

const REVIEW_MAX_IMAGES = 4;
const REVIEW_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const REVIEW_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const REVIEW_PAGE_SIZE = 10;

function StarIcon({ filled = false, partial = false }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        className={`${filled ? "filled" : ""}${partial ? " partial" : ""}`}
        d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"
      />
    </svg>
  );
}

function StarDisplay({ value = 0, size = "md", label }) {
  const safeValue = Math.max(0, Math.min(5, Number(value) || 0));
  return (
    <div
      className={`reviews-stars reviews-stars-${size}`}
      aria-label={label || `${safeValue.toFixed(1)} out of 5 stars`}
      role="img"
    >
      {Array.from({ length: 5 }, (_, index) => {
        const star = index + 1;
        const filled = safeValue >= star;
        const partial = !filled && safeValue > index;
        return (
          <span key={star} className="reviews-star">
            <StarIcon filled={filled} partial={partial} />
          </span>
        );
      })}
    </div>
  );
}

function RatingInput({ value, onChange, disabled }) {
  const [hovered, setHovered] = useState(0);
  const active = hovered || value;
  return (
    <fieldset className="reviews-rating-input" disabled={disabled}>
      <legend>Rating</legend>
      <div
        className="reviews-rating-buttons"
        onMouseLeave={() => setHovered(0)}
      >
        {Array.from({ length: 5 }, (_, index) => {
          const rating = index + 1;
          const isActive = active >= rating;
          return (
            <button
              key={rating}
              type="button"
              className={isActive ? "active" : ""}
              aria-label={`${rating} out of 5 stars`}
              aria-pressed={value === rating}
              onMouseEnter={() => setHovered(rating)}
              onFocus={() => setHovered(rating)}
              onBlur={() => setHovered(0)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "ArrowUp") {
                  event.preventDefault();
                  onChange(Math.min(5, value + 1));
                }
                if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
                  event.preventDefault();
                  onChange(Math.max(1, value - 1));
                }
              }}
              onClick={() => onChange(rating)}
            >
              <StarIcon filled={isActive} />
            </button>
          );
        })}
      </div>
      <span className="reviews-rating-value">{value} / 5</span>
    </fieldset>
  );
}

function getErrorMessage(requestError, fallback) {
  const payload = requestError?.response?.data;
  if (!payload) return fallback;

  if (typeof payload.detail === "string") return payload.detail;
  for (const key of ["rating", "body", "images", "image"]) {
    const value = payload[key];
    if (Array.isArray(value) && value.length) return String(value[0]);
    if (typeof value === "string") return value;
  }

  if (requestError?.response?.status === 401) {
    return "Please sign in to manage your review.";
  }
  if (requestError?.response?.status === 403) {
    return "You must own this game to leave a review.";
  }
  if (requestError?.response?.status === 404) {
    return "The review or game could not be found.";
  }
  if (requestError?.response?.status === 409) {
    return "You have already reviewed this game.";
  }
  if (requestError?.response?.status >= 500) {
    return "The review service is temporarily unavailable.";
  }
  return fallback;
}

function createImageState(file) {
  return {
    file,
    key: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID?.() || Math.random()}`,
    preview: URL.createObjectURL(file),
  };
}

function ReviewImageGrid({ images, editable = false, onRemove }) {
  if (!images?.length) return null;
  return (
    <div className="reviews-image-grid">
      {images.map((image, index) => (
        <figure className="reviews-image-tile" key={image.key || image.id || image.image}>
          <img
            src={image.preview || image.image}
            alt={`Review image ${index + 1}`}
            loading="lazy"
          />
          {editable && onRemove && (
            <button
              type="button"
              className="reviews-image-remove"
              onClick={() => onRemove(image.key || image.id)}
              aria-label={`Remove review image ${index + 1}`}
            >
              ×
            </button>
          )}
        </figure>
      ))}
    </div>
  );
}

function ReviewComposer({
  gameId,
  viewerReview,
  onSaved,
  onCancel,
}) {
  const existingReview = viewerReview || null;
  const [rating, setRating] = useState(existingReview?.rating || 5);
  const [body, setBody] = useState(existingReview?.body || "");
  const [existingImages, setExistingImages] = useState(
    Array.isArray(existingReview?.images) ? existingReview.images : [],
  );
  const [newImages, setNewImages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const previewUrls = useRef(new Set());

  const releasePreviews = useCallback(() => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current.clear();
    setNewImages([]);
  }, []);

  useEffect(() => {
    const urls = previewUrls.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  const imageCount = existingImages.length + newImages.length;
  const isEditing = Boolean(existingReview);
  const isValidBody = body.trim().length > 0 && body.trim().length <= 4000;

  const handleImages = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    setError("");

    if (imageCount + files.length > REVIEW_MAX_IMAGES) {
      setError(`You can attach up to ${REVIEW_MAX_IMAGES} images.`);
      return;
    }
    if (
      files.some(
        (file) =>
          !REVIEW_IMAGE_TYPES.has(file.type) ||
          !/\.(jpe?g|png|webp)$/i.test(file.name),
      )
    ) {
      setError("Review images must be JPG, PNG, or WebP files.");
      return;
    }
    if (files.some((file) => file.size > REVIEW_MAX_IMAGE_BYTES)) {
      setError("Each review image must be 5 MB or smaller.");
      return;
    }

    const additions = files.map((file) => createImageState(file));
    additions.forEach((image) => previewUrls.current.add(image.preview));
    setNewImages((current) => [...current, ...additions]);
  };

  const removeExistingImage = (id) => {
    setExistingImages((current) => current.filter((image) => image.id !== id));
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
    const trimmedBody = body.trim();
    if (!trimmedBody) {
      setError("Review text cannot be empty.");
      return;
    }
    if (trimmedBody.length > 4000) {
      setError("Review must be 4000 characters or fewer.");
      return;
    }

    setSaving(true);
    setError("");
    const payload = new FormData();
    payload.append("rating", String(rating));
    payload.append("body", trimmedBody);
    if (isEditing) {
      payload.append("replace_images", "1");
      existingImages.forEach((image) =>
        payload.append("keep_image_ids", String(image.id)),
      );
    }
    newImages.forEach(({ file }) => payload.append("images", file));

    try {
      const saved = isEditing
        ? await updateGameReview(gameId, existingReview.id, payload)
        : await createGameReview(gameId, payload);
      releasePreviews();
      onSaved(saved);
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          isEditing ? "Unable to update your review." : "Unable to save your review.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="reviews-composer" onSubmit={handleSubmit}>
      <div className="reviews-composer-heading">
        <div>
          <span className="reviews-kicker">{isEditing ? "Your review" : "Share your experience"}</span>
          <h3>{isEditing ? "Edit your review" : "Write a review"}</h3>
        </div>
        <span className="reviews-character-count" aria-live="polite">
          {body.length} / 4000
        </span>
      </div>

      <RatingInput value={rating} onChange={setRating} disabled={saving} />

      <label className="reviews-field">
        <span>Review</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Tell other players what you think about this game…"
          rows={6}
          maxLength={4000}
          disabled={saving}
          aria-invalid={Boolean(error) && !isValidBody}
        />
      </label>

      <div className="reviews-upload-section">
        <div className="reviews-upload-heading">
          <div>
            <span>Photos</span>
            <small>JPG, PNG or WebP · up to 5 MB each</small>
          </div>
          <b>{imageCount} / {REVIEW_MAX_IMAGES}</b>
        </div>
        <ReviewImageGrid
          images={[...existingImages, ...newImages]}
          editable
          onRemove={(key) => {
            if (newImages.some((image) => image.key === key)) removeNewImage(key);
            else removeExistingImage(key);
          }}
        />
        {imageCount < REVIEW_MAX_IMAGES && (
          <label className="reviews-upload-button">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleImages}
              disabled={saving}
            />
            <span>+ Add photos</span>
          </label>
        )}
      </div>

      {error && (
        <p className="reviews-form-message is-error" role="alert">
          {error}
        </p>
      )}

      <div className="reviews-composer-actions">
        {onCancel && (
          <button
            type="button"
            className="reviews-button reviews-button-ghost"
            onClick={() => {
              releasePreviews();
              onCancel();
            }}
            disabled={saving}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="reviews-button reviews-button-primary"
          disabled={saving || !body.trim() || body.trim().length > 4000}
        >
          {saving ? "Saving…" : isEditing ? "Save changes" : "Publish review"}
        </button>
      </div>
    </form>
  );
}

function ReviewCard({ review, onEdit, onDelete, deleting }) {
  const authorName = review.author?.username || "Player";
  const createdAt = new Date(review.created_at);
  const updatedAt = new Date(review.updated_at);
  const dateValue = Number.isNaN(updatedAt.getTime())
    ? review.created_at
    : updatedAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
  const edited =
    Number.isFinite(createdAt.getTime()) &&
    Number.isFinite(updatedAt.getTime()) &&
    Math.abs(updatedAt.getTime() - createdAt.getTime()) > 1000;

  return (
    <article className="reviews-card">
      <div className="reviews-card-topline">
        <div className="reviews-author">
          <span className="reviews-avatar">
            {review.author?.avatar ? (
              <img src={review.author.avatar} alt="" loading="lazy" />
            ) : (
              <b>{authorName.charAt(0).toUpperCase()}</b>
            )}
          </span>
          <div>
            <strong>{authorName}</strong>
            <span>
              {dateValue}{edited ? " · edited" : ""}
            </span>
          </div>
        </div>
        {review.is_owner && (
          <div className="reviews-card-actions">
            <button type="button" onClick={onEdit} disabled={deleting}>
              Edit
            </button>
            <button
              type="button"
              className="danger"
              onClick={onDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        )}
      </div>
      <StarDisplay value={review.rating} size="sm" />
      <p className="reviews-card-body">{review.body}</p>
      <ReviewImageGrid images={review.images} />
    </article>
  );
}

function RatingSummary({ averageRating, reviewCount, distribution }) {
  const average = averageRating == null ? 0 : Number(averageRating);
  return (
    <section className="reviews-summary" aria-labelledby="reviews-summary-title">
      <div className="reviews-summary-score">
        <span className="reviews-kicker">Community rating</span>
        <strong>{reviewCount ? average.toFixed(1) : "—"}</strong>
        <span>out of 5</span>
        <StarDisplay
          value={average}
          size="lg"
          label={reviewCount ? `${average.toFixed(1)} out of 5` : "No rating yet"}
        />
        <p id="reviews-summary-title">
          {reviewCount === 0
            ? "No reviews yet"
            : `${reviewCount} ${reviewCount === 1 ? "review" : "reviews"}`}
        </p>
      </div>

      <div className="reviews-distribution" aria-label="Rating distribution">
        {[5, 4, 3, 2, 1].map((rating) => {
          const count = Number(distribution?.[rating] || 0);
          const width = reviewCount ? `${(count / reviewCount) * 100}%` : "0%";
          return (
            <div className="reviews-distribution-row" key={rating}>
              <span>{rating}</span>
              <span className="reviews-mini-star"><StarIcon filled /></span>
              <div className="reviews-distribution-track" aria-hidden="true">
                <span style={{ width }} />
              </div>
              <strong>{count}</strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ReviewsSection({ gameId, isOwned }) {
  const location = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [data, setData] = useState({
    average_rating: null,
    review_count: 0,
    rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    viewer_review: null,
    pagination: { page: 1, total_pages: 1 },
    reviews: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingReview, setEditingReview] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadReviews = useCallback(
    async (targetPage = 1, options = {}) => {
      const { silent = false } = options;
      if (!silent) setLoading(true);
      setError("");
      try {
        const payload = await getGameReviews(gameId, {
          page: targetPage,
          pageSize: REVIEW_PAGE_SIZE,
        });
        setData(payload);
        setPage(payload.pagination?.page || targetPage);
        return payload;
      } catch (requestError) {
        setError(getErrorMessage(requestError, "Unable to load reviews."));
        return null;
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [gameId],
  );

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    getGameReviews(gameId, {
      page: 1,
      pageSize: REVIEW_PAGE_SIZE,
      signal: controller.signal,
    })
      .then((payload) => {
        if (!active) return;
        setData(payload);
        setPage(payload.pagination?.page || 1);
      })
      .catch((requestError) => {
        if (!active || requestError?.name === "AbortError" || requestError?.code === "ERR_CANCELED") {
          return;
        }
        setError(getErrorMessage(requestError, "Unable to load reviews."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [gameId]);


  const viewerReview = data.viewer_review;
  const totalPages = Number(data.pagination?.total_pages || 1);
  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  const handleSaved = async () => {
    setComposerOpen(false);
    setEditingReview(false);
    await loadReviews(page, { silent: true });
  };

  const handleDelete = async (reviewId) => {
    if (!window.confirm("Delete your review? This cannot be undone.")) return;
    setDeletingId(reviewId);
    setError("");
    try {
      await deleteGameReviewById(gameId, reviewId);
      const targetPage = data.reviews.length === 1 && page > 1 ? page - 1 : page;
      await loadReviews(targetPage, { silent: true });
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to delete your review."));
    } finally {
      setDeletingId(null);
    }
  };

  const hasReviews = data.review_count > 0;
  const reviewsTitle = useMemo(
    () => (hasReviews ? "Reviews" : "Reviews & Ratings"),
    [hasReviews],
  );

  return (
    <section className="reviews-section" id="reviews" aria-labelledby="reviews-title">
      <div className="reviews-section-heading">
        <div>
          <span className="reviews-kicker">Community feedback</span>
          <h2 id="reviews-title">{reviewsTitle}</h2>
        </div>
        <span className="reviews-heading-count">{data.review_count} total</span>
      </div>

      <RatingSummary
        averageRating={data.average_rating}
        reviewCount={data.review_count}
        distribution={data.rating_distribution}
      />

      <div className="reviews-write-wrap">
        {authLoading ? (
          <div className="reviews-callout is-loading">Checking your session…</div>
        ) : !isAuthenticated ? (
          <div className="reviews-callout">
            <div>
              <strong>Have something to say?</strong>
              <span>Sign in to rate this game and leave a review.</span>
            </div>
            <Link
              className="reviews-button reviews-button-primary"
              to="/login"
              state={{ from: location }}
            >
              Sign in
            </Link>
          </div>
        ) : !isOwned ? (
          <div className="reviews-callout is-muted">
            <div>
              <strong>Reviews are for players who own the game.</strong>
              <span>Purchase the game to share your rating and review.</span>
            </div>
          </div>
        ) : viewerReview && !editingReview ? (
          <div className="reviews-your-review">
            <div>
              <span className="reviews-kicker">Your review</span>
              <h3>Thanks for sharing your experience.</h3>
              <StarDisplay value={viewerReview.rating} size="sm" />
              <p>{viewerReview.body}</p>
            </div>
            <div className="reviews-your-review-actions">
              <button
                type="button"
                className="reviews-button reviews-button-secondary"
                onClick={() => setEditingReview(true)}
              >
                Edit review
              </button>
              <button
                type="button"
                className="reviews-button reviews-button-danger"
                onClick={() => handleDelete(viewerReview.id)}
                disabled={deletingId === viewerReview.id}
              >
                {deletingId === viewerReview.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        ) : composerOpen || editingReview ? (
          <div>
            {!composerOpen && !editingReview && (
              <button
                type="button"
                className="reviews-button reviews-button-primary reviews-open-composer"
                onClick={() => setComposerOpen(true)}
              >
                Write a review
              </button>
            )}
            {(composerOpen || editingReview) && (
              <ReviewComposer
                key={viewerReview?.updated_at || "new-review"}
                gameId={gameId}
                viewerReview={editingReview ? viewerReview : null}
                onSaved={handleSaved}
                onCancel={() => {
                  setComposerOpen(false);
                  setEditingReview(false);
                }}
              />
            )}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="reviews-list-state" role="status">
          <span className="reviews-spinner" aria-hidden="true" />
          Loading reviews…
        </div>
      ) : error ? (
        <div className="reviews-list-state is-error" role="alert">
          <strong>We couldn't load the reviews.</strong>
          <span>{error}</span>
          <button
            type="button"
            className="reviews-button reviews-button-secondary"
            onClick={() => loadReviews(page)}
          >
            Try again
          </button>
        </div>
      ) : data.reviews.length ? (
        <div className="reviews-list">
          {data.reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onEdit={() => {
                setEditingReview(Boolean(viewerReview?.id === review.id));
                setComposerOpen(false);
              }}
              onDelete={() => handleDelete(review.id)}
              deleting={deletingId === review.id}
            />
          ))}
        </div>
      ) : (
        <div className="reviews-empty">
          <span className="reviews-empty-icon" aria-hidden="true">★</span>
          <strong>No reviews yet</strong>
          <span>Be the first player to share an opinion.</span>
        </div>
      )}

      {!loading && !error && totalPages > 1 && (
        <nav className="reviews-pagination" aria-label="Reviews pagination">
          <button
            type="button"
            className="reviews-button reviews-button-ghost"
            disabled={!hasPrevious}
            onClick={() => loadReviews(page - 1)}
          >
            ← Previous
          </button>
          <span>
            Page <strong>{page}</strong> of <strong>{totalPages}</strong>
          </span>
          <button
            type="button"
            className="reviews-button reviews-button-ghost"
            disabled={!hasNext}
            onClick={() => loadReviews(page + 1)}
          >
            Next →
          </button>
        </nav>
      )}
    </section>
  );
}

export default ReviewsSection;
