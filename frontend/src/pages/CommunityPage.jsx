import { t, useLocale } from "../i18n/index.js";
import Pagination from "../components/Pagination";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { createCommunityPost, deleteCommunityPost, updateCommunityPost } from "../api/community";
import { getLibrary, togglePostReaction } from "../api/library";
import CatalogFeedback from "../components/CatalogFeedback";
import PostComments from "../components/community/PostComments";
import LibraryPostCard from "../components/library/LibraryPostCard";
import { useAuth } from "../hooks/useAuth";
import useCommunityFeed from "../hooks/useCommunityFeed";
import { createReturnLocation } from "../utils/returnLocation";
const scopes = [["all", "Discover"], ["friends", "Friends"], ["following", "Following"], ["library", "My library"], ["mine", "My posts"]];
const kinds = [["all", "All sections"], ["community", "Community"], ["forum", "Forum"], ["guide", "Guides"], ["screenshot", "Screenshots"], ["video", "Videos"], ["news", "News"]];
const writableKinds = [["community", "Community"], ["forum", "Forum"], ["guide", "Guide"], ["screenshot", "Screenshot"], ["video", "Video"]];
const apiError = (error, fallback) => {
  const data = error?.response?.data;
  if (!error?.response) {
    return t("The community service is unavailable. Check the backend and try again.");
  }
  if (typeof data?.detail === "string") return data.detail;
  if (data && typeof data === "object") {
    const message = Object.values(data).flat().find(value => typeof value === "string");
    if (message) return message;
  }
  return fallback;
};
function CommunityComposer({
  games,
  editing,
  onCancel,
  onSaved
}) {
  useLocale();
  const [form, setForm] = useState(() => editing ? {
    kind: editing.kind,
    title: editing.title,
    body: editing.body,
    game_id: editing.game?.id ? String(editing.game.id) : ""
  } : {
    kind: "community",
    title: "",
    body: "",
    game_id: ""
  });
  const dialogRef = useRef(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  const [upload, setUpload] = useState(null);
  const [preview, setPreview] = useState("");
  const needsMedia = ["screenshot", "video"].includes(form.kind);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);
  const [error, setError] = useState("");
  const update = (field, value) => {
    setForm(current => ({
      ...current,
      [field]: value
    }));
    setError("");
  };
  const submit = async event => {
    event.preventDefault();
    if (saving || !form.title.trim() || !needsMedia && !form.body.trim()) return;
    setSaving(true);
    setError("");
    let payload = {
      kind: form.kind,
      title: form.title.trim(),
      body: form.body.trim(),
      game_id: form.game_id ? Number(form.game_id) : null
    };
    if (upload) {
      const data = new FormData();
      for (const [key, value] of Object.entries(payload)) if (value !== null) data.append(key, value);
      data.append("media_file", upload);
      payload = data;
    }
    try {
      const post = editing ? await updateCommunityPost(editing.id, payload) : await createCommunityPost(payload);
      setForm({
        kind: "community",
        title: "",
        body: "",
        game_id: ""
      });
      setUpload(null);
      setPreview("");
      onSaved(post, Boolean(editing));
    } catch (requestError) {
      setError(apiError(requestError, t("Your post could not be saved.")));
    } finally {
      setSaving(false);
    }
  };
  return <dialog ref={dialogRef} onCancel={event => {
    event.preventDefault();
    if (!saving) onCancel();
  }} className="community-composer community-composer-dialog" aria-labelledby="community-composer-title">
      <div className="community-panel-heading">
        <div>
          <span className="section-kicker">
            {editing ? t("EDIT POST") : t("SHARE")}
          </span>
          <h2 id="community-composer-title">
            {editing ? t("Update your post") : t("Create a community post")}
          </h2>
        </div>
        {<button type="button" className="community-text-button" onClick={onCancel} disabled={saving}>{t("Close")}</button>}
      </div>
      <form onSubmit={submit}>
        <div className="community-form-row">
          <label>{t("Post type")}<span aria-hidden="true">&nbsp;</span><select value={form.kind} onChange={event => update("kind", event.target.value)} disabled={saving}>
              {writableKinds.map(([value, label]) => <option key={value} value={value}>
                  {t(label)}
                </option>)}
            </select>
          </label>
          <label>{t("Game")}<span>{needsMedia ? t("(required, owned game)") : t("(optional)")}</span>
            <select value={form.game_id} onChange={event => update("game_id", event.target.value)} disabled={saving}>
              <option value="">{t("No game")}</option>
              {games.map(item => <option key={item.game.id} value={item.game.id}>
                  {item.game.title}
                </option>)}
            </select>
          </label>
        </div>
        <label>{t("Title")}<input autoFocus={Boolean(editing)} value={form.title} maxLength={240} onChange={event => update("title", event.target.value)} placeholder={t("What would help other players?")} disabled={saving} required />
        </label>
        <label>{t("Post")}<textarea value={form.body} maxLength={5000} rows={5} onChange={event => update("body", event.target.value)} placeholder={t("Share a useful update, question, or guide…")} disabled={saving} required={!needsMedia} />
        </label>
        {needsMedia && <label>{form.kind === "video" ? t("Video (MP4/WebM, up to 50 MB)") : t("Screenshot (JPG/PNG/WebP, up to 5 MB)")}<input type="file" accept={form.kind === "video" ? ".mp4,.webm" : ".jpg,.jpeg,.png,.webp"} onChange={event => {
          const file = event.target.files[0];
          setUpload(file || null);
          setPreview(file ? URL.createObjectURL(file) : "");
        }} required={!editing?.media} disabled={saving} />{upload && preview && (form.kind === "video" ? <video controls src={preview} style={{
          maxHeight: 240,
          maxWidth: "100%"
        }} /> : <img src={preview} alt={t("Upload preview")} style={{
          maxHeight: 240,
          maxWidth: "100%"
        }} />)}</label>}
        {error && <div className="community-form-message error" role="alert">
            {t(error)}
          </div>}
        <div className="community-form-actions">
          <span>{form.body.length}/5000</span>
          <button type="submit" disabled={saving || !form.title.trim() || !needsMedia && !form.body.trim() || needsMedia && (!form.game_id || !upload && !editing?.media)}>
            {saving ? t("Saving…") : editing ? t("Save changes") : t("Publish post")}
          </button>
        </div>
      </form>
    </dialog>;
}
export default function CommunityPage() {
  useLocale();
  const {
    isAuthenticated
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const game = params.get("game") || undefined;
  const scope = params.get("scope") || "all";
  const kind = params.get("kind") || "all";
  const ordering = params.get("ordering") || "latest";
  const search = params.get("search") || "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [searchInput, setSearchInput] = useState(search);
  const updateFilter = (key, value) => setParams(current => {
    current.set(key, String(value));
    if (key !== "page") current.set("page", "1");
    return current;
  });
  const setScope = value => updateFilter("scope", value);
  const setKind = value => updateFilter("kind", value);
  const setOrdering = value => updateFilter("ordering", value);
  const setSearch = value => updateFilter("search", value);
  const [openPostId, setOpenPostId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [games, setGames] = useState([]);
  const [actionError, setActionError] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(null);
  const [success, setSuccess] = useState("");
  const effectiveScope = isAuthenticated ? scope : "all";
  const filters = useMemo(() => ({
    scope: effectiveScope,
    kind,
    ordering,
    search,
    page,
    game
  }), [effectiveScope, kind, ordering, search, page, game]);
  const {
    data,
    loading,
    error,
    reload,
    updatePost,
    removePost
  } = useCommunityFeed(filters);
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const controller = new AbortController();
    getLibrary({
      signal: controller.signal
    }).then(setGames).catch(() => {
      if (!controller.signal.aborted) setGames([]);
    });
    return () => controller.abort();
  }, [isAuthenticated]);
  const chooseFilter = (setter, value) => {
    setter(value);
  };
  const like = async post => {
    if (!isAuthenticated) {
      navigate("/login", {
        state: {
          from: createReturnLocation(location)
        }
      });
      return;
    }
    updatePost(post.id, await togglePostReaction(post.id));
  };
  const remove = async post => {
    if (!window.confirm(t("Delete “{title}”? This cannot be undone.", { title: post.title }))) return;
    setDeleteBusy(post.id);
    setActionError("");
    try {
      await deleteCommunityPost(post.id);
      removePost(post.id);
      if (editing?.id === post.id) setEditing(null);
      setSuccess(t("Post deleted."));
    } catch (requestError) {
      setActionError(apiError(requestError, t("The post could not be deleted.")));
    } finally {
      setDeleteBusy(null);
    }
  };
  const saved = (post, wasEditing) => {
    setEditing(null);
    setComposerOpen(false);
    setSuccess(wasEditing ? t("Post updated.") : t("Post published."));
    if (wasEditing) updatePost(post.id, post);else {
      setParams({
        scope: "mine"
      });
      setSearchInput("");
      reload();
    }
  };
  return <div className="community-page">
      <header className="community-hero">
        <div>
          <span className="section-kicker">{t("STEAMN’T COMMUNITY")}</span>
          <h1>{t("Discover what players are sharing")}</h1>
          <p>{t("Find your next discussion, share a moment, and meet other players.")}</p>
        </div>
        {isAuthenticated && <button type="button" className="community-primary-link" onClick={() => {
        setEditing(null);
        setComposerOpen(true);
      }}>{t("Create post")}</button>}
        {!isAuthenticated && <Link to="/login" state={{
        from: createReturnLocation(location)
      }} className="community-primary-link">{t("Sign in to participate")}</Link>}
      </header>

      {game && <p className="community-game-filter">{t("Showing posts for this game.")}<Link to={`/games/${game}`}>{t("Game details")}</Link> · <Link to="/community">{t("All games")}</Link></p>}
      {isAuthenticated && composerOpen && <CommunityComposer key={editing?.id ?? "new"} games={games} editing={editing} onCancel={() => {
      setEditing(null);
      setComposerOpen(false);
    }} onSaved={saved} />}
      {success && <div className="community-form-message success" role="status">
          ✓ {success}
        </div>}
      {actionError && <div className="community-form-message error" role="alert">
          {t(actionError)}
        </div>}

      <section className="community-toolbar" aria-label={t("Community filters")}>
        <div className="community-scope-tabs" role="group" aria-label={t("Feed source")}>
          {scopes.filter(([value]) => isAuthenticated || value === "all").map(([value, label]) => <button key={value} type="button" className={scope === value ? "active" : ""} onClick={() => chooseFilter(setScope, value)}>
                {t(label)}
              </button>)}
        </div>
        <form onSubmit={event => {
        event.preventDefault();
        setSearch(searchInput.trim());
      }}>
          <label className="sr-only" htmlFor="community-search">{t("Search community")}</label>
          <input id="community-search" type="search" value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder={t("Search posts, games, or players")} />
          <button type="submit">{t("Search")}</button>
        </form>
        <label>
          <span className="sr-only">{t("Post section")}</span>
          <select value={kind} onChange={event => chooseFilter(setKind, event.target.value)}>
            {kinds.map(([value, label]) => <option key={value} value={value}>
                {t(label)}
              </option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">{t("Post ordering")}</span>
          <select value={ordering} onChange={event => chooseFilter(setOrdering, event.target.value)}>
            <option value="latest">{t("Latest")}</option>
            <option value="popular">{t("Popular")}</option>
          </select>
        </label>
      </section>

      <section className="community-feed community-feed-grid" aria-live="polite">
        {loading && <CatalogFeedback kind="loading" title={t("Loading community")} message={t("Collecting published posts and conversations.")} />}
        {!loading && error && <CatalogFeedback kind="error" title={t("Community unavailable")} message={t(error)} onRetry={reload} />}
        {!loading && !error && data?.items.length === 0 && <section className="community-empty">
            <span aria-hidden="true">✦</span>
            <h2>{t("No posts match these filters")}</h2>
            <p>{t("Clear the filters or publish the first post for this view.")}</p>
            <button type="button" onClick={() => {
          setParams({});
          setSearchInput("");
        }}>{t("Reset filters")}</button>
          </section>}
        {!loading && !error && data?.items.map(post => <LibraryPostCard key={post.id} post={post} onLike={like} onComments={() => setOpenPostId(current => current === post.id ? null : post.id)} commentsOpen={openPostId === post.id} onEdit={post.is_owner ? () => {
        setEditing(post);
        setComposerOpen(true);
      } : undefined} onDelete={post.is_owner ? () => remove(post) : undefined} deleteBusy={deleteBusy === post.id}>
              {openPostId === post.id && <PostComments post={post} canComment={isAuthenticated} onRemoved={() => updatePost(post.id, {
          comment_count: Math.max(0, post.comment_count - 1)
        })} onCreated={() => updatePost(post.id, {
          comment_count: post.comment_count + 1
        })} />}
            </LibraryPostCard>)}
      </section>

      {!loading && !error && Number(data?.pagination?.total_pages || 0) > 1 && <Pagination page={Number(data.pagination.page)} totalPages={Number(data.pagination.total_pages)} onPageChange={value => updateFilter("page", value)} />}
    </div>;
}
