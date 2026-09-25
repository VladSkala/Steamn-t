import { getLocale, t, useLocale } from "../i18n/index.js";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import CatalogFeedback from "../components/CatalogFeedback";
import { checkoutCart } from "../api/checkout";
import { useCart } from "../hooks/useCart";
import { useWishlist } from "../hooks/useWishlist";
import { useAuth } from "../hooks/useAuth";
const formatPrice = price => {
  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice)) {
    return t("Price unavailable");
  }
  if (numericPrice === 0) {
    return t("Free");
  }
  return new Intl.NumberFormat(getLocale(), { style: "currency", currency: "USD" }).format(numericPrice);
};
const getCheckoutError = error => error?.response?.data?.detail || error?.message || t("Demo payment could not be completed. Please try again.");
const isCanceledRequest = error => error?.code === "ERR_CANCELED" || error?.name === "CanceledError" || error?.name === "AbortError";
function CheckoutPage() {
  useLocale();
  const navigate = useNavigate();
  const {
    reloadProfile
  } = useAuth();
  const {
    cart,
    isLoading,
    error,
    refreshCart,
    removeFromCart,
    clearCart
  } = useCart();
  const {
    refreshWishlist,
    removePurchasedGames
  } = useWishlist();
  const [isPaying, setIsPaying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("demo");
  const [checkoutError, setCheckoutError] = useState("");
  const [alreadyOwnedGameIds, setAlreadyOwnedGameIds] = useState([]);
  const mountedRef = useRef(true);
  const checkoutControllerRef = useRef(null);
  const payingRef = useRef(false);
  useEffect(() => () => {
    mountedRef.current = false;
    checkoutControllerRef.current?.abort();
  }, []);
  const items = Array.isArray(cart?.items) ? cart.items : [];
  const dlcItems = Array.isArray(cart?.dlc_items) ? cart.dlc_items : [];
  const handleRetry = () => {
    setCheckoutError("");
    setAlreadyOwnedGameIds([]);
    refreshCart().catch(() => {});
  };
  const handlePayDemo = async () => {
    if (payingRef.current) return;
    const controller = new AbortController();
    checkoutControllerRef.current = controller;
    payingRef.current = true;
    setIsPaying(true);
    setCheckoutError("");
    setAlreadyOwnedGameIds([]);
    try {
      const order = await checkoutCart({
        signal: controller.signal,
        paymentMethod
      });
      if (controller.signal.aborted || !mountedRef.current) return;
      const purchasedGameIds = Array.isArray(order?.items) ? order.items.map(item => item?.game?.id).filter(gameId => gameId != null) : items.map(item => item?.game?.id).filter(gameId => gameId != null);
      removePurchasedGames(purchasedGameIds);
      clearCart();
      await Promise.allSettled([refreshCart(), refreshWishlist(), reloadProfile()]);
      if (controller.signal.aborted || !mountedRef.current) return;
      navigate(`/orders/${order.id}`, {
        replace: true,
        state: {
          checkoutSuccess: true
        }
      });
    } catch (requestError) {
      if (isCanceledRequest(requestError) || !mountedRef.current) return;
      const responseData = requestError?.response?.data;
      const ownedIds = Array.isArray(responseData?.game_ids) ? responseData.game_ids.map(String) : [];
      if (responseData?.code === "already_owned") {
        setAlreadyOwnedGameIds(ownedIds);
        const ownedTitles = items.filter(item => ownedIds.includes(String(item?.game?.id))).map(item => item?.game?.title).filter(Boolean);
        const titleMessage = ownedTitles.length > 0 ? t(ownedTitles.length === 1 ? "{titles} is already in your library." : "{titles} are already in your library.", { titles: ownedTitles.join(", ") }) : t("One or more games are already in your library.");
        const removalMessage = t(ownedTitles.length === 1 ? "Remove it from your cart before checkout." : "Remove them from your cart before checkout.");
        setCheckoutError(`${titleMessage} ${removalMessage}`);
      } else {
        setCheckoutError(getCheckoutError(requestError));
      }
    } finally {
      if (checkoutControllerRef.current === controller) {
        checkoutControllerRef.current = null;
        payingRef.current = false;
        if (mountedRef.current) setIsPaying(false);
      }
    }
  };
  if (isLoading && !cart) {
    return <div className="checkout-page checkout-feedback-page">
        <CatalogFeedback kind="loading" title={t("Loading checkout")} message={t("Preparing your order summary.")} />
      </div>;
  }
  if (error && !cart) {
    return <div className="checkout-page checkout-feedback-page">
        <CatalogFeedback kind="error" title={t("Checkout unavailable")} message={t(error)} onRetry={handleRetry} />
        <Link className="cart-secondary-link" to="/cart">{t("Back to cart")}</Link>
      </div>;
  }
  if (items.length === 0 && dlcItems.length === 0) {
    return <div className="checkout-page">
        <section className="checkout-empty-state">
          <span className="section-kicker">{t("CHECKOUT")}</span>
          <h1>{t("Your cart is empty.")}</h1>
          <p>{t("Add a game or DLC before starting the demo checkout.")}</p>
          <Link className="primary-button" to="/catalog">{t("Browse catalog")}<span>→</span>
          </Link>
        </section>
      </div>;
  }
  return <div className="checkout-page">
      <section className="checkout-hero">
        <div>
          <span className="section-kicker">{t("DEMO CHECKOUT")}</span>
          <h1>{t("Complete your order.")}</h1>
          <p>{t("This is a demo purchase. No real payment is processed.")}</p>
        </div>
        <Link className="cart-secondary-link" to="/cart">{t("Back to cart")}<span>←</span>
        </Link>
      </section>

      {checkoutError && <div className="checkout-error" role="alert">
          <div>
            <strong>{t("Payment failed")}</strong>
            <span>{checkoutError}</span>
          </div>
          <button type="button" onClick={() => setCheckoutError("")}>{t("Dismiss")}</button>
        </div>}

      <div className="checkout-layout">
        <section className="checkout-card" aria-labelledby="checkout-items-title">
          <div className="checkout-card-heading">
            <div>
              <span className="section-kicker">{t("ORDER")}</span>
              <h2 id="checkout-items-title">{t("Your digital items")}</h2>
            </div>
            <span>
              {items.length + dlcItems.length}{t("items")}</span>
          </div>

          <div className="checkout-items">
            {items.map(item => {
            const game = item.game;
            const title = game?.title || t("Untitled game");
            const gameId = game?.id;
            return <article className="checkout-item" key={item.id}>
                  <div className="checkout-item-cover" aria-hidden="true">
                    <span>S</span>
                    {game?.cover && <img src={game.cover} alt="" onError={event => {
                  event.currentTarget.hidden = true;
                }} />}
                  </div>
                  <div className="checkout-item-info">
                    <Link to={`/games/${gameId}`}>{title}</Link>
                    <span>{game?.developer || t("Steamn’t catalog")}</span>
                  </div>
                  <strong>{formatPrice(game?.price)}</strong>
                  {alreadyOwnedGameIds.includes(String(gameId)) && <button type="button" className="checkout-remove-owned" onClick={async () => {
                setCheckoutError("");
                setAlreadyOwnedGameIds([]);
                try {
                  await removeFromCart(gameId);
                } catch (removeError) {
                  setCheckoutError(removeError?.response?.data?.detail || "Unable to remove this game from your cart.");
                }
              }}>{t("Remove from cart")}</button>}
                </article>;
          })}
            {dlcItems.map(item => <article className="checkout-item" key={`dlc-${item.id}`}>
              <div className="checkout-item-cover" aria-hidden="true">{item.dlc.cover && <img src={item.dlc.cover} alt="" />}</div>
              <div className="checkout-item-info"><Link to={`/dlc/${item.dlc.id}`}>{item.dlc.title}</Link><span>DLC</span></div>
              <strong>{formatPrice(item.dlc.price)}</strong>
            </article>)}
          </div>
        </section>

        <aside className="checkout-summary">
          <label>{t("Payment method")}<select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)} disabled={isPaying}><option value="demo">{t("Simulated payment")}</option><option value="wallet">{t("Wallet balance")}</option></select></label>
          <span className="section-kicker">{t("SUMMARY")}</span>
          <div className="checkout-summary-row">
            <span>{t("Items")}</span>
            <span>{items.length + dlcItems.length}</span>
          </div>
          <div className="checkout-summary-total">
            <span>{t("Total")}</span>
            <strong>{formatPrice(cart?.total)}</strong>
          </div>

          <button type="button" className="primary-button checkout-pay-button" onClick={handlePayDemo} disabled={isPaying}>
            {isPaying ? t("Processing…") : paymentMethod === "wallet" ? t("Pay with wallet") : t("Pay Demo")}
          </button>

          <p>{t("Demo mode only. A successful checkout creates the order and moves purchased games and DLC into your library.")}</p>
          <p><Link to="/legal/refund">{t("Read the demo refund policy")}</Link></p>
        </aside>
      </div>
    </div>;
}
export default CheckoutPage;
