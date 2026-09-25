import { t, useLocale } from "../i18n/index.js";
import Pagination from "../components/Pagination";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../api/client";
import { removeFriend, acceptFriendRequest, cancelFriendRequest, rejectFriendRequest } from "../api/friends";
import { useAuth } from "../hooks/useAuth";
import ReviewImageGallery from "../components/ReviewImageGallery";
export default function PublicProfilePage() {
  useLocale();
  const {
    userId
  } = useParams();
  return <PublicProfile key={userId} userId={userId} />;
}
function PublicProfile({
  userId
}) {
  useLocale();
  const {
    isAuthenticated,
    user
  } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [social, setSocial] = useState(null);
  const [params, setParams] = useSearchParams();
  const tabs = ["activity", "games", "wishlist", "reviews", "discussions", "screenshots", "videos", "guides", "friends", "followers", "following"];
  const tab = tabs.includes(params.get("tab")) ? params.get("tab") : "activity";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const search = params.get("search") || "";
  const ordering = params.get("ordering") || "latest";
  const [retry, setRetry] = useState(0);
  const [contentState, setContentState] = useState({
    key: "",
    data: null,
    error: ""
  });
  const contentKey = `${userId}:${tab}:${page}:${search}:${ordering}:${retry}`;
  const content = contentState.key === contentKey ? contentState.data : null;
  useEffect(() => {
    const controller = new AbortController();
    api.get(`/users/${userId}/content/`, {
      params: {
        section: tab,
        page,
        search,
        ordering
      },
      signal: controller.signal,
      skipAuth: true
    }).then(({
      data
    }) => setContentState({
      key: contentKey,
      data,
      error: ""
    })).catch(err => {
      if (!controller.signal.aborted) setContentState({
        key: contentKey,
        data: null,
        error: err.response?.data?.detail || t("Could not load this section.")
      });
    });
    return () => controller.abort();
  }, [userId, tab, page, search, ordering, contentKey]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const {
        data
      } = await api.get(`/users/${userId}/`, {
        skipAuth: true
      });
      setProfile(data);
      setError("");
    } catch {
      setError("This profile is unavailable.");
    }
  }, [userId]);
  const loadSocial = useCallback(async () => {
    if (!isAuthenticated || Number(userId) === user?.id) return;
    try {
      const {
        data
      } = await api.get(`/users/${userId}/social/`);
      setSocial(data);
    } catch {
      setSocial(null);
    }
  }, [isAuthenticated, userId, user?.id]);
  useEffect(() => {
    Promise.resolve().then(() => {
      load();
      loadSocial();
    });
  }, [load, loadSocial]);
  const requireAuth = () => {
    if (isAuthenticated) return false;
    navigate("/login", {
      state: {
        from: {
          pathname: `/users/${userId}`,
          search: "",
          hash: ""
        }
      }
    });
    return true;
  };
  const toggleFollow = async () => {
    if (requireAuth() || busy) return;
    setBusy(true);
    setError("");
    try {
      await api[social?.following ? "delete" : "post"](`/users/${userId}/social/`);
      await loadSocial();
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || t("Action could not be completed."));
    } finally {
      setBusy(false);
    }
  };
  const addFriend = async () => {
    if (requireAuth() || busy) return;
    setBusy(true);
    setError("");
    try {
      await api.post("/friends/requests/", {
        user_id: Number(userId)
      });
      await loadSocial();
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || t("Friend request could not be sent."));
    } finally {
      setBusy(false);
    }
  };
  const relationshipAction = async action => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
      await loadSocial();
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || t("Could not update friendship."));
    } finally {
      setBusy(false);
    }
  };
  if (error && !profile) return <div className="public-profile-page"><div role="alert">{t(error)} <button onClick={load}>{t("Retry")}</button></div></div>;
  if (!profile) return <div className="public-profile-page">{t("Loading profile…")}</div>;
  return <div className="public-profile-page">
    <section className="public-profile-hero">
      <div className="public-profile-cover" style={profile.cover ? {
        backgroundImage: `url(${profile.cover})`
      } : undefined} />
      <div className="public-profile-intro"><span className="public-profile-avatar">{profile.avatar ? <img src={profile.avatar} alt="" /> : profile.username.charAt(0).toUpperCase()}</span><div className="public-profile-identity"><h1>@{profile.username}</h1>{profile.display_name && profile.display_name.toLowerCase() !== profile.username.toLowerCase() && <p className="public-profile-display-name">{profile.display_name}</p>}<p className="public-profile-presence">{profile.is_online ? t("Online") : t("Offline")}</p><p className="public-profile-bio">{profile.bio || t("Member of the Steamn’t community")}</p></div>
        {user?.id !== profile.id && (!isAuthenticated || social) && <div className="public-profile-actions">{!social?.blocked && <button className="profile-action-primary" disabled={busy} onClick={toggleFollow}>{social?.following ? t("Unfollow") : t("Follow")}</button>}{!social?.blocked && (!social || social.friend_status === "none") && <button className="profile-action-secondary" disabled={busy} onClick={addFriend}>{t("Add friend")}</button>}{social?.friend_status === "accepted" && <button className="profile-action-secondary" disabled={busy} onClick={() => {
          if (window.confirm(t("Remove this friend?"))) relationshipAction(() => removeFriend(profile.id));
        }}>{t("Remove friend")}</button>}
        {social?.request_direction === "outgoing" && <button className="profile-action-secondary" disabled={busy} onClick={() => relationshipAction(() => cancelFriendRequest(social.relationship_id))}>{t("Cancel request")}</button>}
        {social?.request_direction === "incoming" && <><button className="profile-action-primary" disabled={busy} onClick={() => relationshipAction(() => acceptFriendRequest(social.relationship_id))}>{t("Accept request")}</button><button className="profile-action-secondary" disabled={busy} onClick={() => relationshipAction(() => rejectFriendRequest(social.relationship_id))}>{t("Decline request")}</button></>}
        {social?.can_message === true && !social?.blocked && <Link className="profile-action-secondary" to={`/chat?user_id=${profile.id}`}>{t("Message")}</Link>}<button className="profile-action-danger" disabled={busy} onClick={async () => {
          if (requireAuth() || !window.confirm(social?.blocked ? t("Unblock this user?") : t("Block this user and remove friendship and follows?"))) return;
          setBusy(true);
          try {
            await api[social?.blocked ? "delete" : "post"](`/users/${userId}/block/`);
            await loadSocial();
          } catch (err) {
            setError(err.response?.data?.detail || t("Unable to update block."));
          } finally {
            setBusy(false);
          }
          }}>{social?.blocked ? t("Unblock") : t("Block")}</button></div>}
      </div>
      <div className="public-profile-stats">{Object.entries(profile.stats).map(([key, value]) => ["followers", "following"].includes(key) && value !== null ? <button type="button" key={key} onClick={() => setParams({
            tab: key
          })}><strong>{value}</strong><span>{t(key)}</span></button> : <div key={key}><strong>{value === null ? t("Private") : value}</strong><span>{t(key.replace("_", " "))}</span></div>)}</div>
    </section>
    {error && <p role="alert" className="chat-error">{t(error)}</p>}
    <div className="public-profile-body"><section><nav className="public-profile-tabs" aria-label={t("Profile sections")}>{tabs.map(name => <button key={name} className={tab === name ? "active" : ""} onClick={() => setParams({
            tab: name
          })}>{t(name)}</button>)}</nav>
      <form className="profile-content-filters" onSubmit={event => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setParams({
            tab,
            search: data.get("search"),
            ordering,
            page: "1"
          });
        }}>
        <label>{t("Search section", { section: t(tab) })}<input key={`${userId}:${tab}:${search}`} name="search" type="search" defaultValue={search} /></label><button>{t("Search")}</button>
        <label>{t("Sort")}<select value={ordering} onChange={e => setParams({
              tab,
              search,
              ordering: e.target.value,
              page: "1"
            })}><option value="latest">{t("Latest")}</option><option value="oldest">{t("Oldest")}</option>{tab !== "friends" && <option value="title">{t("Title")}</option>}</select></label>
      </form>
      {contentState.key === contentKey && contentState.error ? <p role="alert">{t(contentState.error)} <button onClick={() => setRetry(n => n + 1)}>{t("Retry")}</button></p> : !content ? <p role="status">{t("Loading section", { section: t(tab) })}</p> : content.results.length === 0 ? <p>{t("No content to show yet.")}</p> : <><div className={`public-profile-items${tab === "screenshots" ? " is-screenshot-gallery" : ""}`}>{content.results.map(item => tab === "reviews" ? <article className="public-profile-review-item" key={item.id}>
        <Link className="public-profile-item-link" to={item.url}>{item.image && <img src={item.image} alt="" />}<div><strong>{item.title}</strong>{item.body && <p>{item.body}</p>}</div>{item.meta && <small>{t(item.meta)}</small>}</Link>
        <ReviewImageGallery images={item.images} title={item.title} className="public-profile-review-images" itemClassName="public-profile-review-image" />
      </article> : tab === "screenshots" && item.image ? <article className="public-profile-screenshot-item" key={item.id}>
        <ReviewImageGallery images={[{ id: item.id, src: item.image, alt: item.title || t("Screenshot") }]} title={item.title || t("Screenshot")} className="public-profile-screenshot-media" itemClassName="public-profile-screenshot-tile" />
        <Link className="public-profile-screenshot-caption" to={item.url}><strong>{item.title}</strong>{item.meta && <small>{t(item.meta)}</small>}</Link>
      </article> : <Link key={item.id} to={item.url}>{item.image && <img src={item.image} alt="" />}<div><strong>{item.title}</strong>{item.body && <p>{item.body}</p>}</div>{item.meta && <small>{t(item.meta)}</small>}</Link>)}</div><Pagination page={page} previous={content.previous} next={content.next} onPageChange={value => setParams({
            tab,
            search,
            ordering,
            page: String(value)
          })} /></>}

    </section><aside className="public-profile-member-card"><div className="public-profile-member-heading"><span>{t("Community member")}</span><strong>{t("Level {level}", { level: 1 + Math.floor(profile.badges.reduce((sum, badge) => sum + badge.points, 0) / 100) })}</strong></div><div className="public-profile-member-section"><h2>{t("Badges")}</h2><div className="public-profile-badges">{profile.badges.length ? profile.badges.map(badge => <p key={badge.name}><span aria-hidden="true">{badge.icon}</span>{badge.name}</p>) : <p>{t("No badges yet.")}</p>}</div></div><p className="public-profile-joined">{t("Joined {date}", { date: new Date(profile.joined_at).toLocaleDateString(document.documentElement.dataset.locale || "en") })}</p></aside></div>
  </div>;
}
