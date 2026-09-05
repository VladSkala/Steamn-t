import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import CatalogFeedback from "../components/CatalogFeedback";
import StoreToolbar from "../components/StoreToolbar";
import { useCart } from "../hooks/useCart";
import useLibrary from "../hooks/useLibrary";
import { useWishlist } from "../hooks/useWishlist";

const SORT_OPTIONS = [
  { value: "newest", label: "Recently added" },
  { value: "title", label: "Title: A to Z" },
  { value: "price-low", label: "Price: Low to high" },
  { value: "price-high", label: "Price: High to low" },
];

const PRICE_FILTERS = [
  { value: "all", label: "Any price", matches: () => true },
  { value: "free", label: "Free", matches: (price) => price === 0 },
  {
    value: "under-10",
    label: "Under $10",
    matches: (price) => Number.isFinite(price) && price > 0 && price <= 10,
  },
  {
    value: "under-30",
    label: "Under $30",
    matches: (price) => Number.isFinite(price) && price > 0 && price <= 30,
  },
  {
    value: "under-60",
    label: "Under $60",
    matches: (price) => Number.isFinite(price) && price > 0 && price <= 60,
  },
];

const formatPrice = (price) => {
  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice)) return "Price unavailable";
  if (numericPrice === 0) return "Free";
  return `$${numericPrice.toFixed(2)}`;
};

const getGenreNames = (genres) => {
  if (!Array.isArray(genres)) return [];

  return genres
    .map((genre) => (typeof genre === "string" ? genre : genre?.name))
    .filter((genre) => typeof genre === "string" && genre.trim())
    .map((genre) => genre.trim());
};

const getCartError = (requestError) => {
  const data = requestError?.response?.data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.game_id === "string") return data.game_id;
  if (Array.isArray(data?.game_id) && data.game_id.length > 0) {
    return data.game_id[0];
  }
  return "Unable to add this game to your cart.";
};

