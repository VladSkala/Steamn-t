import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  acceptFriendRequest,
  cancelFriendRequest,
  getFriendsOverview,
  rejectFriendRequest,
  removeFriend,
  searchUsers,
  sendFriendRequest,
} from "../api/friends";
import api from "../api/client";
import CatalogFeedback from "../components/CatalogFeedback";

const initialOverview = { friends: [], incoming: [], outgoing: [], activity: [] };

const errorMessage = (error, fallback) => {
  if (!error?.response)
    return "The friends service is unavailable. Check the backend and try again.";
  return error.response.data?.detail || fallback;
};

function PlayerAvatar({ user }) {
  const initial = user?.username?.charAt(0).toUpperCase() || "P";
  return (
    <span className="friends-avatar" aria-hidden="true">
      <span>{initial}</span>
      {user?.avatar && <img src={user.avatar} alt="" />}
    </span>
  );
}

function PlayerIdentity({ user }) {
  return (
    <Link className="friends-identity" to={`/users/${user.id}`} aria-label={`Open ${user.username}'s profile`}>
      <PlayerAvatar user={user} />
      <div>
        <strong>{user.display_name || user.username}</strong>
        <span>@{user.username} · {user.is_online ? "Online" : "Offline"}</span>
      </div>
    </Link>
  );
}

function EmptyPanel({ title, message }) {
  return <div className="friends-empty"><span aria-hidden="true">◇</span><strong>{title}</strong><p>{message}</p></div>;
}

