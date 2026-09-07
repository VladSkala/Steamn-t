import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import {
  deleteGameReviewById,
  getMyReviews,
  updateGameReview,
} from "../api/reviews";

const PAGE_SIZE = 10;
const MAX_REVIEW_LENGTH = 4000;

const isCanceledRequest = (error) =>
  error?.code === "ERR_CANCELED" ||
  error?.name === "CanceledError" ||
  error?.name === "AbortError";

const formatDate = (value) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
};

const getErrorMessage = (error, fallback) => {
  const payload = error?.response?.data;
  if (typeof payload?.detail === "string") return payload.detail;
  for (const field of ["rating", "body", "non_field_errors"]) {
    const value = payload?.[field];
    if (Array.isArray(value) && value.length) return String(value[0]);
    if (typeof value === "string") return value;
  }
  if (error?.response?.status >= 500) {
    return "The review service is temporarily unavailable.";
  }
  return fallback;
};

function StarIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        className={filled ? "filled" : ""}
        d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"
      />
    </svg>
  );
}

function StarRating({ value, editable = false, disabled = false, onChange }) {
  const safeValue = Math.min(5, Math.max(1, Number(value) || 1));

  if (!editable) {
    return (
      <div
        className="my-reviews-stars"
        role="img"
        aria-label={`${safeValue} out of 5 stars`}
      >
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index + 1}>
            <StarIcon filled={index < safeValue} />
          </span>
        ))}
      </div>
    );
  }

  return (
    <fieldset className="my-reviews-rating-input" disabled={disabled}>
      <legend>Rating</legend>
      <div>
        {Array.from({ length: 5 }, (_, index) => {
          const rating = index + 1;
          return (
            <button
              type="button"
              key={rating}
              className={rating <= safeValue ? "active" : ""}
              aria-label={`${rating} out of 5 stars`}
              aria-pressed={safeValue === rating}
              onClick={() => onChange(rating)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "ArrowUp") {
                  event.preventDefault();
                  onChange(Math.min(5, safeValue + 1));
                }
                if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
                  event.preventDefault();
                  onChange(Math.max(1, safeValue - 1));
                }
              }}
            >
              <StarIcon filled={rating <= safeValue} />
            </button>
          );
        })}
      </div>
      <span>{safeValue} / 5</span>
    </fieldset>
  );
}

function ReviewImages({ images, gameTitle }) {
  if (!Array.isArray(images) || images.length === 0) return null;

  return (
    <div className="my-reviews-images">
      {images.map((image, index) => (
        <img
          key={image.id || image.image}
          src={image.image}
          alt={`${gameTitle} review attachment ${index + 1}`}
          loading="lazy"
        />
      ))}
    </div>
  );
}

