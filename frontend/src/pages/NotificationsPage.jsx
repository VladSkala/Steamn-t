import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/client";

export default function NotificationsPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [state, setState] = useState({ page: 0, data: null, error: "" });
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const load = useCallback(async () => {
    try { const { data } = await api.get("/notifications/", { params: { page } }); setState({ page, data, error: "" }); }
    catch { setState({ page, data: null, error: "Could not load notifications." }); }
  }, [page]);
  useEffect(() => { Promise.resolve().then(load); }, [load]);
  const open = async (item) => {
    if (busy) return; setBusy(true);
    try {
      await api.post(`/notifications/${item.id}/read/`); window.dispatchEvent(new Event("steamnt:notifications-changed"));
      navigate(/^\/(?!\/)/.test(item.target_path) ? item.target_path : "/notifications");
    } catch { setState((current) => ({ ...current, error: "Could not mark notification as read." })); }
    finally { setBusy(false); }
  };
  const markAll = async () => {
    if (busy) return; setBusy(true);
    try { await api.post("/notifications/read-all/"); window.dispatchEvent(new Event("steamnt:notifications-changed")); await load(); }
    catch { setState((current) => ({ ...current, error: "Could not update notifications." })); }
    finally { setBusy(false); }
  };
  const data = state.page === page ? state.data : null;
  return <div className="notification-page"><header><div><span className="section-kicker">YOUR ACTIVITY</span><h1>Notifications</h1><p>{data ? data.unread_count ? `${data.unread_count} unread` : "You’re all caught up." : "Loading your activity…"}</p></div><button disabled={busy || !data?.unread_count} onClick={markAll}>Mark all as read</button></header><p><Link to="/settings?section=notifications">Notification preferences →</Link></p>
    {state.error && <p role="alert">{state.error} <button onClick={load}>Retry</button></p>}
    {data && (data.items.length ? <><div className="notification-list">{data.items.map((item) => <button disabled={busy} className={item.read_at ? "read" : "unread"} key={item.id} onClick={() => open(item)}><span className="notification-dot" /><span><strong>{item.title}</strong><small>{item.body}</small></span><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString(document.documentElement.dataset.locale || "en")}</time></button>)}</div><nav aria-label="Notification pages"><button disabled={!data.previous} onClick={() => setParams({ page: String(page - 1) })}>Previous</button><span> Page {page} </span><button disabled={!data.next} onClick={() => setParams({ page: String(page + 1) })}>Next</button></nav></> : <div className="chat-empty-small">No notifications yet. <Link to="/community">Explore the community</Link></div>)}
  </div>;
}
