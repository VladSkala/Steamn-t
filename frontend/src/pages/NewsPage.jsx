import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/client";

export default function NewsPage() {
  const [params, setParams] = useSearchParams(); const page = Number(params.get("page")) || 1;
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState(null); const [error, setError] = useState("");
  useEffect(() => { let active = true; api.get("/community/posts/", { params: { kind: "news", page }, skipAuth: true }).then(({ data: result }) => { if (active) { setData(result); setError(""); } }).catch(() => { if (active) setError("News could not be loaded."); }); return () => { active = false; }; }, [page, attempt]);
  const posts = data?.items || [];
  return <div className="news-page"><span className="section-kicker">STORE & COMMUNITY</span><h1>Latest news</h1><p>Official updates and stories from the store and its games.</p>{error && <p role="alert">{error} <button onClick={() => setAttempt(n => n + 1)}>Retry</button></p>}{!data && !error && <p>Loading news…</p>}{data && !posts.length && <p>No news has been published yet.</p>}<div className="news-list">{posts.map((post) => <Link key={post.id} to={`/community/posts/${post.id}`}><span>{post.game?.title || "Steamn’t"}</span><h2>{post.title}</h2><p>{post.body?.slice(0, 240)}</p><small>{new Date(post.created_at).toLocaleDateString(document.documentElement.dataset.locale || "en")}</small></Link>)}</div><nav aria-label="News pages"><button disabled={page <= 1} onClick={() => setParams({ page: String(page - 1) })}>Previous</button><span>Page {page}</span><button disabled={page >= (data?.pagination?.total_pages || 1)} onClick={() => setParams({ page: String(page + 1) })}>Next</button></nav></div>;
}
