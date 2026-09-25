import { t, useLocale, getLocale } from "../i18n/index.js";
import Pagination from "../components/Pagination";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { getOrder, getOrders } from "../api/orders";
import CatalogFeedback from "../components/CatalogFeedback";
import api from "../api/client";
import { useAuth } from "../hooks/useAuth";
const money = value => new Intl.NumberFormat(getLocale(), {
  style: "currency",
  currency: "USD"
}).format(Number(value));
function useOrderData(loader, key) {
  const [state, setState] = useState({
    key: "",
    data: null,
    error: ""
  });
  const [retry, setRetry] = useState(0);
  const requestKey = `${key}:${retry}`;
  useEffect(() => {
    const controller = new AbortController();
    loader(controller.signal).then(data => {
      if (!controller.signal.aborted) setState({
        key: requestKey,
        data,
        error: ""
      });
    }).catch(error => {
      if (!controller.signal.aborted) setState({
        key: requestKey,
        data: null,
        error: error?.response?.status === 404 ? t("Order not found.") : t("Unable to load orders.")
      });
    });
    return () => controller.abort();
  }, [loader, requestKey]);
  return {
    data: state.key === requestKey ? state.data : null,
    error: state.key === requestKey ? state.error : "",
    loading: state.key !== requestKey,
    retry: () => setRetry(n => n + 1)
  };
}
export function OrderHistoryPage() {
  useLocale();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page") || 1));
  // A stable loader avoids re-fetching when only local presentation changes.
  const loader = useCallback(signal => getOrders(page, {
    signal
  }), [page]);
  const result = useOrderData(loader, page);
  return <section className="store-game orders-page"><header className="orders-page-header"><span className="section-kicker">{t("Purchases")}</span><h1>{t("Order history")}</h1></header>
    {result.loading && <CatalogFeedback kind="loading" title={t("Loading orders")} message={t("Fetching your purchases.")} />}
    {result.error && <CatalogFeedback kind="error" title={t("Orders unavailable")} message={t(result.error)} onRetry={result.retry} />}
    {!result.loading && !result.error && <>
      {(result.data?.results || []).length === 0 && <div className="orders-empty"><p>{t("No orders yet.")}</p><Link className="orders-action" to="/catalog">{t("Browse catalog")}</Link></div>}
      <ul className="orders-list">{(result.data?.results || []).map(order => <li key={order.id} className="order-summary-card">
        <div className="order-summary-title"><span>{t("Order number")}</span><strong>{t("Order #{id}", { id: order.id })}</strong><small>{t(order.items.length === 1 ? "{count} game" : "{count} games", { count: order.items.length })} · {order.dlc_items.length} DLC</small></div>
        <div className="order-summary-meta"><span>{t("Order date")}</span><time dateTime={order.created_at}>{new Date(order.created_at).toLocaleDateString(document.documentElement.dataset.locale || "en")}</time></div>
        <div className="order-summary-meta"><span>{t("Status")}</span><strong className={`order-status order-status-${order.status || "pending"}`}>{t(order.status)}</strong></div>
        <div className="order-summary-meta order-summary-total"><span>{t("Total")}</span><strong>{money(order.total_price)}</strong></div>
        <Link className="orders-action" to={`/orders/${order.id}`}>{t("View details")}<span aria-hidden="true">→</span></Link>
      </li>)}</ul>
      <Pagination page={page} previous={result.data?.previous} next={result.data?.next} onPageChange={value => setParams({
        page: String(value)
      })} />
    </>}
  </section>;
}
export function OrderDetailPage() {
  useLocale();
  const {
    reloadProfile
  } = useAuth();
  const {
    orderId
  } = useParams();
  const location = useLocation();
  const [successVisible, setSuccessVisible] = useState(Boolean(location.state?.checkoutSuccess));
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundError, setRefundError] = useState("");
  const loader = useCallback(signal => getOrder(orderId, {
    signal
  }), [orderId]);
  const result = useOrderData(loader, orderId);
  useEffect(() => {
    if (!successVisible) return undefined;
    const timer = window.setTimeout(() => setSuccessVisible(false), 5000);
    return () => window.clearTimeout(timer);
  }, [successVisible]);
  const order = result.data;
  const refund = async () => {
    if (refundBusy || !window.confirm(t("Refund this entire order? Its games and DLC will leave your library and the amount will be credited to your demo wallet."))) return;
    setRefundBusy(true);
    setRefundError("");
    try {
      await api.post(`/orders/${orderId}/refund/`);
      reloadProfile().catch(() => {});
      result.retry();
    } catch (error) {
      setRefundError(error.response?.data?.detail || t("Refund failed. Please try again."));
    } finally {
      setRefundBusy(false);
    }
  };
  return <section className="store-game order-detail-page">
    <Link className="order-back-link" to="/orders"><span aria-hidden="true">←</span>{t("Order history")}</Link>
    {successVisible && <div role="status" className="purchase-toast">{t("Purchase complete. Your receipt is ready.")}</div>}
    {result.loading && <CatalogFeedback kind="loading" title={t("Loading receipt")} message={t("Fetching your order.")} />}
    {result.error && <CatalogFeedback kind="error" title={t("Receipt unavailable")} message={t(result.error)} onRetry={result.retry} />}
    {order && <article className="order-receipt">
      <header className="order-receipt-header"><div><span className="section-kicker">{t("Receipt")}</span><h1>{t("Order #{id}", { id: order.id })}</h1></div><strong className={`order-status order-status-${order.status || "pending"}`}>{t(order.status)}</strong></header>
      <dl className="order-facts">
        <div><dt>{t("Order number")}</dt><dd>#{order.id}</dd></div>
        <div><dt>{t("Order date")}</dt><dd><time dateTime={order.created_at}>{new Date(order.created_at).toLocaleString(document.documentElement.dataset.locale || "en")}</time></dd></div>
        <div><dt>{t("Status")}</dt><dd>{t(order.status)}</dd></div>
        <div><dt>{t("Total")}</dt><dd>{money(order.total_price)}</dd></div>
      </dl>
      {(order.items || []).length > 0 && <section className="order-items-section"><h2>{t("Games")}</h2><ul className="order-item-list">{order.items.map(item => <li key={item.id}><Link to={`/games/${item.game.id}`}>{item.game.title}</Link><strong>{money(item.price_at_purchase)}</strong></li>)}</ul></section>}
      {(order.dlc_items || []).length > 0 && <section className="order-items-section"><h2>{t("DLC")}</h2><ul className="order-item-list">{order.dlc_items.map(item => <li key={item.id}><Link to={`/dlc/${item.dlc.id}`}>{item.dlc.title}</Link><strong>{money(item.price_at_purchase)}</strong></li>)}</ul></section>}
      {(order.bundles || []).length > 0 && <section className="order-items-section"><h2>{t("Bundle offers")}</h2><ul className="order-item-list">{order.bundles.map(item => <li key={item.id}><span>{item.title}</span><strong>{money(item.price_at_purchase)}</strong></li>)}</ul></section>}
      <footer className="order-total"><span>{t("Total paid:")}</span><strong>{money(order.total_price)}</strong></footer>
      <p className="order-receipt-note">{t("Demo purchase; no real payment was processed.")}</p>
      <div className="order-detail-actions"><Link className="orders-action" to="/library">{t("Open library →")}</Link><button type="button" onClick={() => window.print()}>{t("Print receipt")}</button>{order.status === "completed" && <button className="danger" type="button" disabled={refundBusy} onClick={refund}>{refundBusy ? t("Processing…") : t("Refund order")}</button>}</div>
      {order.status === "refunded" && <p className="order-refund-status" role="status">{t("Refunded to your demo wallet.")}</p>}
      {refundError && <p className="order-refund-error" role="alert">{refundError}</p>}
    </article>}
  </section>;
}
