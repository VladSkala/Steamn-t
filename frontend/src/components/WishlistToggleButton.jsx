import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { useWishlist } from "../hooks/useWishlist";

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.7-7.5 1.1-1.1a5.5 5.5 0 0 0 0-7.8Z" />
    </svg>
  );
}

const getActionError = (requestError) => {
  const payload = requestError?.response?.data;
  const gameError = payload?.game_id;

  if (Array.isArray(gameError) && gameError.length > 0)
    return String(gameError[0]);
  if (typeof gameError === "string") return gameError;
  if (typeof payload?.detail === "string") return payload.detail;

  return "Unable to update your Wishlist.";
};

function WishlistToggleButton({
  gameId,
  variant = "card",
  isOwned = false,
  onOwnedConflict,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const {
    isLoading: wishlistLoading,
    isPending,
    isWishlisted,
    toggleWishlist,
  } = useWishlist();
  const [actionError, setActionError] = useState("");

  const active = isAuthenticated && isWishlisted(gameId);
  const pending = isAuthenticated && isPending(gameId);
  const busy = authLoading || (isAuthenticated && (wishlistLoading || pending));
  const missingGame = gameId == null;

  const actionLabel = active ? "Remove from Wishlist" : "Add to Wishlist";

  const handleToggle = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    setActionError("");

    if (isOwned) return;

    if (!isAuthenticated) {
      navigate("/login", { state: { from: location } });
      return;
    }

    try {
      await toggleWishlist(gameId);
    } catch (requestError) {
      const actionMessage = getActionError(requestError);
      const ownershipConflict =
        requestError?.response?.status === 400 &&
        actionMessage.toLowerCase().includes("library");
      if (ownershipConflict) {
        await Promise.resolve(onOwnedConflict?.());
        return;
      }
      setActionError(actionMessage);
    }
  };

  const buttonClassName = [
    variant === "details"
      ? "details-button details-button-secondary wishlist-details-button"
      : "game-wishlist-button",
    active ? "active" : "",
    busy ? "is-loading" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (isOwned) return null;

  return (
    <div className={`wishlist-toggle wishlist-toggle-${variant}`}>
      <button
        type="button"
        className={buttonClassName}
        aria-label={actionLabel}
        aria-busy={busy}
        aria-pressed={active}
        title={!isAuthenticated ? "Sign in to save this game" : actionLabel}
        disabled={busy || missingGame}
        onClick={handleToggle}
      >
        <HeartIcon />
      </button>
      {actionError && (
        <span className="wishlist-action-error" role="alert">
          {actionError}
        </span>
      )}
    </div>
  );
}

export default WishlistToggleButton;
