import { useState } from "react";
import { Link } from "react-router-dom";

import CatalogFeedback from "../components/CatalogFeedback";
import GameCard from "../components/GameCard";
import GameImage from "../components/GameImage";
import useCatalogData from "../hooks/useCatalogData";

const money = (price) =>
  Number(price) === 0
    ? "Free"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(Number(price));

function FeaturedCarousel({ games }) {
  const [index, setIndex] = useState(0);
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
              <span>{item.title}</span>
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
  const { games, genres, loading, error, retry } = useCatalogData({
    includeGenres: true,
  });
  const featured = [...games]
    .sort((a, b) => Number(Boolean(b.cover)) - Number(Boolean(a.cover)))
    .slice(0, 6);
  const recent = [...games].sort((a, b) =>
    String(b.release_date).localeCompare(String(a.release_date)),
  );
  const free = games.filter((game) => Number(game.price) === 0);
  const budget = games
    .filter((game) => Number(game.price) > 0 && Number(game.price) < 20)
    .sort((a, b) => Number(a.price) - Number(b.price));

  return (
    <div className="store-home">
      {loading ? (
        <CatalogFeedback
          kind="loading"
          title="Loading games"
          message="Getting the store ready."
        />
      ) : error ? (
        <CatalogFeedback
          kind="error"
          title="Store unavailable"
          message={error}
          onRetry={retry}
        />
      ) : !games.length ? (
        <CatalogFeedback
          kind="empty"
          title="The store is empty"
          message="Games will appear here as they are added to the catalog."
        />
      ) : (
        <>
          <FeaturedCarousel games={featured} />
          <Shelf
            title="Discover something new"
            games={recent.slice(0, 3)}
            wide
          />
          {games.length > 3 && (
            <Shelf title="Explore the catalog" games={games.slice(3, 7)} />
          )}
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
              <CompactColumn title="Worth a look" games={games.slice(-3)} />
              <CompactColumn title="Free to explore" games={free.slice(0, 3)} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
