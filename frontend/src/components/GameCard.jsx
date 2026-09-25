import { getLocale, t, useLocale } from "../i18n/index.js";
import { Link } from "react-router-dom";
import WishlistToggleButton from "./WishlistToggleButton";
const fallbackStyles = ["ember", "forest", "gold", "ocean", "sand", "garden", "storm", "silver", "night", "green", "fire", "space", "violet", "stone", "sun", "orange", "fog", "blue"];
const getFallbackStyle = game => {
  const seed = String(game.id ?? game.title ?? "").split("").reduce((total, character) => total + character.charCodeAt(0), 0);
  return fallbackStyles[seed % fallbackStyles.length];
};
const getGenreLabel = genres => {
  if (!Array.isArray(genres)) {
    return t("Genre not specified");
  }
  const names = genres.map(genre => genre?.name?.trim()).filter(Boolean);
  return names.length > 0 ? names.map(name => t(name)).join(" · ") : t("Genre not specified");
};
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
const hideBrokenCover = event => {
  event.currentTarget.hidden = true;
};
function GameCard({
  game,
  variant = "home",
  view = "grid"
}) {
  useLocale();
  const title = game?.title?.trim() || t("Untitled game");
  const genreLabel = getGenreLabel(game?.genres);
  const developer = game?.developer?.trim() || "Steamn’t catalog";
  const fallbackStyle = getFallbackStyle(game ?? {});
  const isOwned = Boolean(game?.is_owned);
  const cardClasses = ["game-card", variant === "catalog" ? "catalog-card" : "", variant === "catalog" && view === "list" ? "list-view" : "", isOwned ? "is-owned" : ""].filter(Boolean).join(" ");
  return <article className={cardClasses}>
      <Link to={`/games/${game.id}`} className="game-card-link" aria-label={t("Open {title}", { title })}>
        <div className={`game-cover game-cover-${fallbackStyle}`}>
          {game?.cover && <img className="game-cover-image" src={game.cover} alt={t("Cover of {title}", { title })} loading="lazy" decoding="async" onError={hideBrokenCover} />}


          {isOwned && <span className="game-owned-badge">
              <span aria-hidden="true">✓</span>{t("In library")}</span>}

          <span className="game-cover-title">{title}</span>
        </div>

        <div className="game-card-content">
          <div className="game-card-copy">
            <h3 title={title}>{title}</h3>
            <p className="game-genres" title={genreLabel}>
              {genreLabel}
            </p>
          </div>

          <div className="game-card-bottom">
            <span className="game-developer" title={developer}>
              {developer}
            </span>

            <span className="game-price">{formatPrice(game?.price)}</span>
          </div>
        </div>
      </Link>
      {!isOwned && <WishlistToggleButton gameId={game?.id} />}
    </article>;
}
export default GameCard;
