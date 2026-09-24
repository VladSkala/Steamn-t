import { t, translateNotification, useLocale } from "../i18n/index.js";
import Pagination from "../components/Pagination";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/client";
export default function NotificationsPage() {
  useLocale();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [state, setState] = useState({
    page: 0,
    data: null,
    error: ""
  });
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const load = useCallback(async () => {
    try {
      const {
        data
      } = await api.get("/notifications/", {
        params: {
          page
        }
      });
      setState({
        page,
        data,
        error: ""
      });
    } catch {
      setState({
        page,
        data: null,
        error: t("Could not load notifications.")
      });
    }
  }, [page]);
  useEffect(() => {
    Promise.resolve().then(load);
  }, [load]);
  const open = async item => {
    if (busy) return;
    setBusy(true);
    try {
      await api.post(`/notifications/${item.id}/read/`);
      window.dispatchEvent(new Event("steamnt:notifications-changed"));
      navigate(/^\/(?!\/)/.test(item.target_path) ? item.target_path : "/notifications");
    } catch {
      setState(current => ({
        ...current,
        error: t("Could not mark notification as read.")
      }));
    } finally {
      setBusy(false);
    }
  };
  const markAll = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.post("/notifications/read-all/");
      window.dispatchEvent(new Event("steamnt:notifications-changed"));
      await load();
    } catch {
      setState(current => ({
        ...current,
        error: t("Could not update notifications.")
      }));
    } finally {
      setBusy(false);
    }
  };
  const data = state.page === page ? state.data : null;
  return <div className="notification-page"><header><div><h1>{t("Notifications")}</h1></div><button disabled={busy || !data?.unread_count} onClick={markAll}>{t("Mark all as read")}</button></header>
    {state.error && <p role="alert">{t(state.error)} <button onClick={load}>{t("Retry")}</button></p>}
    {data && (data.items.length ? <><div className="notification-list">{data.items.map(item => { const copy = translateNotification(item); return <button disabled={busy} className={item.read_at ? "read" : "unread"} key={item.id} onClick={() => open(item)}><span className="notification-dot" /><span><strong>{copy.title}</strong><small>{copy.body}</small></span><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString(document.documentElement.dataset.locale || "en")}</time></button>; })}</div><Pagination page={page} previous={data.previous} next={data.next} disabled={busy} onPageChange={value => setParams({
        page: String(value)
      })} /></> : <div className="chat-empty-small">{t("No notifications yet.")}<Link to="/community">{t("Explore the community")}</Link></div>)}
  </div>;
}
