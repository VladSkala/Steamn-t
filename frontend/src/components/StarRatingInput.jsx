import { useState } from "react";
import { t, useLocale } from "../i18n/index.js";

export default function StarRatingInput({ value, onChange, disabled = false }) {
  useLocale();
  const [hovered, setHovered] = useState(0);
  const selected = Math.min(5, Math.max(1, Number(value) || 1));
  const active = disabled ? selected : hovered || selected;
  return <fieldset className="reviews-rating-input" disabled={disabled}>
    <legend>{t("Rating")}</legend>
    <div className="reviews-rating-buttons" onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5].map(rating => <button
        key={rating} type="button" disabled={disabled}
        className={rating <= active ? "active" : ""}
        aria-label={t("{rating} out of 5 stars", { rating })}
        aria-pressed={selected === rating}
        onMouseEnter={() => !disabled && setHovered(rating)}
        onClick={() => { setHovered(0); onChange(rating); }}
        onKeyDown={event => {
          const next = { ArrowRight: Math.min(5, selected + 1), ArrowUp: Math.min(5, selected + 1), ArrowLeft: Math.max(1, selected - 1), ArrowDown: Math.max(1, selected - 1), Home: 1, End: 5 }[event.key];
          if (next == null) return;
          event.preventDefault();
          setHovered(0);
          onChange(next);
          event.currentTarget.parentElement.children[next - 1]?.focus();
        }}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" /></svg>
      </button>)}
    </div>
    <span className="reviews-rating-value">{selected} / 5</span>
  </fieldset>;
}
