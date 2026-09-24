import { t, useLocale, getLocale } from "../i18n/index.js";
import { useState } from "react";
import { Link } from "react-router-dom";
import CatalogFeedback from "../components/CatalogFeedback";
import GameCard from "../components/GameCard";
import GameImage from "../components/GameImage";
import useHomeShelves from "../hooks/useHomeShelves";
import useFeaturedGames from "../hooks/useFeaturedGames";
const money = price => Number(price) === 0 ? t("Free") : new Intl.NumberFormat(getLocale(), {
  style: "currency",
  currency: "USD"
}).format(Number(price));
function FeaturedCarousel({
  games
}) {
  useLocale();
  const [index, setIndex] = useState(0);
  if (!games.length) return null;
  const active = index % games.length;
  const game = games[active];
  const select = offset => setIndex(current => (current + offset + games.length) % games.length);
  return <section className="store-featured" aria-label={t("Featured games")} aria-roledescription="carousel">
      <div className="store-featured-slide">
        <GameImage src={game.cover} alt={t("Artwork for {title}", { title: game.title })} priority />
        <div className="store-featured-shade" aria-hidden="true" />
        <div className="store-featured-copy" aria-live="polite">
          <span className="store-eyebrow">{t("Featured game")}</span>
          <h1>{game.title}</h1>
          <p>{game.description?.split("\n").find(line => line.trim())}</p>
          <div className="store-featured-actions">
            <Link className="primary-button" to={`/games/${game.id}`}>{t("View game")}<span aria-hidden="true">↗</span>
            </Link>
            <span className="store-featured-price">
              {game.is_owned ? t("In your Library") : money(game.price)}
            </span>
          </div>
        </div>
        {games.length > 1 && <div className="store-featured-arrows">
            <button type="button" onClick={() => select(-1)} aria-label={t("Previous featured game")}>
              ←
            </button>
            <span>
              {active + 1} / {games.length}
            </span>
            <button type="button" onClick={() => select(1)} aria-label={t("Next featured game")}>
              →
            </button>
          </div>}
      </div>
      {games.length > 1 && <div className="store-featured-thumbs" aria-label={t("Choose a featured game")}>
          {games.map((item, itemIndex) => <button type="button" key={item.id} aria-label={t("Feature {title}", { title: item.title })} aria-pressed={itemIndex === active} className={itemIndex === active ? "active" : ""} onClick={() => setIndex(itemIndex)}>
              <GameImage src={item.cover} alt="" />
            </button>)}
        </div>}
    </section>;
}
function Shelf({
  title,
  games,
  wide = false
}) {
  useLocale();
  if (!games.length) return null;
  return <section className={`store-shelf${wide ? " is-wide" : ""}`}>
      <div className="store-section-heading">
        <h2>{title}</h2>
        <Link to="/catalog">{t("View all")}<span aria-hidden="true">→</span>
        </Link>
      </div>
      <div className="store-shelf-grid">
        {games.map(game => <GameCard key={game.id} game={game} />)}
      </div>
    </section>;
}
function CompactColumn({
  title,
  games
}) {
  useLocale();
  if (!games.length) return null;
  return <section className="store-compact-column">
      <div className="store-section-heading">
        <h2>{title}</h2>
        <Link to="/catalog" aria-label={t("Browse {section}", { section: title.toLocaleLowerCase() })}>
          →
        </Link>
      </div>
      {games.map(game => <Link key={game.id} className="store-compact-game" to={`/games/${game.id}`}>
          <GameImage src={game.cover} alt="" />
          <div>
            <h3>{game.title}</h3>
            <span>
              {game.genres?.slice(0, 2).map(genre => t(genre.name)).join(" · ")}
            </span>
            <strong>{game.is_owned ? t("In Library") : money(game.price)}</strong>
          </div>
        </Link>)}
    </section>;
}
export default function HomePage() {
  useLocale();
  const {
    data: shelves,
    loading,
    error,
    retry
  } = useHomeShelves();
  const games = shelves?.recent || [];
  const genres = shelves?.genres || [];
  const {
    games: featured,
    loading: featuredLoading,
    error: featuredError,
    retry: retryFeatured
  } = useFeaturedGames();
  const recent = shelves?.recent || [];
  const free = shelves?.free || [];
  const budget = shelves?.budget || [];
  return <div className="store-home">
      {featuredLoading ? <CatalogFeedback kind="loading" title={t("Loading featured games")} message={t("Picking the games selected for the home page.")} className="home-featured-feedback" /> : featuredError ? <CatalogFeedback kind="error" title={t("Featured games unavailable")} message={featuredError} onRetry={retryFeatured} className="home-featured-feedback" /> : featured.length === 0 ? <div className="home-featured-empty">
          <div>
            <span className="store-eyebrow">{t("Featured games")}</span>
            <h1>{t("Explore the complete catalog")}</h1>
            <p>{t("No games are featured right now. Every available game remains easy to find in the catalog.")}</p>
            <Link className="primary-button" to="/catalog">{t("Explore catalog")}<span aria-hidden="true">→</span>
            </Link>
          </div>
        </div> : <FeaturedCarousel games={featured} />}

      {loading ? <CatalogFeedback kind="loading" title={t("Loading catalog")} message={t("Getting the rest of the store ready.")} className="home-catalog-feedback" /> : error ? <CatalogFeedback kind="error" title={t("Catalog unavailable")} message={t(error)} onRetry={retry} className="home-catalog-feedback" /> : !games.length ? <CatalogFeedback kind="empty" title={t("The catalog is empty")} message={t("Games will appear here as they are added to the catalog.")} className="home-catalog-feedback" /> : <>
          <Shelf title={t("Recent releases")} games={recent.slice(0, 3)} wide />
          <Shelf title={t(shelves?.recommendation_reason || "Recommended for you")} games={shelves?.recommendations || []} />
          {budget.length > 0 && <Shelf title={t("Under $20")} games={budget.slice(0, 4)} />}
          {genres.length > 0 && <section className="store-genres" aria-labelledby="home-genres-heading">
              <div className="store-section-heading">
                <h2 id="home-genres-heading">{t("Browse by genre")}</h2>
              </div>
              <div>
                {genres.map(genre => <Link key={genre.id} to={`/catalog?genre=${genre.id}`}>
                    {t(genre.name)}
                  </Link>)}
              </div>
            </section>}
          {games.length > 3 && <div className="store-compact-columns">
              <CompactColumn title={t("Recent releases")} games={recent.slice(0, 3)} />
              <CompactColumn title={t("Community favourites")} games={shelves?.popular || []} />
              <CompactColumn title={t("Free to explore")} games={free.slice(0, 3)} />
            </div>}
        </>}
    </div>;
}
