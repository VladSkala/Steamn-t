import StarRatingInput from "../components/StarRatingInput";
import { t, useLocale } from "../i18n/index.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { deleteGameReviewById, getMyReviews, updateGameReview } from "../api/reviews";
import Pagination from "../components/Pagination";
import ReviewImageGallery from "../components/ReviewImageGallery";
const PAGE_SIZE = 10;
const MAX_REVIEW_LENGTH = 4000;
const isCanceledRequest = error => error?.code === "ERR_CANCELED" || error?.name === "CanceledError" || error?.name === "AbortError";
const formatDate = value => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return t("Unknown date");
  return new Intl.DateTimeFormat(document.documentElement.dataset.locale || "en", {
    day: "numeric",
    month: "short",
    year: "numeric"
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
    return t("The review service is temporarily unavailable.");
  }
  return fallback;
};
function StarIcon({
  filled
}) {
  useLocale();
  return <svg viewBox="0 0 24 24" aria-hidden="true">
      <path className={filled ? "filled" : ""} d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
    </svg>;
}
function StarRating({
  value,
  editable = false,
  disabled = false,
  onChange
}) {
  useLocale();
  const safeValue = Math.min(5, Math.max(1, Number(value) || 1));
  if (!editable) {
    return <div className="my-reviews-stars" role="img" aria-label={t("{rating} out of 5 stars", { rating: safeValue })}>
        {Array.from({
        length: 5
      }, (_, index) => <span key={index + 1}>
            <StarIcon filled={index < safeValue} />
          </span>)}
      </div>;
  }
  return <StarRatingInput value={safeValue} disabled={disabled} onChange={onChange} />;
}

