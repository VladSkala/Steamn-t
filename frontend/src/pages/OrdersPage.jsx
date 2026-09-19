import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";

import { getOrder, getOrders } from "../api/orders";
import CatalogFeedback from "../components/CatalogFeedback";
import api from "../api/client";

const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value));

function useOrderData(loader, key) {
  const [state, setState] = useState({ key: "", data: null, error: "" });
  const [retry, setRetry] = useState(0);
  const requestKey = `${key}:${retry}`;
  useEffect(() => {
    const controller = new AbortController();
    loader(controller.signal).then((data) => {
      if (!controller.signal.aborted) setState({ key: requestKey, data, error: "" });
    }).catch((error) => {
      if (!controller.signal.aborted) setState({ key: requestKey, data: null, error: error?.response?.status === 404 ? "Order not found." : "Unable to load orders." });
    });
    return () => controller.abort();
  }, [loader, requestKey]);
  return { data: state.key === requestKey ? state.data : null, error: state.key === requestKey ? state.error : "", loading: state.key !== requestKey, retry: () => setRetry((n) => n + 1) };
}

export function OrderHistoryPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page") || 1));
  // A stable loader avoids re-fetching when only local presentation changes.
  const loader = useCallback((signal) => getOrders(page, { signal }), [page]);
  const result = useOrderData(loader, page);
  return <section className="store-game"><h1>Order history</h1>
    {result.loading && <CatalogFeedback kind="loading" title="Loading orders" message="Fetching your purchases." />}
    {result.error && <CatalogFeedback kind="error" title="Orders unavailable" message={result.error} onRetry={result.retry} />}
    {!result.loading && !result.error && <>
      {(result.data?.results || []).length === 0 && <p>No orders yet. <Link to="/catalog">Browse catalog</Link></p>}
      <ul>{(result.data?.results || []).map((order) => <li key={order.id} className="store-game-card">
        <Link to={`/orders/${order.id}`}>Order #{order.id}</Link> · {new Date(order.created_at).toLocaleDateString(document.documentElement.dataset.locale || "en")} · {order.status} · {money(order.total_price)}
        <p>{order.items.length} games · {order.dlc_items.length} DLC</p>
      </li>)}</ul>
      <nav aria-label="Order pages">{result.data?.previous && <button type="button" onClick={() => setParams({ page: String(page - 1) })}>Previous</button>}
        <span> Page {page} </span>{result.data?.next && <button type="button" onClick={() => setParams({ page: String(page + 1) })}>Next</button>}</nav>
    </>}
  </section>;
}

export function OrderDetailPage() {
  const { orderId } = useParams();
  const location = useLocation();
  const [successVisible, setSuccessVisible] = useState(Boolean(location.state?.checkoutSuccess));
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundError, setRefundError] = useState("");
  const loader = useCallback((signal) => getOrder(orderId, { signal }), [orderId]);
  const result = useOrderData(loader, orderId);
  useEffect(() => {
    if (!successVisible) return undefined;
    const timer = window.setTimeout(() => setSuccessVisible(false), 5000);
    return () => window.clearTimeout(timer);
  }, [successVisible]);
  const order = result.data;
  const refund = async () => {
    if (refundBusy || !window.confirm("Refund this entire order? Its games and DLC will leave your library and the amount will be credited to your demo wallet.")) return;
    setRefundBusy(true); setRefundError("");
    try { await api.post(`/orders/${orderId}/refund/`); result.retry(); }
    catch (error) { setRefundError(error.response?.data?.detail || "Refund failed. Please try again."); }
    finally { setRefundBusy(false); }
  };
  return <section className="store-game">
    <p><Link to="/orders">← Order history</Link></p>
    {successVisible && <div role="status" className="purchase-toast">Purchase complete. Your receipt is ready.</div>}
    {result.loading && <CatalogFeedback kind="loading" title="Loading receipt" message="Fetching your order." />}
    {result.error && <CatalogFeedback kind="error" title="Receipt unavailable" message={result.error} onRetry={result.retry} />}
    {order && <><h1>Order #{order.id}</h1><p>Status: {order.status} · {new Date(order.created_at).toLocaleString(document.documentElement.dataset.locale || "en")}</p>
      <h2>Games</h2><ul>{order.items.map((item) => <li key={item.id}><Link to={`/games/${item.game.id}`}>{item.game.title}</Link> · {money(item.price_at_purchase)}</li>)}</ul>
      <h2>DLC</h2><ul>{order.dlc_items.map((item) => <li key={item.id}><Link to={`/dlc/${item.dlc.id}`}>{item.dlc.title}</Link> · {money(item.price_at_purchase)}</li>)}</ul>
      {order.bundles.length > 0 && <><h2>Bundle offers</h2><ul>{order.bundles.map((item) => <li key={item.id}><Link to={`/bundles/${item.bundle_id}`}>{item.title}</Link> · {money(item.price_at_purchase)}</li>)}</ul></>}
      <p><strong>Total paid: {money(order.total_price)}</strong></p>
      <p>Demo purchase; no real payment was processed.</p><Link to="/library">Open library →</Link>
      <p><button type="button" onClick={() => window.print()}>Print receipt</button></p>
      {order.status === "completed" && <button type="button" disabled={refundBusy} onClick={refund}>{refundBusy ? "Processing…" : "Refund order"}</button>}
      {order.status === "refunded" && <p role="status">Refunded to your demo wallet.</p>}
      {refundError && <p role="alert">{refundError}</p>}
    </>}
  </section>;
}
