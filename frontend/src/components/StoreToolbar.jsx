import { t, useLocale } from "../i18n/index.js";
import ViewModeToggle from "./ViewModeToggle";
export default function StoreToolbar({
  label,
  search,
  onSearch,
  placeholder = t("Search games…"),
  searchLabel = t("Search games by title"),
  sort,
  onSort,
  sortOptions,
  countLabel,
  view,
  onView,
  disabled = false,
  viewDisabled = false
}) {
  useLocale();
  return <section className="catalog-toolbar store-toolbar" aria-label={t("{label} controls", { label })}>
      <div className="catalog-search">
        <span className="search-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m15.5 15.5 4.5 4.5" />
          </svg>
        </span>
        <input type="search" aria-label={searchLabel} placeholder={placeholder} value={search} onChange={event => onSearch(event.target.value)} disabled={disabled} />
      </div>
      <label className="catalog-sort">
        <span className="catalog-sort-label">{t("Sort")}</span>
        <span className="sort-select-control">
          <select aria-label={t("Sort {label} games", { label: label.toLocaleLowerCase() })} value={sort} disabled={disabled} onChange={event => onSort(event.target.value)}>
            {sortOptions.map(option => <option key={option.value || "default"} value={option.value}>
                {t(option.label)}
              </option>)}
          </select>
        </span>
      </label>
      <span className="catalog-count" aria-live="polite">
        {countLabel}
      </span>
      <ViewModeToggle view={view} label={label.toLocaleLowerCase()} onToggle={onView} disabled={disabled || viewDisabled} />
    </section>;
}