export default function FriendsPage() {
  const [params, setParams] = useSearchParams();
  const tab = ["friends", "online", "requests", "blocked", "find"].includes(params.get("tab")) ? params.get("tab") : "friends";
  const setTab = (value) => setParams({ tab: value });
  const [blocked, setBlocked] = useState([]);
  const [friendSearch, setFriendSearch] = useState("");
  const [overview, setOverview] = useState(initialOverview);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [busyKey, setBusyKey] = useState("");
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([getFriendsOverview({ signal: controller.signal }), api.get("/blocks/", { signal: controller.signal })])
      .then(([data, blocks]) => {
        setBlocked(blocks.data.items);
        if (!controller.signal.aborted) {
          setOverview(data);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setLoadError(errorMessage(error, "Your friends could not be loaded."));
        setLoading(false);
      });
    return () => controller.abort();
  }, [reloadKey]);

  const refresh = async () => {
    const data = await getFriendsOverview();
    setOverview(data);
    setBlocked((await api.get("/blocks/")).data.items);
    if (searched && query.trim().length >= 2) {
      setResults(await searchUsers(query));
    }
  };

  const runAction = async (key, action, message) => {
    if (busyKey) return;
    setBusyKey(key);
    setActionError("");
    setSuccess("");
    try {
      await action();
      await refresh();
      setSuccess(message);
    } catch (error) {
      setActionError(
        errorMessage(error, "The relationship could not be updated."),
      );
    } finally {
      setBusyKey("");
    }
  };

  useEffect(() => { if (!success) return undefined; const timer = window.setTimeout(() => setSuccess(""), 5000); return () => window.clearTimeout(timer); }, [success]);
  const visibleFriends = overview.friends.filter((item) => (tab !== "online" || item.user.is_online) && item.user.username.toLowerCase().includes(friendSearch.toLowerCase()));

  const search = async (event) => {
    event.preventDefault();
    const value = query.trim();
    setSearched(true);
    setActionError("");
    if (value.length < 2) {
      setResults([]);
      setActionError("Enter at least two characters.");
      return;
    }
    setSearching(true);
    try {
      setResults(await searchUsers(value));
    } catch (error) {
      setResults([]);
      setActionError(errorMessage(error, "Search could not be completed."));
    } finally {
      setSearching(false);
    }
  };

  if (loading) {
    return (
      <div className="friends-page">
        <CatalogFeedback
          kind="loading"
          title="Loading friends"
          message="Checking friends and pending requests."
        />
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="friends-page">
        <CatalogFeedback
          kind="error"
          title="Friends unavailable"
          message={loadError}
          onRetry={() => {
            setLoading(true);
            setLoadError("");
            setReloadKey((value) => value + 1);
          }}
        />
      </div>
    );
  }

  return (
    <div className="friends-page">
      <header className="friends-hero">
        <div>
          <span className="section-kicker">SOCIAL</span>
          <h1>Friends</h1>
          <p>
            Find your next teammate. Keep your favourite people close.
          </p>
        </div>
        <div
          className="friends-summary"
          aria-label="Friend relationship counts"
        >
          <div>
            <strong>{overview.friends.length}</strong>
            <span>Friends</span>
          </div>
          <div>
            <strong>{overview.incoming.length}</strong>
            <span>Incoming</span>
          </div>
          <div>
            <strong>{overview.outgoing.length}</strong>
            <span>Outgoing</span>
          </div>
        </div>
      </header>

      <nav className="friends-tabs" aria-label="Friends sections">
        <button
          type="button"
          className={tab === "friends" ? "active" : ""}
          onClick={() => setTab("friends")}
        >
          Friends
        </button>
        <button
          type="button"
          className={tab === "requests" ? "active" : ""}
          onClick={() => setTab("requests")}
        >
          Requests{" "}
          {overview.incoming.length > 0 && (
            <span>{overview.incoming.length}</span>
          )}
        </button>
        <button
          type="button"
          className={tab === "find" ? "active" : ""}
          onClick={() => setTab("find")}
        >
          Find players
        </button>
        <button type="button" className={tab === "online" ? "active" : ""} onClick={() => setTab("online")}>Online</button>
        <button type="button" className={tab === "blocked" ? "active" : ""} onClick={() => setTab("blocked")}>Blocked</button>
      </nav>

      {actionError && (
        <div className="friends-message error" role="alert">
          {actionError}
        </div>
      )}
      {success && (
        <div className="friends-message success" role="status">
          ✓ {success}
        </div>
      )}

      <div className="friends-layout"><section>
      {tab === "blocked" && <section className="friends-panel"><h2>Blocked players</h2>{blocked.length === 0 ? <p>No blocked players.</p> : blocked.map((person) => <article className="friends-row" key={person.id}><PlayerIdentity user={person} /><button disabled={Boolean(busyKey)} onClick={() => runAction(`unblock-${person.id}`, () => api.delete(`/users/${person.id}/block/`), "Player unblocked.")}>Unblock</button></article>)}</section>}
      {["friends", "online"].includes(tab) && (
        <section className="friends-panel" aria-labelledby="friends-list-title">
          <div className="friends-panel-heading">
            <div>
              <span className="section-kicker">CONNECTED</span>
              <h2 id="friends-list-title">Your friends</h2>
            </div>
          </div>
          <label>Search your friends<input type="search" value={friendSearch} onChange={(event) => setFriendSearch(event.target.value)} /></label>
          {visibleFriends.length === 0 ? (
            <EmptyPanel
              title={tab === "online" ? "No friends online" : "No matching friends"}
              message="Use Find players to send a request."
            />
          ) : (
            <div className="friends-list">
              {visibleFriends.map((relationship) => (
                <article key={relationship.id} className="friends-row">
                  <PlayerIdentity user={relationship.user} />
                  <Link className="friends-secondary-action" to={`/chat?user_id=${relationship.user.id}`}>
                    Message
                  </Link>
                  <button
                    type="button"
                    className="friends-secondary-action danger"
                    disabled={Boolean(busyKey)}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Remove @${relationship.user.username} from friends?`,
                        )
                      ) {
                        runAction(
                          `remove-${relationship.id}`,
                          () => removeFriend(relationship.user.id),
                          "Friend removed.",
                        );
                      }
                    }}
                  >
                    {busyKey === `remove-${relationship.id}`
                      ? "Removing…"
                      : "Remove"}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "requests" && (
        <div className="friends-request-grid">
          <section className="friends-panel" aria-labelledby="incoming-title">
            <div className="friends-panel-heading">
              <div>
                <span className="section-kicker">ACTION NEEDED</span>
                <h2 id="incoming-title">Incoming</h2>
              </div>
            </div>
            {overview.incoming.length === 0 ? (
              <EmptyPanel
                title="No incoming requests"
                message="New requests will appear here."
              />
            ) : (
              <div className="friends-list">
                {overview.incoming.map((relationship) => (
                  <article
                    key={relationship.id}
                    className="friends-row stacked"
                  >
                    <PlayerIdentity user={relationship.user} />
                    <div className="friends-row-actions">
                      <button
                        type="button"
                        disabled={Boolean(busyKey)}
                        onClick={() =>
                          runAction(
                            `accept-${relationship.id}`,
                            () => acceptFriendRequest(relationship.id),
                            `@${relationship.user.username} is now your friend.`,
                          )
                        }
                      >
                        {busyKey === `accept-${relationship.id}`
                          ? "Accepting…"
                          : "Accept"}
                      </button>
                      <button
                        type="button"
                        className="friends-secondary-action"
                        disabled={Boolean(busyKey)}
                        onClick={() =>
                          runAction(
                            `reject-${relationship.id}`,
                            () => rejectFriendRequest(relationship.id),
                            "Request declined.",
                          )
                        }
                      >
                        Decline
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
          <section className="friends-panel" aria-labelledby="outgoing-title">
            <div className="friends-panel-heading">
              <div>
                <span className="section-kicker">WAITING</span>
                <h2 id="outgoing-title">Outgoing</h2>
              </div>
            </div>
            {overview.outgoing.length === 0 ? (
              <EmptyPanel
                title="No outgoing requests"
                message="Requests you send will appear here."
              />
            ) : (
              <div className="friends-list">
                {overview.outgoing.map((relationship) => (
                  <article key={relationship.id} className="friends-row">
                    <PlayerIdentity user={relationship.user} />
                    <button
                      type="button"
                      className="friends-secondary-action"
                      disabled={Boolean(busyKey)}
                      onClick={() =>
                        runAction(
                          `cancel-${relationship.id}`,
                          () => cancelFriendRequest(relationship.id),
                          "Request canceled.",
                        )
                      }
                    >
                      {busyKey === `cancel-${relationship.id}`
                        ? "Canceling…"
                        : "Cancel"}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {tab === "find" && (
        <section
          className="friends-panel friends-search-panel"
          aria-labelledby="find-players-title"
        >
          <div className="friends-panel-heading">
            <div>
              <span className="section-kicker">DISCOVER</span>
              <h2 id="find-players-title">Find players</h2>
            </div>
          </div>
          <form className="friends-search" onSubmit={search}>
            <label htmlFor="friend-search">Username or display name</label>
            <div>
              <input
                id="friend-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by player name"
                autoComplete="off"
              />
              <button type="submit" disabled={searching}>
                {searching ? "Searching…" : "Search"}
              </button>
            </div>
          </form>
          {searched && !searching && results.length === 0 && (
            <EmptyPanel
              title="No players found"
              message="Try a different username or display name."
            />
          )}
          <div className="friends-list">
            {results.map((user) => (
              <article key={user.id} className="friends-row">
                <PlayerIdentity user={user} />
                {user.relationship_status === "none" && (
                  <button
                    type="button"
                    disabled={Boolean(busyKey)}
                    onClick={() =>
                      runAction(
                        `send-${user.id}`,
                        () => sendFriendRequest(user.id),
                        `Request sent to @${user.username}.`,
                      )
                    }
                  >
                    {busyKey === `send-${user.id}` ? "Sending…" : "Add friend"}
                  </button>
                )}
                {user.relationship_status === "friend" && (
                  <span className="friends-status">Friends</span>
                )}
                {user.relationship_status === "outgoing" && (
                  <span className="friends-status">Request sent</span>
                )}
                {user.relationship_status === "incoming" && (
                  <button
                    type="button"
                    className="friends-secondary-action"
                    onClick={() => setTab("requests")}
                  >
                    Review request
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
      </section><aside className="friends-activity"><h2>Friend activity</h2>{overview.activity?.length ? overview.activity.map(post => <article key={post.id}><Link to={`/users/${post.user_id}`}>{post.username}</Link><Link to={`/community/posts/${post.id}`}>{post.title}</Link><small>{post.game || post.kind} · {new Date(post.created_at).toLocaleDateString(document.documentElement.dataset.locale || "en")}</small></article>) : <p>When your friends share something, you’ll find it here.</p>}</aside></div>
    </div>
  );
}
