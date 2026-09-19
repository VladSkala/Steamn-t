import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { createPostComment, getPostComments } from "../../api/library";
import { createReturnLocation } from "../../utils/returnLocation";
import { useAuth } from "../../hooks/useAuth";
import api from "../../api/client";

const canceled = (error) =>
  error?.code === "ERR_CANCELED" ||
  error?.name === "CanceledError" ||
  error?.name === "AbortError";

export default function PostComments({ post, canComment, onCreated, onRemoved }) {
  const location = useLocation();
  const { user } = useAuth();
  const [editingId, setEditingId] = useState(null);
  const [editBody, setEditBody] = useState("");
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getPostComments(post.id, { signal: controller.signal })
      .then((items) => {
        if (!controller.signal.aborted) {
          setComments(items);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (controller.signal.aborted || canceled(error)) return;
        setLoadError(
          error?.response?.data?.detail ||
            (error?.response
              ? "Comments could not be loaded."
              : "The comments service is unavailable. Check the backend and try again."),
        );
        setLoading(false);
      });
    return () => controller.abort();
  }, [post.id, reloadKey]);

  const submit = async (event) => {
    event.preventDefault();
    const trimmedBody = body.trim();
    if (!trimmedBody || submitting) return;
    setSubmitting(true);
    setActionError("");
    try {
      const comment = await createPostComment(post.id, trimmedBody);
      setComments((current) => [...current, comment]);
      setBody("");
      onCreated?.(comment);
    } catch (error) {
      setActionError(
        error?.response?.data?.body?.[0] ||
          error?.response?.data?.detail ||
          (error?.response
            ? "Your comment could not be published."
            : "The comments service is unavailable. Check the backend and try again."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const updateComment = async (comment, remove = false) => {
    if (submitting || (remove && !window.confirm("Delete this comment?"))) return;
    setSubmitting(true); setActionError("");
    try {
      const url = `/library/posts/${post.id}/comments/${comment.id}/`;
      if (remove) { await api.delete(url); setComments((current) => current.filter((item) => item.id !== comment.id)); onRemoved?.(); }
      else { const { data } = await api.patch(url, { body: editBody }); setComments((current) => current.map((item) => item.id === comment.id ? data : item)); }
      setEditingId(null);
    } catch (error) { setActionError(error.response?.data?.detail || "Could not update your comment."); }
    finally { setSubmitting(false); }
  };

  return (
    <section
      className="library-comments"
      id="comments"
      tabIndex={-1}
      aria-label={`Comments on ${post.title}`}
    >
      {loading && <p role="status">Loading comments…</p>}
      {!loading && loadError && (
        <div className="library-comments-load-error" role="alert">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setLoadError("");
              setReloadKey((value) => value + 1);
            }}
          >
            Try again
          </button>
        </div>
      )}
      {!loading && !loadError && comments.length === 0 && (
        <p>Be the first to comment.</p>
      )}
      {!loading &&
        !loadError &&
        comments.map((comment) => (
          <article key={comment.id}>
            <Link to={`/users/${comment.author.id}`}><strong>{comment.author?.username || "Steamnt player"}</strong></Link>
            {editingId === comment.id ? <form onSubmit={(event) => { event.preventDefault(); updateComment(comment); }}><label className="sr-only" htmlFor={`edit-comment-${comment.id}`}>Edit comment</label><input id={`edit-comment-${comment.id}`} value={editBody} onChange={(event) => setEditBody(event.target.value)} maxLength={1200} required /><button disabled={submitting}>Save</button><button type="button" onClick={() => setEditingId(null)}>Cancel</button></form> : <p>{comment.body}</p>}
            {user?.id === comment.author?.id && editingId !== comment.id && <div><button type="button" disabled={submitting} onClick={() => { setEditingId(comment.id); setEditBody(comment.body); }}>Edit</button><button type="button" disabled={submitting} onClick={() => updateComment(comment, true)}>Delete</button></div>}
          </article>
        ))}
      {!loading && !loadError && canComment && (
        <form onSubmit={submit}>
          <label className="sr-only" htmlFor={`comment-${post.id}`}>
            Write a comment
          </label>
          <input
            id={`comment-${post.id}`}
            value={body}
            maxLength={1200}
            placeholder="Write a comment…"
            autoComplete="off"
            onChange={(event) => {
              setBody(event.target.value);
              setActionError("");
            }}
          />
          <button type="submit" disabled={submitting || !body.trim()}>
            {submitting ? "Posting…" : "Post"}
          </button>
        </form>
      )}
      {!loading && !loadError && !canComment && (
        <p className="community-sign-in-note">
          <Link
            to="/login"
            state={{ from: createReturnLocation(location) }}
          >
            Sign in
          </Link>{" "}
          to join the discussion.
        </p>
      )}
      {actionError && <small role="alert">{actionError}</small>}
    </section>
  );
}
