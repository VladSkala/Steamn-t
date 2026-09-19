import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { addCartDLC } from "../api/cart";
import { checkoutBundle, getBundleDetail, getBundles, getDLC, getDLCDetail } from "../api/dlc";
import CatalogFeedback from "../components/CatalogFeedback";
import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import { createReturnLocation } from "../utils/returnLocation";

const money = (value) => Number(value) === 0 ? "Free" : new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD",
}).format(Number(value));

function usePublicData(load, key) {
  const [result, setResult] = useState({ key: "", data: null, error: "" });
  const [retry, setRetry] = useState(0);
  const requestKey = `${key}:${retry}`;
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then((data) => {
      if (!controller.signal.aborted) setResult({ key: requestKey, data, error: "" });
    }).catch((error) => {
      if (!controller.signal.aborted) setResult({
        key: requestKey, data: null,
        error: error?.response?.status === 404 ? "not-found" : "Unable to load this content.",
      });
    });
    return () => controller.abort();
  }, [load, requestKey]);
  return { ...result, loading: result.key !== requestKey, retry: () => setRetry((n) => n + 1) };
}

function State({ result }) {
  if (result.loading) return <CatalogFeedback kind="loading" title="Loading content" message="Fetching store information." />;
  if (result.error) return <CatalogFeedback kind="error" title={result.error === "not-found" ? "Not found" : "Content unavailable"} message={result.error === "not-found" ? "This item is no longer available." : result.error} onRetry={result.error === "not-found" ? undefined : result.retry} />;
  return null;
}

export function DLCListPage() {
  const { gameId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const ordering = searchParams.get("ordering") || "title";
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const load = useCallback((signal) => getDLC({ game: gameId, ordering, page }, { signal }), [gameId, ordering, page]);
  // The request is keyed to URL state; no local filter state is lost on refresh.
  const result = usePublicData(load, `${gameId}:${ordering}:${page}`);
  const items = result.data?.results || [];
  return <section className="store-game">
    <nav className="store-breadcrumb"><Link to={`/games/${gameId}`}>Base game</Link> / DLC</nav>
    <h1>Downloadable content</h1>
    <label>Sort by <select value={ordering} onChange={(event) => setSearchParams({ ordering: event.target.value, page: "1" })}>
      <option value="title">Title</option><option value="price">Price: low to high</option><option value="-price">Price: high to low</option><option value="-release_date">Newest</option>
    </select></label>
    <State result={result} />
    {!result.loading && !result.error && <>
      {items.length === 0 && <p className="store-muted">No DLC is available for this game yet.</p>}
      <div className="store-game-grid">{items.map((item) => <article key={item.id} className="store-game-card">
        {item.cover && <img src={item.cover} alt="" />}
        <h2><Link to={`/dlc/${item.id}`}>{item.title}</Link></h2>
        <p>{item.description}</p><strong>{item.is_owned ? "Owned" : money(item.purchase_price ?? item.price)}</strong>
        <Link to={`/dlc/${item.id}`}>View details →</Link>
      </article>)}</div>
      <nav aria-label="DLC pages">
        {result.data?.previous && <button type="button" onClick={() => setSearchParams({ ordering, page: String(page - 1) })}>Previous</button>}
        <span> Page {page} </span>
        {result.data?.next && <button type="button" onClick={() => setSearchParams({ ordering, page: String(page + 1) })}>Next</button>}
      </nav>
    </>}
  </section>;
}

export function DLCDetailPage() {
  const { dlcId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { refreshCart } = useCart();
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState("");
  const load = useCallback((signal) => getDLCDetail(dlcId, { signal }), [dlcId]);
  const result = usePublicData(load, dlcId);
  const item = result.data;
  const add = async () => {
    if (!isAuthenticated) { navigate("/login", { state: { from: createReturnLocation(location) } }); return; }
    if (working) return;
    setWorking(true); setFeedback("");
    try { await addCartDLC(dlcId); await refreshCart(); setFeedback("Added to cart."); }
    catch (error) { setFeedback(error?.response?.data?.detail || error?.response?.data?.dlc_id?.[0] || "Unable to add DLC."); }
    finally { setWorking(false); }
  };
  return <section className="store-game">
    <State result={result} />
    {item && !result.loading && <>
      <nav className="store-breadcrumb"><Link to={`/games/${item.game.id}`}>{item.game.title}</Link> / <Link to={`/games/${item.game.id}/dlc`}>DLC</Link> / {item.title}</nav>
      <h1>{item.title}</h1>
      {(item.hero_image_url || item.cover) && <img className="store-game-hero" src={item.hero_image_url || item.cover} alt={`${item.title} artwork`} />}
      <p>{item.description}</p><p>Released {item.release_date} · {money(item.price)}</p>
      <p>Requires the base game <Link to={`/games/${item.game.id}`}>{item.game.title}</Link>.</p>
      {item.is_owned ? <Link to="/library">Owned · View library</Link> : <button className="primary-button" type="button" disabled={working} onClick={add}>{working ? "Adding…" : "Add DLC to cart"}</button>}
      {feedback && <p role="status">{feedback}</p>}
    </>}
  </section>;
}

export function BundleListPage() {
  const load = useCallback((signal) => getBundles({}, { signal }), []);
  const result = usePublicData(load, "bundles");
  return <section className="store-game"><h1>Game bundles</h1><State result={result} />
    {!result.loading && !result.error && <div className="store-game-grid">{(result.data?.results || []).map((item) => <article key={item.id} className="store-game-card">
      {item.cover && <img src={item.cover} alt="" />}<h2><Link to={`/bundles/${item.id}`}>{item.title}</Link></h2><p>{item.description}</p><strong>{item.is_owned ? "Owned" : money(item.purchase_price ?? item.price)}</strong>
    </article>)}</div>}
  </section>;
}

export function BundleDetailPage() {
  const { bundleId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback((signal) => getBundleDetail(bundleId, { signal }), [bundleId]);
  const result = usePublicData(load, bundleId);
  const item = result.data;
  const purchase = async () => {
    if (!isAuthenticated) { navigate("/login", { state: { from: createReturnLocation(location) } }); return; }
    if (working) return;
    setWorking(true); setError("");
    try { const order = await checkoutBundle(bundleId); navigate(`/orders/${order.id}`, { state: { checkoutSuccess: true } }); }
    catch (requestError) { setError(requestError?.response?.data?.detail || "Unable to purchase this bundle."); }
    finally { setWorking(false); }
  };
  return <section className="store-game"><State result={result} />
    {item && !result.loading && <><h1>{item.title}</h1>{item.cover && <img className="store-game-hero" src={item.cover} alt="" />}
      <p>{item.description}</p><strong>{item.is_owned ? "Owned" : money(item.purchase_price ?? item.price)}</strong>
      <h2>Games</h2><ul>{item.games.map((game) => <li key={game.id}><Link to={`/games/${game.id}`}>{game.title}</Link></li>)}</ul>
      <h2>DLC</h2><ul>{item.dlc.map((dlc) => <li key={dlc.id}><Link to={`/dlc/${dlc.id}`}>{dlc.title}</Link></li>)}</ul>
      <p>Your price above excludes items you already own. This is a simulated purchase; no real money is charged.</p>
      <button className="primary-button" type="button" disabled={working || item.is_owned} onClick={purchase}>{item.is_owned ? "Already in your library" : working ? "Purchasing…" : `Buy bundle · ${money(item.purchase_price ?? item.price)}`}</button>
      {error && <p role="alert">{error}</p>}
    </>}
  </section>;
}
