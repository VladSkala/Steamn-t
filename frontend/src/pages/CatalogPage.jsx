import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import CatalogFeedback from "../components/CatalogFeedback";
import GameCard from "../components/GameCard";
import Pagination from "../components/Pagination";
import PriceRangeFilter from "../components/PriceRangeFilter";
import StoreToolbar from "../components/StoreToolbar";
import useCatalogData from "../hooks/useCatalogData";

const PAGE_SIZE = 12;
const SORT_OPTIONS = [
  { value: "", label: "Title: A to Z" },
  { value: "-title", label: "Title: Z to A" },
  { value: "price", label: "Price: Low to High" },
  { value: "-price", label: "Price: High to Low" },
];
const SORT_VALUES = new Set(SORT_OPTIONS.map((option) => option.value));

const collectGenres = (apiGenres) =>
  [...apiGenres]
    .filter((genre) => genre?.id != null && genre?.name)
    .sort((first, second) => first.name.localeCompare(second.name));

const parsePage = (value) => {
  if (!/^[1-9]\d*$/.test(value || "")) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 1;
};

function useDebouncedValue(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => window.clearTimeout(timeoutId);
  }, [delay, value]);

  return debouncedValue;
}

function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState("grid");
  const search = searchParams.get("search") || "";
  const selectedGenre = searchParams.get("genre")?.trim() || "all";
  const orderingParam = searchParams.get("ordering") || "";
  const ordering = SORT_VALUES.has(orderingParam) ? orderingParam : "";
  const minPrice = searchParams.get("min_price") || "";
  const maxPrice = searchParams.get("max_price") || "";
  const page = parsePage(searchParams.get("page"));
  const debouncedSearch = useDebouncedValue(search, 300);
  const searchPending = search !== debouncedSearch;

  const updateParams = useCallback(
    (updates, { resetPage = true, replace = false } = {}) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(updates)) {
            if (value === null || value === "") {
              next.delete(key);
            } else {
              next.set(key, String(value));
            }
          }
          if (resetPage) next.delete("page");
          return next;
        },
        { replace },
      );
    },
    [setSearchParams],
  );

  const { games, genres, totalCount, loading, error, retry } = useCatalogData({
    includeGenres: true,
    search: debouncedSearch,
    genre: selectedGenre,
    ordering,
    page,
    pageSize: PAGE_SIZE,
    minPrice,
    maxPrice,
  });

  const availableGenres = useMemo(() => collectGenres(genres), [genres]);
  const isLoading = loading || searchPending;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const resetFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const handlePageChange = (nextPage) => {
    updateParams(
      { page: nextPage === 1 ? null : nextPage },
      { resetPage: false },
    );
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    selectedGenre !== "all" ||
    ordering !== "" ||
    minPrice.trim() !== "" ||
    maxPrice.trim() !== "";

  const gameCountLabel = isLoading
    ? "Loading games…"
    : error
      ? "Catalog unavailable"
      : `${totalCount} ${totalCount === 1 ? "game" : "games"} found`;

  return (
    <div className="catalog-page">
      <header className="store-page-title">
        <h1>Catalog</h1>
      </header>

      <StoreToolbar
        label="Catalog"
        search={search}
        onSearch={(value) =>
          updateParams(
            { search: value || null },
            { resetPage: true, replace: true },
          )
        }
        sort={ordering}
        onSort={(value) =>
          updateParams({ ordering: value || null }, { resetPage: true })
        }
        sortOptions={SORT_OPTIONS}
        countLabel={gameCountLabel}
        view={view}
        onView={setView}
        viewDisabled={isLoading || Boolean(error) || games.length === 0}
      />

      <div className="catalog-layout">
        <aside
          className="catalog-filters store-sidebar"
          aria-label="Catalog filters"
        >
          <div className="filter-heading store-sidebar-header">
            <span>FILTERS</span>
            <button
              type="button"
              className="store-sidebar-reset"
              disabled={!hasActiveFilters}
              onClick={resetFilters}
            >
              Reset
            </button>
          </div>

          <div className="filter-group store-sidebar-section">
            <h3>Genre</h3>
            <button
              type="button"
              className={
                selectedGenre === "all"
                  ? "filter-option store-sidebar-row active"
                  : "filter-option store-sidebar-row"
              }
              onClick={() => updateParams({ genre: null }, { resetPage: true })}
            >
              <span>All</span>
              {selectedGenre === "all" && <span>✓</span>}
            </button>

            {availableGenres.map((genre) => {
              const genreId = String(genre.id);
              const isActive = selectedGenre === genreId;
              return (
                <button
                  type="button"
                  key={genre.id}
                  className={
                    isActive
                      ? "filter-option store-sidebar-row active"
                      : "filter-option store-sidebar-row"
                  }
                  onClick={() =>
                    updateParams({ genre: genreId }, { resetPage: true })
                  }
                >
                  <span>{genre.name}</span>
                  {isActive && <span>✓</span>}
                </button>
              );
            })}

            {!isLoading && !error && availableGenres.length === 0 && (
              <p className="filter-empty-note">No genres available yet.</p>
            )}
          </div>

          <PriceRangeFilter
            key={`${minPrice}:${maxPrice}`}
            initialMinPrice={minPrice}
            initialMaxPrice={maxPrice}
            onApply={({ minPrice: minimum, maxPrice: maximum }) =>
              updateParams(
                {
                  min_price: minimum || null,
                  max_price: maximum || null,
                },
                { resetPage: true },
              )
            }
          />
        </aside>

        <section
          id="catalog-results"
          className="catalog-results"
          aria-label="Catalog results"
          aria-busy={isLoading}
        >
          {isLoading && (
            <CatalogFeedback
              kind="loading"
              title="Loading catalog"
              message="Fetching games from the server."
            />
          )}
          {!isLoading && error && (
            <CatalogFeedback
              kind="error"
              title="Catalog unavailable"
              message={error}
              onRetry={page > 1 ? () => handlePageChange(1) : retry}
              actionLabel={page > 1 ? "Return to first page" : "Try again"}
            />
          )}
          {!isLoading && !error && games.length === 0 && (
            <CatalogFeedback
              kind="empty"
              title={
                hasActiveFilters ? "No games found" : "The catalog is empty"
              }
              message={
                hasActiveFilters
                  ? "Try changing your search, genre, price range, or sorting."
                  : "Games added to Steamn’t will appear here."
              }
            />
          )}
          {!isLoading && !error && games.length > 0 && (
            <>
              <div
                className={
                  view === "grid" ? "catalog-games-grid" : "catalog-games-list"
                }
              >
                {games.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    variant="catalog"
                    view={view}
                  />
                ))}
              </div>
              <Pagination
                page={page}
                totalPages={totalPages}
                totalItems={totalCount}
                pageSize={PAGE_SIZE}
                onPageChange={handlePageChange}
                disabled={loading}
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default CatalogPage;
