import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { communityPostPath } from "../../utils/communityPostLinks";

const hideBrokenImage = (event) => {
  event.currentTarget.hidden = true;
};

const dateFormatter = new Intl.DateTimeFormat(document.documentElement.dataset.locale || "en", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Recently" : dateFormatter.format(date);
};

const actionErrorMessage = (error, fallback) => {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (!error?.response) {
    return "The community service is unavailable. Check the backend and try again.";
  }
  return fallback;
};

function AuthorAvatar({ author }) {
  const name = author?.username?.trim() || "Steamnt player";
  return (
    <span className="library-post-avatar" aria-hidden="true">
      <span>{name.charAt(0).toUpperCase()}</span>
      {author?.avatar && (
        <img src={author.avatar} alt="" onError={hideBrokenImage} />
      )}
    </span>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 5.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.3 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5h14v11H9l-4 3V5Z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 13v6h14v-6" />
    </svg>
  );
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
  children,
}) {
  const [likeBusy, setLikeBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [shared, setShared] = useState(false);
  const sharedTimer = useRef(null);
  const authorName = post.author?.username?.trim() || "Steamnt player";
  const hasMedia = Boolean(post.media);

  useEffect(
    () => () => {
      if (sharedTimer.current) window.clearTimeout(sharedTimer.current);
    },
    [],
  );

  const handleLike = async () => {
    if (!onLike || likeBusy) return;
    setLikeBusy(true);
    setActionError("");
    try {
      await onLike(post);
    } catch (error) {
      setActionError(
        actionErrorMessage(
          error,
          "Your reaction could not be updated. Please try again.",
        ),
      );
    } finally {
      setLikeBusy(false);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}${communityPostPath(post.id)}`;
    setActionError("");
    try {
      if (navigator.share) {
        await navigator.share({ title: post.title, text: post.body, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        throw new Error("Sharing is not supported by this browser.");
      }
      setShared(true);
      if (sharedTimer.current) window.clearTimeout(sharedTimer.current);
      sharedTimer.current = window.setTimeout(() => setShared(false), 2200);
    } catch (error) {
      if (error?.name !== "AbortError") {
        setActionError(error?.message || "This post link could not be shared.");
      }
    }
  };

  return (
    <article
      className={`library-post-card post-kind-${post.kind}${compact ? " is-compact" : ""}`}
      id={`post-${post.id}`}
    >
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
          <span className="library-post-kind">{post.kind}</span>
          {(onEdit || onDelete) && (
            <div
              className="library-post-owner-actions"
              aria-label="Post actions"
            >
              {onEdit && (
                <button type="button" onClick={onEdit} disabled={deleteBusy}>
                  Edit
                </button>
              )}
              {onDelete && (
                <button type="button" onClick={onDelete} disabled={deleteBusy}>
                  {deleteBusy ? "Deleting…" : "Delete"}
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {hasMedia && (
        <div className="library-post-media">
          {post.kind === "video" && /\.(mp4|webm)(\?|$)/i.test(post.media) ? <video controls preload="metadata" src={post.media} aria-label={post.title} /> : <Link to={communityPostPath(post.id)} aria-label={`Open ${post.title}`}><img
            src={post.media}
            alt=""
            loading="lazy"
            decoding="async"
            onError={hideBrokenImage}
          /></Link>}
          {post.kind === "video" && (
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
        <h3><Link to={communityPostPath(post.id)}>{post.title}</Link></h3>
        {post.body && <p>{post.body}</p>}
      </div>

      <footer className="library-post-actions">
        <button
          type="button"
          className={post.is_liked ? "active" : ""}
          aria-pressed={post.is_liked}
          aria-busy={likeBusy}
          onClick={handleLike}
          disabled={likeBusy || !onLike}
          title={!onLike ? "Sign in to react" : undefined}
        >
          <HeartIcon />
          <span>{post.like_count}</span>
        </button>
        <button
          type="button"
          className={commentsOpen ? "active" : ""}
          aria-expanded={commentsOpen}
          onClick={() => onComments?.(post)}
          disabled={!onComments}
        >
          <CommentIcon />
          <span>{post.comment_count}</span>
        </button>
        <button type="button" onClick={handleShare}>
          <ShareIcon />
          <span>{shared ? "Copied" : "Share"}</span>
        </button>
      </footer>

      {actionError && (
        <div className="library-post-action-error" role="alert">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError("")}>
            Dismiss
          </button>
        </div>
      )}
      {children}
    </article>
  );
}
