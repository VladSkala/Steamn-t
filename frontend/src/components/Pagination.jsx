const createPageItems = (currentPage, totalPages) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
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
  totalItems,
  pageSize,
  onPageChange,
  disabled = false,
  label = "Catalog pagination",
}) {
  if (totalPages <= 1 || totalItems === 0) return null;

  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const firstItem = (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, totalItems);
  const pageItems = createPageItems(currentPage, totalPages);

  return (
    <nav className="catalog-pagination" aria-label={label}>
      <button
        type="button"
        className="catalog-pagination-button catalog-pagination-previous"
        disabled={disabled || currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="Go to previous catalog page"
      >
        <span aria-hidden="true">←</span>
        <span>Previous</span>
      </button>

      <div className="catalog-pagination-center">
        <div className="catalog-pagination-pages">
          {pageItems.map((item) =>
            typeof item === "number" ? (
              <button
                type="button"
                key={item}
                className={
                  item === currentPage
                    ? "catalog-pagination-page active"
                    : "catalog-pagination-page"
                }
                disabled={disabled}
                aria-current={item === currentPage ? "page" : undefined}
                aria-label={`Go to catalog page ${item}`}
                onClick={() => onPageChange(item)}
              >
                {item}
              </button>
            ) : (
              <span
                key={item}
                className="catalog-pagination-ellipsis"
                aria-hidden="true"
              >
                …
              </span>
            ),
          )}
        </div>
        <span className="catalog-pagination-summary" aria-live="polite">
          {firstItem}–{lastItem} of {totalItems} games
        </span>
      </div>

      <button
        type="button"
        className="catalog-pagination-button catalog-pagination-next"
        disabled={disabled || currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label="Go to next catalog page"
      >
        <span>Next</span>
        <span aria-hidden="true">→</span>
      </button>
    </nav>
  );
}
