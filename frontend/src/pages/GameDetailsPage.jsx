import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import GameImage from "../components/GameImage";
import MediaGallery from "../components/MediaGallery";
import CatalogFeedback from "../components/CatalogFeedback";
import WishlistToggleButton from "../components/WishlistToggleButton";
import useGameDetails from "../hooks/useGameDetails";
import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const formatPrice = (price) => {
  const value = Number(price);
  if (!Number.isFinite(value)) return "Price unavailable";
  return value === 0 ? "Free" : priceFormatter.format(value);
};

const formatDate = (value) => {
  if (!value) return "Not announced";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(date);
};

const getAddError = (requestError) => {
  const payload = requestError.response?.data;
  const gameIdError = payload?.game_id;
  if (Array.isArray(gameIdError)) return gameIdError[0];
  if (typeof gameIdError === "string") return gameIdError;
  if (typeof payload?.detail === "string") return payload.detail;
  return "Unable to add this game to your cart.";
};

function CartActionButton({ gameId, onOwnedConflict }) {
  const location = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const {
    addToCart,
    isInCart,
    isLoading: cartLoading,
    refreshCart,
  } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (authLoading)
    return (
      <button
        type="button"
        className="details-button details-button-primary"
        disabled
      >
        Checking session…
      </button>
    );
  if (!isAuthenticated)
    return (
      <Link
        className="details-button details-button-primary"
        to="/login"
        state={{ from: location }}
      >
        Sign in to add
      </Link>
    );
  if (cartLoading)
    return (
      <button
        type="button"
        className="details-button details-button-primary"
        disabled
      >
        Loading cart…
      </button>
    );
  if (isInCart(gameId))
    return (
      <Link
        className="details-button details-button-primary details-button-in-cart"
        to="/cart"
      >
        ✓ In cart · View
      </Link>
    );

  const handleAdd = async () => {
    setSubmitting(true);
    setError("");
    try {
      await addToCart(gameId);
    } catch (requestError) {
      const message = getAddError(requestError);
      const code = requestError.response?.data?.code;
      if (requestError.response?.status === 400 && code === "already_owned") {
        await Promise.resolve(onOwnedConflict?.());
        return;
      }
      const duplicate =
        requestError.response?.status === 400 &&
        message.toLowerCase().includes("already");
      if (duplicate) {
        try {
          await refreshCart();
          return;
        } catch {
          // Preserve the original API message below.
        }
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="details-cart-action">
      <button
        type="button"
        className="details-button details-button-primary"
        disabled={submitting}
        onClick={handleAdd}
      >
        {submitting ? "Adding…" : "Add to cart"}
      </button>
      {error && (
        <span className="details-cart-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

function Requirements({ text }) {
  if (!text?.trim())
    return (
      <p className="store-muted">System requirements have not been provided.</p>
    );
  const sections = [];
  let current = { title: "System requirements", lines: [] };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (/^(minimum|recommended)( system)?( requirements)?:?$/i.test(line)) {
      if (current.lines.length) sections.push(current);
      current = { title: line.replace(/:$/, ""), lines: [] };
    } else current.lines.push(line);
  }
  if (current.lines.length) sections.push(current);
  return (
    <div className="store-requirement-columns">
      {sections.map((section, index) => (
        <section key={`${section.title}-${index}`}>
          <h3>{section.title}</h3>
          <dl>
            {section.lines.map((line, lineIndex) => {
              const colon = line.indexOf(":");
              return colon > 0 ? (
                <div key={lineIndex}>
                  <dt>{line.slice(0, colon)}</dt>
                  <dd>{line.slice(colon + 1).trim()}</dd>
                </div>
              ) : (
                <div key={lineIndex}>
                  <dd>{line}</dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}

function LoadedGame({ game, onRetry }) {
  const [tab, setTab] = useState("about");
  const title = game.title || "Untitled game";
  const isOwned = Boolean(game.is_owned);
  const genres = Array.isArray(game.genres)
    ? game.genres.filter((genre) => genre?.name)
    : [];
  const images = (game.screenshots || [])
    .filter((image) => image.image)
    .map((image) => ({
      src: image.image,
      alt: image.caption || `Artwork for ${title}`,
    }));
  if (!images.length && (game.hero_image_url || game.cover))
    images.push({
      src: game.hero_image_url || game.cover,
      alt: `Artwork for ${title}`,
    });
  const descriptions = game.description?.split(/\n\s*\n/).filter(Boolean) || [
    "No description available yet.",
  ];
  return (
    <div className="store-game">
      <nav className="store-breadcrumb" aria-label="Breadcrumb">
        <Link to="/catalog">Catalog</Link>
        <span aria-hidden="true">/</span>
        <span>{title}</span>
      </nav>
      <header className="store-game-heading">
        <h1>{title}</h1>
      </header>
      <div
        className="store-game-tabs"
        role="tablist"
        aria-label="Game information"
      >
        <button
          type="button"
          role="tab"
          className={`ui-nav-tab${tab === "about" ? " active" : ""}`}
          id="game-tab-about"
          aria-selected={tab === "about"}
          aria-controls="game-about"
          tabIndex={tab === "about" ? 0 : -1}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "End") {
              event.preventDefault();
              setTab("requirements");
              document.getElementById("game-tab-requirements")?.focus();
            }
          }}
          onClick={() => setTab("about")}
        >
          About this game
        </button>
        <button
          type="button"
          role="tab"
          className={`ui-nav-tab${tab === "requirements" ? " active" : ""}`}
          id="game-tab-requirements"
          aria-selected={tab === "requirements"}
          aria-controls="game-requirements"
          tabIndex={tab === "requirements" ? 0 : -1}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "Home") {
              event.preventDefault();
              setTab("about");
              document.getElementById("game-tab-about")?.focus();
            }
          }}
          onClick={() => setTab("requirements")}
        >
          System requirements
        </button>
        {isOwned && (
          <Link
            to={`/library/games/${game.id}`}
            className="store-game-community-link"
          >
            Community & your review <span aria-hidden="true">↗</span>
          </Link>
        )}
      </div>
      <div className="store-game-layout">
        <div className="store-game-content">
          <section
            id="game-about"
            role="tabpanel"
            aria-labelledby="game-tab-about"
            hidden={tab !== "about"}
          >
            <MediaGallery images={images} title={title} />
            {genres.length > 0 && (
              <div className="store-game-tags" aria-label="Genres">
                {genres.map((genre) => (
                  <Link
                    to={`/catalog?genre=${genre.id}`}
                    key={genre.id ?? genre.name}
                  >
                    {genre.name}
                  </Link>
                ))}
              </div>
            )}
            <section className="store-game-description">
              <h2>About this game</h2>
              {descriptions.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </section>
          </section>
          <section
            id="game-requirements"
            role="tabpanel"
            aria-labelledby="game-tab-requirements"
            hidden={tab !== "requirements"}
          >
            <h2 className="store-requirements-heading">System requirements</h2>
            <Requirements text={game.requirements} />
          </section>
        </div>
        <aside
          className="store-purchase"
          aria-label="Game purchase and information"
        >
          <GameImage
            src={game.cover}
            alt={`Cover for ${title}`}
            className="store-purchase-art"
          />
          <div className="store-purchase-body">
            {isOwned ? (
              <div className="store-owned-state" role="status">
                <span>✓ In your Library</span>
                <Link
                  className="primary-button"
                  to={`/library/games/${game.id}`}
                >
                  Open in Library <span aria-hidden="true">→</span>
                </Link>
              </div>
            ) : (
              <>
                <div className="store-purchase-price">
                  <span>Standard edition</span>
                  <strong>{formatPrice(game.price)}</strong>
                </div>
                <CartActionButton gameId={game.id} onOwnedConflict={onRetry} />
                <WishlistToggleButton
                  gameId={game.id}
                  variant="details"
                  onOwnedConflict={onRetry}
                />
              </>
            )}
            <dl className="store-purchase-facts">
              <div>
                <dt>Developer</dt>
                <dd>{game.developer || "Not specified"}</dd>
              </div>
              <div>
                <dt>Release date</dt>
                <dd>{formatDate(game.release_date)}</dd>
              </div>
              {genres.length > 0 && (
                <div>
                  <dt>Genre</dt>
                  <dd>{genres.map((genre) => genre.name).join(", ")}</dd>
                </div>
              )}
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}

function GameDetailsPage() {
  const { gameId } = useParams();
  const { game, loading, error, retry } = useGameDetails(gameId);
  if (loading || error || !game)
    return (
      <div className="store-game store-game-feedback">
        <CatalogFeedback
          kind={loading ? "loading" : error === "not-found" ? "empty" : "error"}
          title={
            loading
              ? "Loading game"
              : error === "not-found"
                ? "Game not found"
                : "Game unavailable"
          }
          message={
            loading
              ? "Getting game details."
              : error === "not-found"
                ? "This game may no longer be available."
                : "Please try again."
          }
          onRetry={!loading && error !== "not-found" ? retry : undefined}
        />
        {!loading && (
          <Link className="details-back-link" to="/catalog">
            Back to catalog
          </Link>
        )}
      </div>
    );
  return <LoadedGame key={game.id} game={game} onRetry={retry} />;
}

export default GameDetailsPage;
