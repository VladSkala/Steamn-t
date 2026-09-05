import ViewModeToggle from "./ViewModeToggle";

export default function StoreToolbar({
  label,
  search,
  onSearch,
  placeholder = "Search games…",
  searchLabel = "Search games by title",
  sort,
  onSort,
  sortOptions,
  countLabel,
  view,
  onView,
  disabled = false,
  viewDisabled = false,
}) {
  return (
    <section
      className="catalog-toolbar store-toolbar"
      aria-label={`${label} controls`}
    >
      <div className="catalog-search">
        <span className="search-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m15.5 15.5 4.5 4.5" />
          </svg>
        </span>
        <input
          type="search"
          aria-label={searchLabel}
          placeholder={placeholder}
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          disabled={disabled}
        />
      </div>
      <label className="catalog-sort">
        <span className="catalog-sort-label">Sort</span>
        <span className="sort-select-control">
          <select
            aria-label={`Sort ${label.toLowerCase()} games`}
            value={sort}
            disabled={disabled}
            onChange={(event) => onSort(event.target.value)}
          >
            {sortOptions.map((option) => (
              <option key={option.value || "default"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </span>
      </label>
      <span className="catalog-count" aria-live="polite">
        {countLabel}
      </span>
      <ViewModeToggle
        view={view}
        label={label.toLowerCase()}
        onToggle={onView}
        disabled={disabled || viewDisabled}
      />
    </section>
  );
}
