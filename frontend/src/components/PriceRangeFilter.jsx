import { useState } from "react";

const MAX_PRICE = 99_999_999.99;
const PRICE_PATTERN = /^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/;

const parsePrice = (rawValue) => {
  const value = rawValue.trim();
  if (!value) return { normalized: "", number: null };
  if (!PRICE_PATTERN.test(value)) return null;

  const normalized = value.startsWith(".")
    ? `0${value}`
    : value.endsWith(".")
      ? value.slice(0, -1)
      : value;
  const number = Number(normalized);
  if (!Number.isFinite(number) || number < 0 || number > MAX_PRICE) {
    return null;
  }
  return { normalized, number };
};

export default function PriceRangeFilter({
  initialMinPrice = "",
  initialMaxPrice = "",
  onApply,
  disabled = false,
}) {
  const [minPrice, setMinPrice] = useState(initialMinPrice);
  const [maxPrice, setMaxPrice] = useState(initialMaxPrice);
  const [error, setError] = useState("");

  const updateMinPrice = (value) => {
    setMinPrice(value);
    if (error) setError("");
  };

  const updateMaxPrice = (value) => {
    setMaxPrice(value);
    if (error) setError("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const minimum = parsePrice(minPrice);
    const maximum = parsePrice(maxPrice);

    if (!minimum || !maximum) {
      setError("Use positive prices with no more than 2 decimal places.");
      return;
    }
    if (
      minimum.number !== null &&
      maximum.number !== null &&
      minimum.number > maximum.number
    ) {
      setError("Minimum price cannot be greater than maximum price.");
      return;
    }

    setError("");
    onApply({
      minPrice: minimum.normalized,
      maxPrice: maximum.normalized,
    });
  };

  return (
    <section className="filter-group store-sidebar-section catalog-price-filter">
      <h3>Price range</h3>
      <form className="catalog-price-form" onSubmit={handleSubmit} noValidate>
        <div className="catalog-price-fields">
          <label className="catalog-price-field" htmlFor="catalog-min-price">
            <span>From</span>
            <span className="catalog-price-control">
              <span aria-hidden="true">$</span>
              <input
                id="catalog-min-price"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                spellCheck="false"
                placeholder="0"
                value={minPrice}
                disabled={disabled}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "catalog-price-error" : undefined}
                onChange={(event) => updateMinPrice(event.target.value)}
              />
            </span>
          </label>

          <span className="catalog-price-separator" aria-hidden="true">
            –
          </span>

          <label className="catalog-price-field" htmlFor="catalog-max-price">
            <span>To</span>
            <span className="catalog-price-control">
              <span aria-hidden="true">$</span>
              <input
                id="catalog-max-price"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                spellCheck="false"
                placeholder="Any"
                value={maxPrice}
                disabled={disabled}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "catalog-price-error" : undefined}
                onChange={(event) => updateMaxPrice(event.target.value)}
              />
            </span>
          </label>
        </div>

        {error && (
          <p
            id="catalog-price-error"
            className="catalog-price-error"
            role="alert"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          className="catalog-price-apply"
          disabled={disabled}
        >
          Apply price
        </button>
      </form>
    </section>
  );
}
