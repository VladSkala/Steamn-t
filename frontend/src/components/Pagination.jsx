import { t, useLocale } from "../i18n/index.js";
const createPageItems = (currentPage, totalPages) => {
  if (totalPages <= 7) {
    return Array.from({
      length: totalPages
    }, (_, index) => index + 1);
  }
  const items = [1];
  const rangeStart = Math.max(2, currentPage - 1);
  const rangeEnd = Math.min(totalPages - 1, currentPage + 1);
  if (rangeStart > 2) items.push("start-ellipsis");
  for (let page = rangeStart; page <= rangeEnd; page += 1) {
    items.push(page);
  }
  if (rangeEnd < totalPages - 1) items.push("end-ellipsis");
  items.push(totalPages);
  return items;
};
export default function Pagination({
  page,
  totalPages,
  previous,
  next,
  totalItems,
  pageSize,
  onPageChange,
  disabled = false,
  label = t("Pagination")
}) {
  useLocale();
  const knownTotal = Number.isFinite(totalPages);
  if (knownTotal && totalPages <= 1 || totalItems === 0 || !knownTotal && !previous && !next && page <= 1) return null;
  const currentPage = knownTotal ? Math.min(Math.max(page, 1), totalPages) : Math.max(page, 1);
  const firstItem = (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, totalItems);
  const pageItems = knownTotal ? createPageItems(currentPage, totalPages) : [currentPage];
  return <nav className="catalog-pagination" aria-label={t(label)}>
      <button type="button" className="catalog-pagination-button catalog-pagination-previous" disabled={disabled || (knownTotal ? currentPage === 1 : !previous)} onClick={() => onPageChange(currentPage - 1)} aria-label={t("Previous page")}>
        <span aria-hidden="true">←</span>
        <span>{t("Previous")}</span>
      </button>

      <div className="catalog-pagination-center">
        <div className="catalog-pagination-pages">
          {pageItems.map(item => typeof item === "number" ? <button type="button" key={item} className={item === currentPage ? "catalog-pagination-page active" : "catalog-pagination-page"} disabled={disabled} aria-current={item === currentPage ? "page" : undefined} aria-label={t("Page {page}", { page: item })} onClick={() => onPageChange(item)}>
                {item}
              </button> : <span key={item} className="catalog-pagination-ellipsis" aria-hidden="true">
                …
              </span>)}
        </div>
        {Number.isFinite(totalItems) && Number.isFinite(pageSize) && <span className="catalog-pagination-summary" aria-live="polite">
          {firstItem}–{lastItem} / {totalItems}
        </span>}
      </div>

      <button type="button" className="catalog-pagination-button catalog-pagination-next" disabled={disabled || (knownTotal ? currentPage === totalPages : !next)} onClick={() => onPageChange(currentPage + 1)} aria-label={t("Next page")}>
        <span>{t("Next")}</span>
        <span aria-hidden="true">→</span>
      </button>
    </nav>;
}
