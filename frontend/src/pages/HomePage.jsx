import { useState } from "react";
import { Link } from "react-router-dom";

import CatalogFeedback from "../components/CatalogFeedback";
import GameCard from "../components/GameCard";
import GameImage from "../components/GameImage";
import useHomeShelves from "../hooks/useHomeShelves";
import useFeaturedGames from "../hooks/useFeaturedGames";

const money = (price) =>
  Number(price) === 0
    ? "Free"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(Number(price));

function FeaturedCarousel({ games }) {
  const [index, setIndex] = useState(0);

  if (!games.length) return null;
  const active = index % games.length;
  const game = games[active];
  const select = (offset) =>
    setIndex((current) => (current + offset + games.length) % games.length);
  return (
    <section
      className="store-featured"
      aria-label="Featured games"
      aria-roledescription="carousel"
    >
      <div className="store-featured-slide">
        <GameImage
          src={game.cover}
          alt={`Artwork for ${game.title}`}
          priority
        />
        <div className="store-featured-shade" aria-hidden="true" />
        <div className="store-featured-copy" aria-live="polite">
          <span className="store-eyebrow">Featured game</span>
          <h1>{game.title}</h1>
          <p>{game.description?.split("\n").find((line) => line.trim())}</p>
          <div className="store-featured-actions">
            <Link className="primary-button" to={`/games/${game.id}`}>
              View game <span aria-hidden="true">↗</span>
            </Link>
            <span className="store-featured-price">
              {game.is_owned ? "In your Library" : money(game.price)}
            </span>
          </div>
        </div>
        {games.length > 1 && (
          <div className="store-featured-arrows">
            <button
              type="button"
              onClick={() => select(-1)}
              aria-label="Previous featured game"
            >
              ←
            </button>
            <span>
              {active + 1} / {games.length}
            </span>
            <button
              type="button"
              onClick={() => select(1)}
              aria-label="Next featured game"
            >
              →
            </button>
          </div>
        )}
      </div>
      {games.length > 1 && (
        <div
          className="store-featured-thumbs"
          aria-label="Choose a featured game"
        >
          {games.map((item, itemIndex) => (
            <button
              type="button"
              key={item.id}
              aria-label={`Feature ${item.title}`}
              aria-pressed={itemIndex === active}
              className={itemIndex === active ? "active" : ""}
              onClick={() => setIndex(itemIndex)}
            >
              <GameImage src={item.cover} alt="" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function Shelf({ title, games, wide = false }) {
  if (!games.length) return null;
  return (
    <section className={`store-shelf${wide ? " is-wide" : ""}`}>
      <div className="store-section-heading">
        <h2>{title}</h2>
        <Link to="/catalog">
          View all <span aria-hidden="true">→</span>
        </Link>
      </div>
      <div className="store-shelf-grid">
        {games.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    </section>
  );
}

function CompactColumn({ title, games }) {
  if (!games.length) return null;
  return (
    <section className="store-compact-column">
      <div className="store-section-heading">
        <h2>{title}</h2>
        <Link to="/catalog" aria-label={`Browse ${title.toLowerCase()}`}>
          →
        </Link>
      </div>
      {games.map((game) => (
        <Link
          key={game.id}
          className="store-compact-game"
          to={`/games/${game.id}`}
        >
          <GameImage src={game.cover} alt="" />
          <div>
            <h3>{game.title}</h3>
            <span>
              {game.genres
                ?.slice(0, 2)
                .map((genre) => genre.name)
                .join(" · ")}
            </span>
            <strong>{game.is_owned ? "In Library" : money(game.price)}</strong>
          </div>
        </Link>
      ))}
    </section>
  );
}

export default function HomePage() {
  const { data: shelves, loading, error, retry } = useHomeShelves();
  const games = shelves?.recent || [];
  const genres = shelves?.genres || [];
  const {
    games: featured,
    loading: featuredLoading,
    error: featuredError,
    retry: retryFeatured,
  } = useFeaturedGames();
  const recent = shelves?.recent || [];
  const free = shelves?.free || [];
  const budget = shelves?.budget || [];

  return (
    <div className="store-home">
      {featuredLoading ? (
        <CatalogFeedback
          kind="loading"
          title="Loading featured games"
          message="Picking the games selected for the home page."
          className="home-featured-feedback"
        />
      ) : featuredError ? (
        <CatalogFeedback
          kind="error"
          title="Featured games unavailable"
          message={featuredError}
          onRetry={retryFeatured}
          className="home-featured-feedback"
        />
      ) : featured.length === 0 ? (
        <div className="home-featured-empty">
          <div>
            <span className="store-eyebrow">Featured games</span>
            <h1>Explore the complete catalog</h1>
            <p>No games are featured right now. Every available game remains easy to find in the catalog.</p>
            <Link className="primary-button" to="/catalog">
              Explore catalog <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      ) : (
        <FeaturedCarousel games={featured} />
      )}

      {loading ? (
        <CatalogFeedback
          kind="loading"
          title="Loading catalog"
          message="Getting the rest of the store ready."
          className="home-catalog-feedback"
        />
      ) : error ? (
        <CatalogFeedback
          kind="error"
          title="Catalog unavailable"
          message={error}
          onRetry={retry}
          className="home-catalog-feedback"
        />
      ) : !games.length ? (
        <CatalogFeedback
          kind="empty"
          title="The catalog is empty"
          message="Games will appear here as they are added to the catalog."
          className="home-catalog-feedback"
        />
      ) : (
        <>
          <Shelf
            title="Recent releases"
            games={recent.slice(0, 3)}
            wide
          />
          <Shelf title={shelves?.recommendation_reason || "Recommended for you"} games={shelves?.recommendations || []} />
          {shelves?.bundles.length > 0 && <section className="store-shelf"><div className="store-section-heading"><h2>Bundle offers</h2><Link to="/bundles">Explore bundles →</Link></div><div className="home-bundle-grid">{shelves.bundles.map((bundle) => <Link className="home-bundle-card" to={`/bundles/${bundle.id}`} key={bundle.id}><GameImage src={bundle.cover || bundle.games[0]?.cover} alt="" /><div><span>COLLECTION</span><h3>{bundle.title}</h3><p>{bundle.games.length} games · {bundle.dlc.length} add-ons</p><strong>{money(bundle.price)}</strong></div></Link>)}</div></section>}
          {budget.length > 0 && (
            <Shelf title="Under $20" games={budget.slice(0, 4)} />
          )}
          {genres.length > 0 && (
            <section
              className="store-genres"
              aria-labelledby="home-genres-heading"
            >
              <div className="store-section-heading">
                <h2 id="home-genres-heading">Browse by genre</h2>
              </div>
              <div>
                {genres.map((genre) => (
                  <Link key={genre.id} to={`/catalog?genre=${genre.id}`}>
                    {genre.name}
                    <span aria-hidden="true">↗</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {games.length > 3 && (
            <div className="store-compact-columns">
              <CompactColumn
                title="Recent releases"
                games={recent.slice(0, 3)}
              />
              <CompactColumn title="Community favourites" games={shelves?.popular || []} />
              <CompactColumn title="Free to explore" games={free.slice(0, 3)} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
