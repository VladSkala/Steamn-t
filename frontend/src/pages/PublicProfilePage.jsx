import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../api/client";
import { removeFriend, acceptFriendRequest, cancelFriendRequest, rejectFriendRequest } from "../api/friends";
import { useAuth } from "../hooks/useAuth";

export default function PublicProfilePage() {
  const { userId } = useParams();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [social, setSocial] = useState(null);
  const [params, setParams] = useSearchParams();
  const tabs = ["activity", "games", "wishlist", "reviews", "discussions", "screenshots", "videos", "guides", "friends"];
  const tab = tabs.includes(params.get("tab")) ? params.get("tab") : "activity";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const search = params.get("search") || "";
  const ordering = params.get("ordering") || "latest";
  const [retry, setRetry] = useState(0);
  const [contentState, setContentState] = useState({ key: "", data: null, error: "" });
  const contentKey = `${userId}:${tab}:${page}:${search}:${ordering}:${retry}`;
  const content = contentState.key === contentKey ? contentState.data : null;
  useEffect(() => {
    const controller = new AbortController();
    api.get(`/users/${userId}/content/`, { params: { section: tab, page, search, ordering }, signal: controller.signal, skipAuth: true }).then(({ data }) => setContentState({ key: contentKey, data, error: "" })).catch((err) => { if (!controller.signal.aborted) setContentState({ key: contentKey, data: null, error: err.response?.data?.detail || "Could not load this section." }); });
    return () => controller.abort();
  }, [userId, tab, page, search, ordering, contentKey]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/users/${userId}/`, { skipAuth: true });
      setProfile(data); setError("");
    } catch { setError("This profile is unavailable."); }
  }, [userId]);
  const loadSocial = useCallback(async () => {
    if (!isAuthenticated || Number(userId) === user?.id) return;
    try { const { data } = await api.get(`/users/${userId}/social/`); setSocial(data); } catch { setSocial(null); }
  }, [isAuthenticated, userId, user?.id]);
  useEffect(() => { Promise.resolve().then(() => { load(); loadSocial(); }); }, [load, loadSocial]);

  const requireAuth = () => { if (isAuthenticated) return false; navigate("/login", { state: { from: { pathname: `/users/${userId}`, search: "", hash: "" } } }); return true; };
  const toggleFollow = async () => {
    if (requireAuth() || busy) return;
    setBusy(true); setError("");
    try { await api[ social?.following ? "delete" : "post" ](`/users/${userId}/social/`); await loadSocial(); await load(); }
    catch (requestError) { setError(requestError.response?.data?.detail || "Action could not be completed."); }
    finally { setBusy(false); }
  };
  const addFriend = async () => {
    if (requireAuth() || busy) return;
    setBusy(true); setError("");
    try { await api.post("/friends/requests/", { user_id: Number(userId) }); await loadSocial(); await load(); }
    catch (requestError) { setError(requestError.response?.data?.detail || "Friend request could not be sent."); }
    finally { setBusy(false); }
  };

  const relationshipAction = async (action) => {
    if (busy) return; setBusy(true); setError("");
    try { await action(); await loadSocial(); await load(); }
    catch (err) { setError(err.response?.data?.detail || "Could not update friendship."); }
    finally { setBusy(false); }
  };

  if (error && !profile) return <div className="public-profile-page"><div role="alert">{error} <button onClick={load}>Retry</button></div></div>;
  if (!profile) return <div className="public-profile-page">Loading profile…</div>;

  return <div className="public-profile-page">
    <div className="public-profile-cover" style={profile.cover ? { backgroundImage: `url(${profile.cover})` } : undefined} />
    <div className="public-profile-intro"><span className="public-profile-avatar">{profile.avatar ? <img src={profile.avatar} alt="" /> : profile.username.charAt(0).toUpperCase()}</span><div><h1>{profile.display_name}</h1><p>@{profile.username} · {profile.is_online ? "Online" : "Offline"}</p><p>{profile.bio || "Member of the Steamn’t community"}</p></div>
      {user?.id !== profile.id && <div className="public-profile-actions"><button disabled={busy} onClick={toggleFollow}>{social?.following ? "Unfollow" : "Follow"}</button>{(!social || social.friend_status === "none") && <button disabled={busy} onClick={addFriend}>Add friend</button>}{social?.friend_status === "accepted" && <button disabled={busy} onClick={() => { if (window.confirm("Remove this friend?")) relationshipAction(() => removeFriend(profile.id)); }}>Remove friend</button>}
        {social?.request_direction === "outgoing" && <button disabled={busy} onClick={() => relationshipAction(() => cancelFriendRequest(social.relationship_id))}>Cancel request</button>}
        {social?.request_direction === "incoming" && <><button disabled={busy} onClick={() => relationshipAction(() => acceptFriendRequest(social.relationship_id))}>Accept request</button><button disabled={busy} onClick={() => relationshipAction(() => rejectFriendRequest(social.relationship_id))}>Decline request</button></>}
        {social?.can_message !== false && <Link to={`/chat?user_id=${profile.id}`}>Message</Link>}<button disabled={busy} onClick={async () => { if (requireAuth() || !window.confirm(social?.blocked ? "Unblock this user?" : "Block this user and remove friendship and follows?")) return; setBusy(true); try { await api[social?.blocked ? "delete" : "post"](`/users/${userId}/block/`); await loadSocial(); } catch (err) { setError(err.response?.data?.detail || "Unable to update block."); } finally { setBusy(false); } }}>{social?.blocked ? "Unblock" : "Block"}</button></div>}
    </div>
    {error && <p role="alert" className="chat-error">{error}</p>}
    <div className="public-profile-stats">{Object.entries(profile.stats).map(([key, value]) => <div key={key}><strong>{value === null ? "Private" : value}</strong><span>{key.replace("_", " ")}</span></div>)}</div>
    <div className="public-profile-body"><section><nav aria-label="Profile sections">{tabs.map((name) => <button key={name} className={tab === name ? "active" : ""} onClick={() => setParams({ tab: name })}>{name}</button>)}</nav>
      <form className="profile-content-filters" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); setParams({tab, search: data.get("search"), ordering, page:"1"}); }}>
        <label>Search {tab}<input key={`${userId}:${tab}:${search}`} name="search" type="search" defaultValue={search} /></label><button>Search</button>
        <label>Sort<select value={ordering} onChange={e => setParams({tab,search,ordering:e.target.value,page:"1"})}><option value="latest">Latest</option><option value="oldest">Oldest</option>{tab !== "friends" && <option value="title">Title</option>}</select></label>
      </form>
      {contentState.key === contentKey && contentState.error ? <p role="alert">{contentState.error} <button onClick={() => setRetry(n => n + 1)}>Retry</button></p> : !content ? <p role="status">Loading {tab}…</p> : content.results.length === 0 ? <p>No {tab} to show yet.</p> : <><div className="public-profile-items">{content.results.map((item) => <Link key={item.id} to={item.url}>{item.image && <img src={item.image} alt="" />}<div><strong>{item.title}</strong>{item.body && <p>{item.body}</p>}</div>{item.meta && <small>{item.meta}</small>}</Link>)}</div><nav aria-label="Profile content pages"><button disabled={!content.previous} onClick={() => setParams({ tab, search, ordering, page: String(page - 1) })}>Previous</button><span>Page {page}</span><button disabled={!content.next} onClick={() => setParams({ tab, search, ordering, page: String(page + 1) })}>Next</button></nav></>}

    </section><aside><h2>Community member</h2><p>Level {1 + Math.floor(profile.badges.reduce((sum, badge) => sum + badge.points, 0) / 100)}</p><h2>Badges</h2>{profile.badges.length ? profile.badges.map((badge) => <p key={badge.name}>{badge.icon} {badge.name}</p>) : <p>No badges yet.</p>}<p>Joined {new Date(profile.joined_at).toLocaleDateString(document.documentElement.dataset.locale || "en")}</p></aside></div>
  </div>;
}