function WishlistItem({ item, isOwned, ownershipLoading, view }) {
  const game = item.game;
  const gameId = game.id;
  const coverUrl = game.cover || game.cover_url || "";
  const genres = getGenreNames(game.genres);
  const visibleGenres = genres.slice(0, 3);
  const extraGenreCount = Math.max(0, genres.length - visibleGenres.length);
  const [cartBusy, setCartBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const {
    addToCart,
    isInCart,
    isLoading: cartLoading,
    refreshCart,
  } = useCart();
  const { isPending, removeFromWishlist } = useWishlist();

  const inCart = isInCart(gameId);
  const removing = isPending(gameId);

  const addGameToCart = async () => {
    if (cartBusy || inCart || isOwned || ownershipLoading) return;
    setCartBusy(true);
    setActionError("");

    try {
      await addToCart(gameId);
    } catch (requestError) {
      const duplicateItem =
        requestError?.response?.status === 400 &&
        getCartError(requestError).toLowerCase().includes("already");

      if (duplicateItem) {
        try {
          await refreshCart();
          return;
        } catch {
          // Surface the original action error below.
        }
      }

      setActionError(getCartError(requestError));
    } finally {
      setCartBusy(false);
    }
  };

  const removeGame = async () => {
    if (removing) return;
    setActionError("");

    try {
      await removeFromWishlist(gameId);
    } catch (requestError) {
      setActionError(
        requestError?.response?.data?.detail ||
          requestError?.message ||
          "Unable to remove this game from your Wishlist.",
      );
    }
  };

  return (
    <article className={`wishlist-item ${view}-view`}>
      <Link
        className="wishlist-item-cover"
        to={`/games/${gameId}`}
        aria-label={`View ${game.title || "game"}`}
      >
        <span className="wishlist-cover-fallback" aria-hidden="true">
          S
        </span>
        {coverUrl && (
          <img
            src={coverUrl}
            alt=""
            loading="lazy"
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
          />
        )}
      </Link>

      <div className="wishlist-item-content">
        <button
          type="button"
          className={`wishlist-remove-button${removing ? " is-loading" : ""}`}
          aria-label={`Remove ${game.title || "game"} from Wishlist`}
          aria-busy={removing}
          title="Remove from Wishlist"
          disabled={removing || cartBusy}
          onClick={removeGame}
        >
          <span aria-hidden="true">{removing ? "…" : "×"}</span>
        </button>

        <div className="wishlist-item-heading">
          <div>
            <Link className="wishlist-item-title" to={`/games/${gameId}`}>
              {game.title || "Untitled game"}
            </Link>
            <p className="wishlist-item-developer">
              {game.developer || "Steamn’t catalog"}
            </p>
          </div>
          <strong className="wishlist-item-price">
            {formatPrice(game.price)}
          </strong>
        </div>

        {visibleGenres.length > 0 && (
          <div className="wishlist-item-genres" aria-label="Genres">
            {visibleGenres.map((genre) => (
              <span key={genre}>{genre}</span>
            ))}
            {extraGenreCount > 0 && <span>+{extraGenreCount}</span>}
          </div>
        )}

        {actionError && (
          <p className="wishlist-item-error" role="alert">
            {actionError}
          </p>
        )}

        <div className="wishlist-item-actions">
          {isOwned ? (
            <Link
              className="wishlist-cart-link owned"
              to={`/library/games/${gameId}`}
            >
              In Library · Open
            </Link>
          ) : inCart ? (
            <Link className="wishlist-cart-link active" to="/cart">
              In cart · View
            </Link>
          ) : (
            <button
              type="button"
              className="wishlist-cart-link"
              disabled={cartBusy || cartLoading || removing || ownershipLoading}
              onClick={addGameToCart}
            >
              {cartBusy
                ? "Adding…"
                : ownershipLoading
                  ? "Checking Library…"
                  : "Add to Cart"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function WishlistPage() {
  const { error, isLoading, items, refreshWishlist } = useWishlist();
  const library = useLibrary();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [priceFilter, setPriceFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [view, setView] = useState("list");

  const retryWishlist = () => {
    refreshWishlist().catch(() => undefined);
  };

  const availableGenres = useMemo(
    () =>
      [
        ...new Set(items.flatMap((item) => getGenreNames(item.game.genres))),
      ].sort((left, right) => left.localeCompare(right)),
    [items],
  );

  const ownedGameIds = useMemo(
    () =>
      new Set(
        library.items
          .map((item) => item.game?.id)
          .filter((gameId) => gameId != null)
          .map(String),
      ),
    [library.items],
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
    const priceRule =
      PRICE_FILTERS.find((option) => option.value === priceFilter) ||
      PRICE_FILTERS[0];

    const nextItems = items.filter((item) => {
      const game = item.game;
      const genres = getGenreNames(game.genres);
      const searchableText = [game.title, game.developer, ...genres]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      const matchesSearch =
        normalizedQuery.length === 0 ||
        searchableText.includes(normalizedQuery);
      const matchesGenre =
        selectedGenres.length === 0 ||
        selectedGenres.some((genre) => genres.includes(genre));
      const matchesPrice = priceRule.matches(Number(game.price));

      return matchesSearch && matchesGenre && matchesPrice;
    });

    if (sortBy === "title") {
      return nextItems.sort((left, right) =>
        (left.game.title || "").localeCompare(right.game.title || ""),
      );
    }
    if (sortBy === "price-low") {
      return nextItems.sort(
        (left, right) => Number(left.game.price) - Number(right.game.price),
      );
    }
    if (sortBy === "price-high") {
      return nextItems.sort(
        (left, right) => Number(right.game.price) - Number(left.game.price),
      );
    }

    return nextItems.sort(
      (left, right) =>
        new Date(right.created_at || 0).getTime() -
        new Date(left.created_at || 0).getTime(),
    );
  }, [items, priceFilter, searchQuery, selectedGenres, sortBy]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    selectedGenres.length > 0 ||
    priceFilter !== "all";

  const toggleGenre = (genre) => {
    setSelectedGenres((currentGenres) =>
      currentGenres.includes(genre)
        ? currentGenres.filter((currentGenre) => currentGenre !== genre)
        : [...currentGenres, genre],
    );
  };

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedGenres([]);
    setPriceFilter("all");
  };

  return (
    <div className="wishlist-page">
      <header className="store-page-title wishlist-page-header">
        <h1>Wishlist</h1>
      </header>

      {isLoading && items.length === 0 ? (
        <CatalogFeedback type="loading" message="Loading your Wishlist…" />
      ) : error && items.length === 0 ? (
        <CatalogFeedback
          type="error"
          title="Wishlist unavailable"
          message={error}
          actionLabel="Try again"
          onAction={retryWishlist}
        />
      ) : items.length === 0 ? (
        <section className="wishlist-empty-state">
          <div className="wishlist-empty-icon" aria-hidden="true">
            ♡
          </div>
          <h2>Your Wishlist is ready</h2>
          <p>
            Save games from the Catalog or a game page and they will appear
            here.
          </p>
          <Link className="primary-button" to="/catalog">
            Discover games
          </Link>
        </section>
      ) : (
        <section className="wishlist-content" aria-busy={isLoading}>
          <StoreToolbar
            label="Wishlist"
            search={searchQuery}
            onSearch={setSearchQuery}
            placeholder="Search your Wishlist…"
            searchLabel="Search Wishlist"
            sort={sortBy}
            onSort={setSortBy}
            sortOptions={SORT_OPTIONS}
            countLabel={`${filteredItems.length} ${filteredItems.length === 1 ? "game" : "games"}`}
            view={view}
            onView={setView}
            viewDisabled={filteredItems.length === 0}
          />

          {error && (
            <div className="wishlist-inline-error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={retryWishlist}>
                Retry
              </button>
            </div>
          )}

          <div className="wishlist-layout">
            <aside
              className="wishlist-filters store-sidebar"
              aria-label="Wishlist filters"
            >
              <div className="wishlist-filters-heading store-sidebar-header">
                <h2>Filters</h2>
                <button
                  type="button"
                  className="store-sidebar-reset"
                  disabled={!hasActiveFilters}
                  onClick={resetFilters}
                >
                  Reset
                </button>
              </div>

              <div className="wishlist-filter-groups">
                {availableGenres.length > 0 && (
                  <fieldset className="wishlist-filter-group store-sidebar-section">
                    <legend>Genre</legend>
                    <div className="wishlist-filter-options">
                      {availableGenres.map((genre) => (
                        <label className="store-sidebar-row" key={genre}>
                          <input
                            type="checkbox"
                            checked={selectedGenres.includes(genre)}
                            onChange={() => toggleGenre(genre)}
                          />
                          <span>{genre}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}

                <fieldset className="wishlist-filter-group store-sidebar-section">
                  <legend>Price</legend>
                  <div className="wishlist-filter-options">
                    {PRICE_FILTERS.map((option) => (
                      <label className="store-sidebar-row" key={option.value}>
                        <input
                          type="radio"
                          name="wishlist-price"
                          value={option.value}
                          checked={priceFilter === option.value}
                          onChange={(event) =>
                            setPriceFilter(event.target.value)
                          }
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            </aside>

            <div className="wishlist-results">
              {library.error && (
                <p className="wishlist-library-status" role="status">
                  Library status unavailable
                </p>
              )}

              {filteredItems.length === 0 ? (
                <div className="wishlist-filter-empty">
                  <span aria-hidden="true">⌕</span>
                  <h2>No matching games</h2>
                  <p>Try another title, genre, or price range.</p>
                  <button type="button" onClick={resetFilters}>
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className={`wishlist-games wishlist-games-${view}`}>
                  {filteredItems.map((item) => (
                    <WishlistItem
                      key={item.id}
                      item={item}
                      isOwned={ownedGameIds.has(String(item.game.id))}
                      ownershipLoading={library.loading}
                      view={view}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default WishlistPage;
