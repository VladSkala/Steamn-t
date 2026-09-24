import { getLocale, t, useLocale } from "../i18n/index.js";
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import GameImage from "../components/GameImage";
import MediaGallery from "../components/MediaGallery";
import CatalogFeedback from "../components/CatalogFeedback";
import WishlistToggleButton from "../components/WishlistToggleButton";
import ReviewsSection from "../components/ReviewsSection";
import useGameDetails from "../hooks/useGameDetails";
import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import { createReturnLocation } from "../utils/returnLocation";
import { getDLC } from "../api/dlc";
const formatPrice = price => {
  const value = Number(price);
  if (!Number.isFinite(value)) return t("Price unavailable");
  return value === 0 ? t("Free") : new Intl.NumberFormat(getLocale(), { style: "currency", currency: "USD" }).format(value);
};
const formatDate = value => {
  if (!value) return t("Not announced");
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(document.documentElement.dataset.locale || "en", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);
};
const getAddError = requestError => {
  const payload = requestError.response?.data;
  const gameIdError = payload?.game_id;
  if (Array.isArray(gameIdError)) return gameIdError[0];
  if (typeof gameIdError === "string") return gameIdError;
  if (typeof payload?.detail === "string") return payload.detail;
  return t("Unable to add this game to your cart.");
};
function CartActionButton({
  gameId,
  onOwnedConflict
}) {
  useLocale();
  const location = useLocation();
  const {
    isAuthenticated,
    isLoading: authLoading
  } = useAuth();
  const {
    addToCart,
    isInCart,
    isLoading: cartLoading,
    refreshCart
  } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  if (authLoading) return <button type="button" className="details-button details-button-primary" disabled>{t("Checking session…")}</button>;
  if (!isAuthenticated) return <Link className="details-button details-button-primary" to="/login" state={{
    from: createReturnLocation(location)
  }}>{t("Sign in to add")}</Link>;
  if (cartLoading) return <button type="button" className="details-button details-button-primary" disabled>{t("Loading cart…")}</button>;
  if (isInCart(gameId)) return <Link className="details-button details-button-primary details-button-in-cart" to="/cart">{t("✓ In cart · View")}</Link>;
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
      const duplicate = requestError.response?.status === 400 && message.toLowerCase().includes("already");
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
  return <div className="details-cart-action">
      <button type="button" className="details-button details-button-primary" disabled={submitting} onClick={handleAdd}>
        {submitting ? t("Adding…") : t("Add to cart")}
      </button>
      {error && <span className="details-cart-error" role="alert">
          {t(error)}
        </span>}
    </div>;
}
function Requirements({
  text
}) {
  useLocale();
  if (!text?.trim()) return <p className="store-muted">{t("System requirements have not been provided.")}</p>;
  const sections = [];
  let current = {
    title: t("System requirements"),
    lines: []
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (/^(minimum|recommended)( system)?( requirements)?:?$/i.test(line)) {
      if (current.lines.length) sections.push(current);
      current = {
        title: line.replace(/:$/, ""),
        lines: []
      };
    } else current.lines.push(line);
  }
  if (current.lines.length) sections.push(current);
  return <div className="store-requirement-columns">
      {sections.map((section, index) => <section key={`${section.title}-${index}`}>
          <h3>{section.title}</h3>
          <dl>
            {section.lines.map((line, lineIndex) => {
          const colon = line.indexOf(":");
          return colon > 0 ? <div key={lineIndex}>
                  <dt>{line.slice(0, colon)}</dt>
                  <dd>{line.slice(colon + 1).trim()}</dd>
                </div> : <div key={lineIndex}>
                  <dd>{line}</dd>
                </div>;
        })}
          </dl>
        </section>)}
    </div>;
}
function GameDLCSection({
  gameId
}) {
  useLocale();
  const [state, setState] = useState({
    loading: true,
    items: [],
    error: ""
  });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getDLC({
      game: gameId,
      page_size: 4
    }, {
      signal: controller.signal
    }).then(data => {
      if (!controller.signal.aborted) setState({
        loading: false,
        items: data.results || [],
        error: ""
      });
    }).catch(() => {
      if (!controller.signal.aborted) setState({
        loading: false,
        items: [],
        error: t("DLC could not be loaded.")
      });
    });
    return () => controller.abort();
  }, [gameId, retry]);
  if (!state.loading && !state.error && state.items.length === 0) return null;
  return <section className="store-game-description game-dlc-section" aria-labelledby="game-dlc-heading">
    <h2 id="game-dlc-heading">{t("Downloadable content")}</h2>
    {state.loading && <p className="store-muted">{t("Loading DLC…")}</p>}
    {state.error && <p role="alert">{t(state.error)} <button type="button" onClick={() => {
        setState({
          loading: true,
          items: [],
          error: ""
        });
        setRetry(n => n + 1);
      }}>{t("Retry")}</button></p>}
    <div className="store-game-grid">{state.items.map(item => <article className="store-game-card" key={item.id}>
      <h3><Link to={`/dlc/${item.id}`}>{item.title}</Link></h3>
      <p>{item.description}</p><strong>{formatPrice(item.price)}</strong>
    </article>)}</div>
    {!state.loading && !state.error && state.items.length > 0 && <Link className="details-button details-button-secondary" to={`/games/${gameId}/dlc`}>{t("View all DLC →")}</Link>}
  </section>;
}
function LoadedGame({
  game,
  onRetry
}) {
  useLocale();
  const [tab, setTab] = useState("about");
  const title = game.title || t("Untitled game");
  const isOwned = Boolean(game.is_owned);
  const genres = Array.isArray(game.genres) ? game.genres.filter(genre => genre?.name) : [];
  const images = (game.screenshots || []).filter(image => image.image).map(image => ({
    src: image.image,
    alt: image.caption || t("Artwork for {title}", { title })
  }));
  if (!images.length && (game.hero_image_url || game.cover)) images.push({
    src: game.hero_image_url || game.cover,
    alt: t("Artwork for {title}", { title })
  });
  const descriptions = game.description?.split(/\n\s*\n/).filter(Boolean) || [t("No description available yet.")];
  return <div className="store-game">
      <nav className="store-breadcrumb" aria-label={t("Breadcrumb")}>
        <Link to="/catalog">{t("Catalog")}</Link>
        <span aria-hidden="true">/</span>
        <span>{title}</span>
      </nav>
      <header className="store-game-heading">
        <h1>{title}</h1>
      </header>
      <div className="store-game-tabs" role="tablist" aria-label={t("Game information")}>
        <button type="button" role="tab" className={`ui-nav-tab${tab === "about" ? " active" : ""}`} id="game-tab-about" aria-selected={tab === "about"} aria-controls="game-about" tabIndex={tab === "about" ? 0 : -1} onKeyDown={event => {
        if (event.key === "ArrowRight" || event.key === "End") {
          event.preventDefault();
          setTab("requirements");
          document.getElementById("game-tab-requirements")?.focus();
        }
      }} onClick={() => setTab("about")}>{t("About this game")}</button>
        <button type="button" role="tab" className={`ui-nav-tab${tab === "requirements" ? " active" : ""}`} id="game-tab-requirements" aria-selected={tab === "requirements"} aria-controls="game-requirements" tabIndex={tab === "requirements" ? 0 : -1} onKeyDown={event => {
        if (event.key === "ArrowLeft" || event.key === "Home") {
          event.preventDefault();
          setTab("about");
          document.getElementById("game-tab-about")?.focus();
        }
      }} onClick={() => setTab("requirements")}>{t("System requirements")}</button>
        <Link to={`/community?game=${game.id}`} className="store-game-community-link">{t("Community")}<span aria-hidden="true">↗</span>
        </Link>
      </div>
      <div className="store-game-layout">
        <div className="store-game-content">
          <section id="game-about" role="tabpanel" aria-labelledby="game-tab-about" hidden={tab !== "about"}>
            <MediaGallery images={images} title={title} />
            {genres.length > 0 && <div className="store-game-tags" aria-label={t("Genres")}>
                {genres.map(genre => <Link to={`/catalog?genre=${genre.id}`} key={genre.id ?? genre.name}>
                    {t(genre.name)}
                  </Link>)}
              </div>}
            <section className="store-game-description">
              <h2>{t("About this game")}</h2>
              {descriptions.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            </section>
          </section>
          <section id="game-requirements" role="tabpanel" aria-labelledby="game-tab-requirements" hidden={tab !== "requirements"}>
            <h2 className="store-requirements-heading">{t("System requirements")}</h2>
            <Requirements text={game.requirements} />
          </section>
        </div>
        <aside className="store-purchase" aria-label={t("Game purchase and information")}>
          <GameImage src={game.cover} alt={t("Cover for {title}", { title })} className="store-purchase-art" />
          <div className="store-purchase-body">
            {isOwned ? <div className="store-owned-state" role="status">
                <span>{t("✓ In your Library")}</span>
                <Link className="primary-button" to={`/library/games/${game.id}`}>{t("Open in Library")}<span aria-hidden="true">→</span>
                </Link>
              </div> : <>
                <div className="store-purchase-price">
                  <span>{t("Standard edition")}</span>
                  <strong>{formatPrice(game.price)}</strong>
                </div>
                <CartActionButton gameId={game.id} onOwnedConflict={onRetry} />
                <WishlistToggleButton gameId={game.id} variant="details" onOwnedConflict={onRetry} />
              </>}
            <dl className="store-purchase-facts">
              <div>
                <dt>{t("Developer")}</dt>
                <dd>{game.developer || t("Not specified")}</dd>
              </div>
              <div>
                <dt>{t("Release date")}</dt>
                <dd>{formatDate(game.release_date)}</dd>
              </div>
              {genres.length > 0 && <div>
                  <dt>{t("Genre")}</dt>
                  <dd>{genres.map(genre => t(genre.name)).join(", ")}</dd>
                </div>}
            </dl>
          </div>
        </aside>
      </div>
      <ReviewsSection gameId={game.id} isOwned={isOwned} />
      <GameDLCSection gameId={game.id} />

    </div>;
}
function GameDetailsPage() {
  useLocale();
  const {
    gameId
  } = useParams();
  const {
    game,
    loading,
    error,
    retry
  } = useGameDetails(gameId);
  if (loading || error || !game) return <div className="store-game store-game-feedback">
        <CatalogFeedback kind={loading ? "loading" : error === "not-found" ? "empty" : "error"} title={loading ? t("Loading game") : error === "not-found" ? t("Game not found") : t("Game unavailable")} message={loading ? t("Getting game details.") : error === "not-found" ? t("This game may no longer be available.") : t("Please try again.")} onRetry={!loading && error !== "not-found" ? retry : undefined} />
        {!loading && <Link className="details-back-link" to="/catalog">{t("Back to catalog")}</Link>}
      </div>;
  return <LoadedGame key={game.id} game={game} onRetry={retry} />;
}
export default GameDetailsPage;
