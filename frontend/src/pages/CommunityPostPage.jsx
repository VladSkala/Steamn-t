import { t, useLocale } from "../i18n/index.js";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getCommunityPost } from "../api/community";
import { togglePostReaction } from "../api/library";
import CatalogFeedback from "../components/CatalogFeedback";
import PostComments from "../components/community/PostComments";
import LibraryPostCard from "../components/library/LibraryPostCard";
import { useAuth } from "../hooks/useAuth";
import { createReturnLocation } from "../utils/returnLocation";
const canceled = error => error?.code === "ERR_CANCELED" || error?.name === "CanceledError" || error?.name === "AbortError";
export default function CommunityPostPage() {
  useLocale();
  const {
    postId
  } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    isAuthenticated
  } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${postId}:${reloadKey}`;
  const [result, setResult] = useState({
    key: "",
    post: null,
    error: ""
  });
  const loading = result.key !== requestKey;
  const post = loading ? null : result.post;
  const error = loading ? "" : result.error;
  useEffect(() => {
    const controller = new AbortController();
    getCommunityPost(postId, {
      signal: controller.signal
    }).then(item => {
      if (!controller.signal.aborted) {
        setResult({
          key: requestKey,
          post: item,
          error: ""
        });
      }
    }).catch(requestError => {
      if (controller.signal.aborted || canceled(requestError)) return;
      const message = requestError?.response?.status === 404 ? "not-found" : requestError?.response?.data?.detail || t("The publication could not be loaded.");
      setResult({
        key: requestKey,
        post: null,
        error: message
      });
    });
    return () => controller.abort();
  }, [postId, requestKey]);
  useEffect(() => {
    if (!loading && post && location.hash === "#comments") {
      document.getElementById("comments")?.focus({
        preventScroll: false
      });
    }
  }, [loading, location.hash, post]);
  const like = async () => {
    if (!isAuthenticated) {
      navigate("/login", {
        state: {
          from: createReturnLocation(location)
        }
      });
      return;
    }
    const update = await togglePostReaction(post.id);
    setResult(current => ({
      ...current,
      post: {
        ...current.post,
        ...update
      }
    }));
  };
  return <div className="community-page community-post-page">
      <header className="community-post-toolbar">
        <Link className="community-back-link" to="/community"><span aria-hidden="true">←</span>{t("Back to community")}</Link>
      </header>
      <section className="community-feed community-post-feed" aria-live="polite">
        {post && <h1 className="sr-only">{post.title}</h1>}
        {loading && <CatalogFeedback kind="loading" title={t("Loading publication")} message={t("Fetching the selected community post.")} />}
        {!loading && error && <CatalogFeedback kind={error === "not-found" ? "empty" : "error"} title={error === "not-found" ? t("Publication unavailable") : t("Publication could not be loaded")} message={error === "not-found" ? t("This publication was removed, hidden, or does not exist.") : error} onRetry={error === "not-found" ? undefined : () => setReloadKey(value => value + 1)} />}
        {!loading && !error && post && <LibraryPostCard post={post} detailPage onLike={like} onComments={() => document.getElementById("comments")?.focus({
        preventScroll: false
      })} commentsOpen>
            <PostComments post={post} canComment={isAuthenticated} onRemoved={() => setResult(current => ({
          ...current,
          post: {
            ...current.post,
            comment_count: Math.max(0, current.post.comment_count - 1)
          }
        }))} onCreated={() => setResult(current => ({
          ...current,
          post: {
            ...current.post,
            comment_count: current.post.comment_count + 1
          }
        }))} />
          </LibraryPostCard>}
      </section>
    </div>;
}
