import { t, useLocale, getLocale } from "../i18n/index.js";
import Pagination from "../components/Pagination";
import { useCallback, useEffect, useState } from "react";
import { Navigate, Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { addCartDLC } from "../api/cart";
import { getDLC, getDLCDetail } from "../api/dlc";
import CatalogFeedback from "../components/CatalogFeedback";
import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import { createReturnLocation } from "../utils/returnLocation";
const money = value => Number(value) === 0 ? t("Free") : new Intl.NumberFormat(getLocale(), {
  style: "currency",
  currency: "USD"
}).format(Number(value));
function usePublicData(load, key) {
  const [result, setResult] = useState({
    key: "",
    data: null,
    error: ""
  });
  const [retry, setRetry] = useState(0);
  const requestKey = `${key}:${retry}`;
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({
        key: requestKey,
        data,
        error: ""
      });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({
        key: requestKey,
        data: null,
        error: error?.response?.status === 404 ? "not-found" : t("Unable to load this content.")
      });
    });
    return () => controller.abort();
  }, [load, requestKey]);
  return {
    ...result,
    loading: result.key !== requestKey,
    retry: () => setRetry(n => n + 1)
  };
}
function State({
  result
}) {
  useLocale();
  if (result.loading) return <CatalogFeedback kind="loading" title={t("Loading content")} message={t("Fetching store information.")} />;
  if (result.error) return <CatalogFeedback kind="error" title={result.error === "not-found" ? t("Not found") : t("Content unavailable")} message={result.error === "not-found" ? t("This item is no longer available.") : result.error} onRetry={result.error === "not-found" ? undefined : result.retry} />;
  return null;
}
export function DLCListPage() {
  useLocale();
  const {
    gameId
  } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const ordering = searchParams.get("ordering") || "title";
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const load = useCallback(signal => getDLC({
    game: gameId,
    ordering,
    page
  }, {
    signal
  }), [gameId, ordering, page]);
  // The request is keyed to URL state; no local filter state is lost on refresh.
  const result = usePublicData(load, `${gameId}:${ordering}:${page}`);
  const items = result.data?.results || [];
  return <section className="store-game dlc-page">
    <nav className="store-breadcrumb"><Link to={`/games/${gameId}`}>{t("Base game")}</Link> / DLC</nav>
    <h1>{t("Downloadable content")}</h1>
    <label>{t("Sort by")}<select value={ordering} onChange={event => setSearchParams({
        ordering: event.target.value,
        page: "1"
      })}>
      <option value="title">{t("Title")}</option><option value="price">{t("Price: low to high")}</option><option value="-price">{t("Price: high to low")}</option><option value="-release_date">{t("Newest")}</option>
    </select></label>
    <State result={result} />
    {!result.loading && !result.error && <>
      {items.length === 0 && <div className="dlc-empty"><h2>{t("No add-ons yet")}</h2><p>{t("No DLC is available for this game yet.")}</p><Link className="details-button details-button-secondary" to={`/games/${gameId}`}>{t("Back to game")}</Link></div>}
      <div className="store-game-grid">{items.map(item => <article key={item.id} className="store-game-card">
        {item.cover && <img src={item.cover} alt="" />}
        <h2><Link to={`/dlc/${item.id}`}>{item.title}</Link></h2>
        <p>{item.description}</p><strong>{item.is_owned ? t("Owned") : money(item.purchase_price ?? item.price)}</strong>
        <Link to={`/dlc/${item.id}`}>{t("View details →")}</Link>
      </article>)}</div>
      <Pagination page={page} previous={result.data?.previous} next={result.data?.next} onPageChange={value => setSearchParams({
        ordering,
        page: String(value)
      })} />
    </>}
  </section>;
}
export function DLCDetailPage() {
  useLocale();
  const {
    dlcId
  } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    isAuthenticated
  } = useAuth();
  const {
    refreshCart
  } = useCart();
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState("");
  const load = useCallback(signal => getDLCDetail(dlcId, {
    signal
  }), [dlcId]);
  const result = usePublicData(load, dlcId);
  const item = result.data;
  const add = async () => {
    if (!isAuthenticated) {
      navigate("/login", {
        state: {
          from: createReturnLocation(location)
        }
      });
      return;
    }
    if (working) return;
    setWorking(true);
    setFeedback("");
    try {
      await addCartDLC(dlcId);
      await refreshCart();
      setFeedback("Added to cart.");
    } catch (error) {
      setFeedback(error?.response?.data?.detail || error?.response?.data?.dlc_id?.[0] || t("Unable to add DLC."));
    } finally {
      setWorking(false);
    }
  };
  return <section className="store-game dlc-page">
    <State result={result} />
    {item && !result.loading && <>
      <nav className="store-breadcrumb"><Link to={`/games/${item.game.id}`}>{item.game.title}</Link> / <Link to={`/games/${item.game.id}/dlc`}>DLC</Link> / {item.title}</nav>
      <article className="dlc-product">
        <div className="dlc-product-art">{item.hero_image_url || item.cover ? <><span className="dlc-product-art-backdrop" aria-hidden="true" style={{ backgroundImage: `url(${item.hero_image_url || item.cover})` }} /><img src={item.hero_image_url || item.cover} alt={item.title} /></> : <span>DLC</span>}</div>
        <div className="dlc-product-info"><span className="section-kicker">{t("Downloadable content")}</span><h1>{item.title}</h1>
          <p className="dlc-description">{item.description}</p>
          <div className="dlc-metadata">
            {item.release_date && <div><span>{t("Released")}</span><time dateTime={item.release_date}>{new Date(`${item.release_date}T12:00:00`).toLocaleDateString(document.documentElement.lang)}</time></div>}
            <div><span>{t("Requires the base game")}</span><Link to={`/games/${item.game.id}`}>{item.game.title}</Link></div>
          </div>
          <div className="dlc-purchase"><strong>{money(item.purchase_price ?? item.price)}</strong>
            {item.is_owned ? <Link className="details-button details-button-secondary" to="/library">{t("Owned · View library")}</Link> : <button className="primary-button" type="button" disabled={working} onClick={add}>{working ? t("Adding…") : t("Add DLC to cart")}</button>}
          </div>{feedback && <p role="status">{t(feedback)}</p>}
        </div>
      </article>
    </>}
  </section>;
}

// Keep old URLs valid without exposing the retired bundle storefront.
export function BundleListPage() {
  useLocale();
  return <Navigate to="/catalog" replace />;
}
export function BundleDetailPage() {
  useLocale();
  return <Navigate to="/catalog" replace />;
}
