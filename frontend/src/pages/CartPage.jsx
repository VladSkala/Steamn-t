import { getLocale, t, useLocale } from "../i18n/index.js";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CatalogFeedback from "../components/CatalogFeedback";
import { useCart } from "../hooks/useCart";
import { removeCartDLC } from "../api/cart";
const formatPrice = price => {
  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice)) return t("Price unavailable");
  return numericPrice === 0 ? t("Free") : new Intl.NumberFormat(getLocale(), { style: "currency", currency: "USD" }).format(numericPrice);
};
function CartHeader() {
  useLocale();
  return <header className="store-page-title">
      <h1>{t("Cart")}</h1>
    </header>;
}
function CartPage() {
  useLocale();
  const {
    cart,
    isLoading,
    error,
    removeFromCart,
    refreshCart
  } = useCart();
  const [removingGameId, setRemovingGameId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [removingDLCId, setRemovingDLCId] = useState(null);
  useEffect(() => {
    refreshCart().catch(() => {});
  }, [refreshCart]);
  const handleRetry = () => {
    setActionError("");
    refreshCart().catch(() => {});
  };
  const handleRemove = async gameId => {
    setRemovingGameId(gameId);
    setActionError("");
    try {
      await removeFromCart(gameId);
    } catch (requestError) {
      setActionError(requestError.response?.data?.detail || t("Unable to remove this game from your cart."));
    } finally {
      setRemovingGameId(null);
    }
  };
  if (isLoading && !cart) {
    return <div className="cart-page cart-feedback-page">
        <CartHeader />
        <CatalogFeedback kind="loading" title={t("Loading your cart")} message={t("Fetching the games you added.")} />
      </div>;
  }
  if (error && !cart) {
    return <div className="cart-page cart-feedback-page">
        <CartHeader />
        <CatalogFeedback kind="error" title={t("Cart unavailable")} message={t(error)} onRetry={handleRetry} />
        <Link className="cart-secondary-link" to="/catalog">{t("Back to catalog")}</Link>
      </div>;
  }
  const items = Array.isArray(cart?.items) ? cart.items : [];
  const dlcItems = Array.isArray(cart?.dlc_items) ? cart.dlc_items : [];
  const handleRemoveDLC = async dlcId => {
    setRemovingDLCId(dlcId);
    setActionError("");
    try {
      await removeCartDLC(dlcId);
      await refreshCart();
    } catch (requestError) {
      setActionError(requestError?.response?.data?.detail || t("Unable to remove DLC."));
    } finally {
      setRemovingDLCId(null);
    }
  };
  if (items.length === 0 && dlcItems.length === 0) {
    return <div className="cart-page">
        <CartHeader />
        <section className="cart-empty-state">
          <div className="cart-empty-icon" aria-hidden="true">
            🛒
          </div>
          <h2>{t("Your cart is empty.")}</h2>
          <p>{t("Browse the catalog and add a game when something feels right.")}</p>
          <Link className="primary-button" to="/catalog">{t("Browse catalog")}<span aria-hidden="true">→</span>
          </Link>
        </section>
      </div>;
  }
  return <div className="cart-page">
      <CartHeader />
      <div className="cart-topline">
        <span>
          {items.length + dlcItems.length}{t("digital items ready for checkout")}</span>
        <Link className="cart-secondary-link" to="/catalog">{t("Continue shopping")}<span aria-hidden="true">→</span>
        </Link>
      </div>

      {(error || actionError) && <div className="cart-inline-error" role="alert">
          <span>{actionError || error}</span>
          <button type="button" onClick={handleRetry}>{t("Retry")}</button>
        </div>}

      <div className="cart-layout">
        <section className="cart-items" aria-label={t("Cart items")}>
          {items.map(item => {
          const game = item.game;
          const title = game?.title || t("Untitled game");
          const gameId = game?.id;
          const removing = String(removingGameId) === String(gameId);
          return <article className="cart-item" key={item.id}>
                <Link className="cart-item-cover" to={`/games/${gameId}`} aria-label={t("Open {title}", { title })}>
                  <span className="cart-item-cover-fallback" aria-hidden="true">
                    S
                  </span>
                  {game?.cover && <img src={game.cover} alt="" onError={event => {
                event.currentTarget.hidden = true;
              }} />}
                </Link>
                <div className="cart-item-info">
                  <Link className="cart-item-title" to={`/games/${gameId}`}>
                    {title}
                  </Link>
                  <p>{game?.developer || t("Steamn’t catalog")}</p>
                  <span className="cart-item-quantity">{t("Digital copy")}</span>
                </div>
                <strong className="cart-item-price">
                  {formatPrice(game?.price)}
                </strong>
                <button type="button" className="cart-remove-button" disabled={removingGameId !== null} onClick={() => handleRemove(gameId)}>
                  {removing ? t("Removing…") : t("Remove")}
                </button>
              </article>;
        })}
          {dlcItems.map(item => <article className="cart-item" key={`dlc-${item.id}`}>
            <Link className="cart-item-cover" to={`/dlc/${item.dlc.id}`}>
              {item.dlc.cover ? <img src={item.dlc.cover} alt="" /> : <span className="cart-item-cover-fallback">DLC</span>}
            </Link>
            <div className="cart-item-info"><Link className="cart-item-title" to={`/dlc/${item.dlc.id}`}>{item.dlc.title}</Link><p>{t("Downloadable content")}</p></div>
            <strong className="cart-item-price">{formatPrice(item.dlc.price)}</strong>
            <button type="button" className="cart-remove-button" disabled={removingDLCId !== null} onClick={() => handleRemoveDLC(item.dlc.id)}>{removingDLCId === item.dlc.id ? t("Removing…") : t("Remove")}</button>
          </article>)}
        </section>

        <aside className="cart-summary">
          <span className="section-kicker">{t("ORDER SUMMARY")}</span>
          <div className="cart-summary-row">
            <span>{t("Digital games")}</span>
            <span>{items.length}</span>
          </div>
          <div className="cart-summary-row"><span>DLC</span><span>{dlcItems.length}</span></div>
          <div className="cart-summary-total">
            <span>{t("Total")}</span>
            <strong>{formatPrice(cart?.total)}</strong>
          </div>
          <Link className="primary-button cart-checkout-button" to="/checkout">{t("Checkout")}<span aria-hidden="true">→</span>
          </Link>
          <p>{t("Demo checkout only. No real payment is processed.")}</p>
        </aside>
      </div>
    </div>;
}
export default CartPage;