function ReviewImages({
  images,
  gameTitle
}) {
  useLocale();
  if (!Array.isArray(images) || images.length === 0) return null;
  return <ReviewImageGallery images={images.map((image, index) => ({ ...image, alt: t("{title} review attachment {index}", { title: gameTitle, index: index + 1 }) }))} title={gameTitle} className="my-reviews-images" itemClassName="my-reviews-image-tile" />;
}
function ReviewEditor({
  review,
  saving,
  error,
  onCancel,
  onSave
}) {
  useLocale();
  const [rating, setRating] = useState(review.rating);
  const [body, setBody] = useState(review.body || "");
  const textareaRef = useRef(null);
  const trimmedBody = body.trim();
  const canSubmit = !saving && trimmedBody.length > 0 && trimmedBody.length <= MAX_REVIEW_LENGTH;
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);
  const submit = event => {
    event.preventDefault();
    if (canSubmit) onSave({
      rating,
      body: trimmedBody
    });
  };
  return <form className="my-reviews-editor" onSubmit={submit}>
      <StarRating value={rating} editable disabled={saving} onChange={setRating} />
      <ReviewImages images={review.images} gameTitle={review.game?.title || t("Game")} />
      <label>
        <span>{t("Review")}</span>
        <textarea ref={textareaRef} value={body} maxLength={MAX_REVIEW_LENGTH} rows={5} disabled={saving} aria-invalid={Boolean(error)} onChange={event => setBody(event.target.value)} />
      </label>
      <div className="my-reviews-editor-meta">
        <span>
          {body.length} / {MAX_REVIEW_LENGTH}
        </span>
        {error && <p role="alert">{t(error)}</p>}
      </div>
      <div className="my-reviews-editor-actions">
        <button type="button" className="secondary" onClick={onCancel} disabled={saving}>{t("Cancel")}</button>
        <button type="submit" className="primary" disabled={!canSubmit}>
          {saving ? t("Saving…") : t("Save changes")}
        </button>
      </div>
    </form>;
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
  onDelete
}) {
  useLocale();
  const game = review.game || {};
  const title = game.title || t("Untitled game");
  const created = new Date(review.created_at).getTime();
  const updated = new Date(review.updated_at).getTime();
  const wasEdited = Number.isFinite(created) && Number.isFinite(updated) && Math.abs(updated - created) > 1000;
  return <article className="my-review-card">
      <Link className="my-review-cover" to={`/games/${game.id}`} aria-label={t("Open {title}", { title })}>
        {game.cover ? <img src={game.cover} alt="" loading="lazy" /> : <span aria-hidden="true">S</span>}
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
            {wasEdited ? t("Updated") : t("Published")}{" "}
            {formatDate(review.updated_at)}
          </span>
        </div>

        {editing ? <ReviewEditor key={review.id} review={review} saving={saving} error={t(actionError)} onCancel={onCancelEdit} onSave={onSave} /> : <>
            <StarRating value={review.rating} />
            <p className="my-review-body">{review.body}</p>
            <ReviewImages images={review.images} gameTitle={title} />
            {actionError && <p className="my-review-action-error" role="alert">
                {t(actionError)}
              </p>}
            <div className="my-review-actions">
              <Link to={`/games/${game.id}#reviews`}>{t("View game")}</Link>
              <button type="button" onClick={onStartEdit} disabled={deleting}>{t("Edit")}</button>
              <button type="button" className="danger" onClick={onDelete} disabled={deleting}>
                {deleting ? t("Deleting…") : t("Delete")}
              </button>
            </div>
          </>}
      </div>
    </article>;
}
function MyReviewsPage() {
  useLocale();
  const [payload, setPayload] = useState({
    count: 0,
    next: null,
    previous: null,
    results: []
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
        signal
      });
      setPayload(data);
    } catch (error) {
      if (isCanceledRequest(error)) return;
      setLoadError(getErrorMessage(error, t("Unable to load your reviews.")));
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
  const setActionError = (reviewId, message = "") => {
    setActionErrors(current => ({
      ...current,
      [reviewId]: message
    }));
  };
  const handleSave = async (review, values) => {
    setSavingId(review.id);
    setActionError(review.id);
    try {
      const updated = await updateGameReview(review.game.id, review.id, values);
      setPayload(current => ({
        ...current,
        results: current.results.map(item => item.id === review.id ? {
          ...item,
          rating: updated.rating,
          body: updated.body,
          images: updated.images ?? item.images,
          updated_at: updated.updated_at
        } : item)
      }));
      setEditingId(null);
    } catch (error) {
      setActionError(review.id, getErrorMessage(error, t("Unable to update your review.")));
    } finally {
      setSavingId(null);
    }
  };
  const handleDelete = async review => {
    if (!window.confirm(t("Delete your review of {title}? This cannot be undone.", { title: review.game?.title || t("this game") }))) {
      return;
    }
    setDeletingId(review.id);
    setActionError(review.id);
    try {
      await deleteGameReviewById(review.game.id, review.id);
      setEditingId(current => current === review.id ? null : current);
      const targetPage = payload.results.length === 1 && page > 1 ? page - 1 : page;
      if (targetPage !== page) setPage(targetPage);else await loadPage(page);
    } catch (error) {
      setActionError(review.id, getErrorMessage(error, t("Unable to delete your review.")));
    } finally {
      setDeletingId(null);
    }
  };
  return <div className="my-reviews-page">
      <header className="my-reviews-header">
        <div>
          <Link to="/profile" className="my-reviews-back">{t("← Back to profile")}</Link>
          <span className="my-reviews-kicker">{t("Your activity")}</span>
          <h1>{t("My Reviews")}</h1>
          <p>{t("View and manage every game review you have published.")}</p>
        </div>
        {!loading && !loadError && <div className="my-reviews-count" aria-label={t(payload.count === 1 ? "{count} review" : "{count} reviews", { count: payload.count })}>
            <strong>{payload.count}</strong>
            <span>{payload.count === 1 ? t("review") : t("reviews")}</span>
          </div>}
      </header>

      {loading ? <section className="my-reviews-state" role="status">
          <span className="my-reviews-spinner" aria-hidden="true" />
          <strong>{t("Loading your reviews")}</strong>
          <p>{t("Collecting your latest ratings and thoughts.")}</p>
        </section> : loadError ? <section className="my-reviews-state is-error" role="alert">
          <span aria-hidden="true">!</span>
          <strong>{t("Your reviews could not be loaded")}</strong>
          <p>{t(loadError)}</p>
          <button type="button" onClick={() => loadPage(page)}>{t("Try again")}</button>
        </section> : payload.results.length === 0 ? <section className="my-reviews-state is-empty">
          <span aria-hidden="true">★</span>
          <strong>{t("No reviews yet")}</strong>
          <p>{t("Explore the catalog, pick a game you own, and share your experience.")}</p>
          <Link to="/catalog">{t("Browse games")}</Link>
        </section> : <>
          <section className="my-reviews-list" aria-label={t("Your reviews")}>
            {payload.results.map(review => <MyReviewCard key={review.id} review={review} editing={editingId === review.id} saving={savingId === review.id} deleting={deletingId === review.id} actionError={actionErrors[review.id] || ""} onStartEdit={() => {
          setActionError(review.id);
          setEditingId(review.id);
        }} onCancelEdit={() => {
          setActionError(review.id);
          setEditingId(null);
        }} onSave={values => handleSave(review, values)} onDelete={() => handleDelete(review)} />)}
          </section>

          <Pagination page={page} totalPages={totalPages} totalItems={payload.count} pageSize={PAGE_SIZE} disabled={loading} label={t("My Reviews pagination")} onPageChange={setPage} />
        </>}
    </div>;
}
export default MyReviewsPage;
