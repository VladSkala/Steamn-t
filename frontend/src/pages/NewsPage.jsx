import { t, useLocale } from "../i18n/index.js";
import Pagination from "../components/Pagination";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/client";
import GameImage from "../components/GameImage";
export default function NewsPage() {
  useLocale();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({
    key: "",
    data: null,
    error: ""
  });
  const key = `${page}:${attempt}`;
  useEffect(() => {
    const controller = new AbortController();
    api.get("/community/posts/", {
      params: {
        kind: "news",
        page
      },
      skipAuth: true,
      signal: controller.signal
    }).then(({
      data
    }) => {
      if (!controller.signal.aborted) setResult({
        key,
        data,
        error: ""
      });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({
        key,
        data: null,
        error: t("News could not be loaded.")
      });
    });
    return () => controller.abort();
  }, [page, key]);
  const loading = result.key !== key;
  const data = loading ? null : result.data;
  const error = loading ? "" : result.error;
  return <div className="news-page">
    <span className="section-kicker">{t("STORE & COMMUNITY")}</span><h1>{t("Latest news")}</h1><p>{t("Official updates and stories from the store and its games.")}</p>
    {error && <p role="alert">{t(error)} <button onClick={() => setAttempt(n => n + 1)}>{t("Retry")}</button></p>}
    {loading && <p role="status">{t("Loading news…")}</p>}
    {data && !data.items.length && <div className="dlc-empty"><h2>{t("No news yet")}</h2><p>{t("Published updates will appear here.")}</p></div>}
    <div className="news-list">{data?.items.map(post => <Link key={post.id} to={`/community/posts/${post.id}`}>
      {post.media && <GameImage className="news-artwork" src={post.media} alt="" />}
      <span>{post.game?.title || "Steamn’t"}</span><h2>{post.title}</h2><p>{post.body?.slice(0, 240)}</p><small>{new Date(post.created_at).toLocaleDateString(document.documentElement.dataset.locale || "en")}</small>
    </Link>)}</div>
    <Pagination page={page} totalPages={data?.pagination?.total_pages || 1} onPageChange={value => setParams({
      page: String(value)
    })} />
  </div>;
}
