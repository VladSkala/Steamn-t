import { useState } from "react";
import { Link } from "react-router-dom";

import CatalogFeedback from "../components/CatalogFeedback";
import { useCart } from "../hooks/useCart";

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const formatPrice = (price) => {
  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice)) return "Price unavailable";
  return numericPrice === 0 ? "Free" : priceFormatter.format(numericPrice);
};

function CartHeader() {
  return (
    <header className="store-page-title">
      <h1>Cart</h1>
    </header>
  );
}

function CartPage() {
  const { cart, isLoading, error, removeFromCart, refreshCart } = useCart();
  const [removingGameId, setRemovingGameId] = useState(null);
  const [actionError, setActionError] = useState("");

  const handleRetry = () => {
    setActionError("");
    refreshCart().catch(() => {});
  };

  const handleRemove = async (gameId) => {
    setRemovingGameId(gameId);
    setActionError("");
    try {
      await removeFromCart(gameId);
    } catch (requestError) {
      setActionError(
        requestError.response?.data?.detail ||
          "Unable to remove this game from your cart.",
      );
    } finally {
      setRemovingGameId(null);
    }
  };

  if (isLoading && !cart) {
    return (
      <div className="cart-page cart-feedback-page">
        <CartHeader />
        <CatalogFeedback
          kind="loading"
          title="Loading your cart"
          message="Fetching the games you added."
        />
      </div>
    );
  }

  if (error && !cart) {
    return (
      <div className="cart-page cart-feedback-page">
        <CartHeader />
        <CatalogFeedback
          kind="error"
          title="Cart unavailable"
          message={error}
          onRetry={handleRetry}
        />
        <Link className="cart-secondary-link" to="/catalog">
          Back to catalog
        </Link>
      </div>
    );
  }

  const items = Array.isArray(cart?.items) ? cart.items : [];

  if (items.length === 0) {
    return (
      <div className="cart-page">
        <CartHeader />
        <section className="cart-empty-state">
          <div className="cart-empty-icon" aria-hidden="true">
            🛒
          </div>
          <h2>Your cart is empty.</h2>
          <p>Browse the catalog and add a game when something feels right.</p>
          <Link className="primary-button" to="/catalog">
            Browse catalog <span aria-hidden="true">→</span>
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <CartHeader />
      <div className="cart-topline">
        <span>
          {items.length} {items.length === 1 ? "game" : "games"} ready for
          checkout
        </span>
        <Link className="cart-secondary-link" to="/catalog">
          Continue shopping <span aria-hidden="true">→</span>
        </Link>
      </div>

      {(error || actionError) && (
        <div className="cart-inline-error" role="alert">
          <span>{actionError || error}</span>
          <button type="button" onClick={handleRetry}>
            Retry
          </button>
        </div>
      )}

      <div className="cart-layout">
        <section className="cart-items" aria-label="Cart items">
          {items.map((item) => {
            const game = item.game;
            const title = game?.title || "Untitled game";
            const gameId = game?.id;
            const removing = String(removingGameId) === String(gameId);
            return (
              <article className="cart-item" key={item.id}>
                <Link
                  className="cart-item-cover"
                  to={`/games/${gameId}`}
                  aria-label={`Open ${title}`}
                >
                  <span className="cart-item-cover-fallback" aria-hidden="true">
                    S
                  </span>
                  {game?.cover && (
                    <img
                      src={game.cover}
                      alt=""
                      onError={(event) => {
                        event.currentTarget.hidden = true;
                      }}
                    />
                  )}
                </Link>
                <div className="cart-item-info">
                  <Link className="cart-item-title" to={`/games/${gameId}`}>
                    {title}
                  </Link>
                  <p>{game?.developer || "Steamn’t catalog"}</p>
                  <span className="cart-item-quantity">Digital copy</span>
                </div>
                <strong className="cart-item-price">
                  {formatPrice(game?.price)}
                </strong>
                <button
                  type="button"
                  className="cart-remove-button"
                  disabled={removingGameId !== null}
                  onClick={() => handleRemove(gameId)}
                >
                  {removing ? "Removing…" : "Remove"}
                </button>
              </article>
            );
          })}
        </section>

        <aside className="cart-summary">
          <span className="section-kicker">ORDER SUMMARY</span>
          <div className="cart-summary-row">
            <span>Digital games</span>
            <span>{items.length}</span>
          </div>
          <div className="cart-summary-total">
            <span>Total</span>
            <strong>{formatPrice(cart?.total)}</strong>
          </div>
          <Link className="primary-button cart-checkout-button" to="/checkout">
            Checkout <span aria-hidden="true">→</span>
          </Link>
          <p>Demo checkout only. No real payment is processed.</p>
        </aside>
      </div>
    </div>
  );
}

export default CartPage;
