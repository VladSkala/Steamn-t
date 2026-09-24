import { t, useLocale } from "../../i18n/index.js";
import { useState } from "react";
import { Link } from "react-router-dom";
import { communityPostPath } from "../../utils/communityPostLinks";
const hideBrokenImage = event => {
  event.currentTarget.hidden = true;
};
const dateFormatter = new Intl.DateTimeFormat(document.documentElement.dataset.locale || "en", {
  day: "2-digit",
  month: "short",
  year: "numeric"
});
const formatDate = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? t("Recently") : dateFormatter.format(date);
};
const actionErrorMessage = (error, fallback) => {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (!error?.response) {
    return t("The community service is unavailable. Check the backend and try again.");
  }
  return fallback;
};
function AuthorAvatar({
  author
}) {
  useLocale();
  const name = author?.username?.trim() || t("Steamnt player");
  return <span className="library-post-avatar" aria-hidden="true">
      <span>{name.charAt(0).toUpperCase()}</span>
      {author?.avatar && <img src={author.avatar} alt="" onError={hideBrokenImage} />}
    </span>;
}
function HeartIcon() {
  useLocale();
  return <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 5.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.3 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
    </svg>;
}
function CommentIcon() {
  useLocale();
  return <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5h14v11H9l-4 3V5Z" />
    </svg>;
}
export default function LibraryPostCard({
  post,
  compact = false,
  onLike,
  onComments,
  commentsOpen = false,
  onEdit,
  onDelete,
  deleteBusy = false,
  detailPage = false,
  children
}) {
  useLocale();
  const [likeBusy, setLikeBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const authorName = post.author?.username?.trim() || t("Steamnt player");
  const hasMedia = Boolean(post.media);
  const handleLike = async () => {
    if (!onLike || likeBusy) return;
    setLikeBusy(true);
    setActionError("");
    try {
      await onLike(post);
    } catch (error) {
      setActionError(actionErrorMessage(error, t("Your reaction could not be updated. Please try again.")));
    } finally {
      setLikeBusy(false);
    }
  };
  return <article className={`library-post-card post-kind-${post.kind}${compact ? " is-compact" : ""}${detailPage ? " is-detail" : ""}`} id={`post-${post.id}`}>
      <header className="library-post-header">
        <Link className="library-post-author" to={post.author?.id ? `/users/${post.author.id}` : communityPostPath(post.id)}>
          <AuthorAvatar author={post.author} />
          <div>
            <strong>{authorName}</strong>
            <time dateTime={post.created_at || undefined}>
              {formatDate(post.created_at)}
            </time>
          </div>
        </Link>
        <div className="library-post-header-actions">
          <span className="library-post-kind">{t(post.kind)}</span>
          {(onEdit || onDelete) && <div className="library-post-owner-actions" aria-label={t("Post actions")}>
              {onEdit && <button type="button" onClick={onEdit} disabled={deleteBusy}>{t("Edit")}</button>}
              {onDelete && <button type="button" onClick={onDelete} disabled={deleteBusy}>
                  {deleteBusy ? t("Deleting…") : t("Delete")}
                </button>}
            </div>}
        </div>
      </header>

      {hasMedia && <div className="library-post-media">
          {post.kind === "video" && /\.(mp4|webm)(\?|$)/i.test(post.media) ? <video controls preload="metadata" src={post.media} aria-label={post.title} /> : <>
              <img className="library-post-media-backdrop" src={post.media} alt="" aria-hidden="true" loading="lazy" decoding="async" onError={hideBrokenImage} />
              {detailPage ? <img className="library-post-media-image" src={post.media} alt={post.title || ""} loading="lazy" decoding="async" onError={hideBrokenImage} /> : <Link className="library-post-media-link" to={communityPostPath(post.id)} aria-label={t("Open publication: {title}", { title: post.title || t("Community post") })}><img className="library-post-media-image" src={post.media} alt={post.title || ""} loading="lazy" decoding="async" onError={hideBrokenImage} /></Link>}
            </>}
          {post.kind === "video" && <span className="library-post-play" aria-label={t("Video preview")}>
              ▶
            </span>}
        </div>}

      <div className="library-post-copy">
        {post.game && <Link className="library-post-game" to={`/games/${post.game.id}`}>
            {post.game.title}
          </Link>}
        <h3><Link to={communityPostPath(post.id)}>{post.title}</Link></h3>
        {post.body && <p>{post.body}</p>}
      </div>

      <footer className="library-post-actions">
        <button type="button" className={post.is_liked ? "active" : ""} aria-pressed={post.is_liked} aria-busy={likeBusy} aria-label={t("Like post, {count} reactions", { count: post.like_count })} onClick={handleLike} disabled={likeBusy || !onLike} title={!onLike ? t("Sign in to react") : undefined}>
          <HeartIcon />
          <span>{post.like_count}</span>
        </button>
        <button type="button" className={commentsOpen ? "active" : ""} aria-expanded={commentsOpen} aria-label={t("Comments, {count}", { count: post.comment_count })} onClick={() => onComments?.(post)} disabled={!onComments}>
          <CommentIcon />
          <span>{post.comment_count}</span>
        </button>

      </footer>

      {actionError && <div className="library-post-action-error" role="alert">
          <span>{t(actionError)}</span>
          <button type="button" onClick={() => setActionError("")}>{t("Dismiss")}</button>
        </div>}
      {children}
    </article>;
}