function ReviewEditor({ review, saving, error, onCancel, onSave }) {
  const [rating, setRating] = useState(review.rating);
  const [body, setBody] = useState(review.body || "");
  const textareaRef = useRef(null);
  const trimmedBody = body.trim();
  const canSubmit =
    !saving &&
    trimmedBody.length > 0 &&
    trimmedBody.length <= MAX_REVIEW_LENGTH;

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const submit = (event) => {
    event.preventDefault();
    if (canSubmit) onSave({ rating, body: trimmedBody });
  };

  return (
    <form className="my-reviews-editor" onSubmit={submit}>
      <StarRating
        value={rating}
        editable
        disabled={saving}
        onChange={setRating}
      />
      <label>
        <span>Review</span>
        <textarea
          ref={textareaRef}
          value={body}
          maxLength={MAX_REVIEW_LENGTH}
          rows={5}
          disabled={saving}
          aria-invalid={Boolean(error)}
          onChange={(event) => setBody(event.target.value)}
        />
      </label>
      <div className="my-reviews-editor-meta">
        <span>
          {body.length} / {MAX_REVIEW_LENGTH}
        </span>
        {error && <p role="alert">{error}</p>}
      </div>
      <div className="my-reviews-editor-actions">
        <button
          type="button"
          className="secondary"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button type="submit" className="primary" disabled={!canSubmit}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function MyReviewCard({
  review,
  editing,
  saving,
  deleting,
  actionError,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
}) {
  const game = review.game || {};
  const title = game.title || "Untitled game";
  const created = new Date(review.created_at).getTime();
  const updated = new Date(review.updated_at).getTime();
  const wasEdited =
    Number.isFinite(created) &&
    Number.isFinite(updated) &&
    Math.abs(updated - created) > 1000;

  return (
    <article className="my-review-card">
      <Link
        className="my-review-cover"
        to={`/games/${game.id}`}
        aria-label={`Open ${title}`}
      >
        {game.cover ? (
          <img src={game.cover} alt="" loading="lazy" />
        ) : (
          <span aria-hidden="true">S</span>
        )}
      </Link>

      <div className="my-review-content">
        <div className="my-review-heading">
          <div>
            <Link to={`/games/${game.id}`} className="my-review-title">
              {title}
            </Link>
            {game.developer && <p>{game.developer}</p>}
          </div>
          <span className="my-review-date">
            {wasEdited ? "Updated" : "Published"}{" "}
            {formatDate(review.updated_at)}
          </span>
        </div>

        {editing ? (
          <ReviewEditor
            key={review.id}
            review={review}
            saving={saving}
            error={actionError}
            onCancel={onCancelEdit}
            onSave={onSave}
          />
        ) : (
          <>
            <StarRating value={review.rating} />
            <p className="my-review-body">{review.body}</p>
            <ReviewImages images={review.images} gameTitle={title} />
            {actionError && (
              <p className="my-review-action-error" role="alert">
                {actionError}
              </p>
            )}
            <div className="my-review-actions">
              <Link to={`/games/${game.id}#reviews`}>View game</Link>
              <button type="button" onClick={onStartEdit} disabled={deleting}>
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
          </>
        )}
      </div>
    </article>
  );
}

function MyReviewsPage() {
  const [payload, setPayload] = useState({
    count: 0,
    next: null,
    previous: null,
    results: [],
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [actionErrors, setActionErrors] = useState({});

  const loadPage = useCallback(async (targetPage, signal) => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await getMyReviews({
        page: targetPage,
        pageSize: PAGE_SIZE,
        signal,
      });
      setPayload(data);
    } catch (error) {
      if (isCanceledRequest(error)) return;
      setLoadError(getErrorMessage(error, "Unable to load your reviews."));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timerId = window.setTimeout(() => {
      loadPage(page, controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timerId);
      controller.abort();
    };
  }, [loadPage, page]);

  const totalPages = Math.max(1, Math.ceil(payload.count / PAGE_SIZE));
  const pageLabel = useMemo(
    () => `Page ${page} of ${totalPages}`,
    [page, totalPages],
  );

  const setActionError = (reviewId, message = "") => {
    setActionErrors((current) => ({ ...current, [reviewId]: message }));
  };

  const handleSave = async (review, values) => {
    setSavingId(review.id);
    setActionError(review.id);
    try {
      const updated = await updateGameReview(review.game.id, review.id, values);
      setPayload((current) => ({
        ...current,
        results: current.results.map((item) =>
          item.id === review.id
            ? {
                ...item,
                rating: updated.rating,
                body: updated.body,
                images: updated.images ?? item.images,
                updated_at: updated.updated_at,
              }
            : item,
        ),
      }));
      setEditingId(null);
    } catch (error) {
      setActionError(
        review.id,
        getErrorMessage(error, "Unable to update your review."),
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (review) => {
    if (
      !window.confirm(
        `Delete your review of ${review.game?.title || "this game"}? This cannot be undone.`,
      )
    ) {
      return;
    }

    setDeletingId(review.id);
    setActionError(review.id);
    try {
      await deleteGameReviewById(review.game.id, review.id);
      setEditingId((current) => (current === review.id ? null : current));
      const targetPage =
        payload.results.length === 1 && page > 1 ? page - 1 : page;
      if (targetPage !== page) setPage(targetPage);
      else await loadPage(page);
    } catch (error) {
      setActionError(
        review.id,
        getErrorMessage(error, "Unable to delete your review."),
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="my-reviews-page">
      <header className="my-reviews-header">
        <div>
          <Link to="/profile" className="my-reviews-back">
            ← Back to profile
          </Link>
          <span className="my-reviews-kicker">Your activity</span>
          <h1>My Reviews</h1>
          <p>View and manage every game review you have published.</p>
        </div>
        {!loading && !loadError && (
          <div
            className="my-reviews-count"
            aria-label={`${payload.count} reviews`}
          >
            <strong>{payload.count}</strong>
            <span>{payload.count === 1 ? "review" : "reviews"}</span>
          </div>
        )}
      </header>

      {loading ? (
        <section className="my-reviews-state" role="status">
          <span className="my-reviews-spinner" aria-hidden="true" />
          <strong>Loading your reviews</strong>
          <p>Collecting your latest ratings and thoughts.</p>
        </section>
      ) : loadError ? (
        <section className="my-reviews-state is-error" role="alert">
          <span aria-hidden="true">!</span>
          <strong>Your reviews could not be loaded</strong>
          <p>{loadError}</p>
          <button type="button" onClick={() => loadPage(page)}>
            Try again
          </button>
        </section>
      ) : payload.results.length === 0 ? (
        <section className="my-reviews-state is-empty">
          <span aria-hidden="true">★</span>
          <strong>No reviews yet</strong>
          <p>
            Explore the catalog, pick a game you own, and share your experience.
          </p>
          <Link to="/catalog">Browse games</Link>
        </section>
      ) : (
        <>
          <section className="my-reviews-list" aria-label="Your reviews">
            {payload.results.map((review) => (
              <MyReviewCard
                key={review.id}
                review={review}
                editing={editingId === review.id}
                saving={savingId === review.id}
                deleting={deletingId === review.id}
                actionError={actionErrors[review.id] || ""}
                onStartEdit={() => {
                  setActionError(review.id);
                  setEditingId(review.id);
                }}
                onCancelEdit={() => {
                  setActionError(review.id);
                  setEditingId(null);
                }}
                onSave={(values) => handleSave(review, values)}
                onDelete={() => handleDelete(review)}
              />
            ))}
          </section>

          {totalPages > 1 && (
            <nav
              className="my-reviews-pagination"
              aria-label="My Reviews pagination"
            >
              <button
                type="button"
                disabled={!payload.previous || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                ← Previous
              </button>
              <span>{pageLabel}</span>
              <button
                type="button"
                disabled={!payload.next || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Next →
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

export default MyReviewsPage;
