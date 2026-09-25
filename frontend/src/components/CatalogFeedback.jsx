import { t, useLocale } from "../i18n/index.js";
const icons = {
  empty: "⌕",
  error: "!"
};
function CatalogFeedback({
  kind,
  title,
  message,
  onRetry,
  actionLabel = t("Try again"),
  className = ""
}) {
  useLocale();
  const classes = ["catalog-feedback", `catalog-feedback-${kind}`, className].filter(Boolean).join(" ");
  return <div className={classes} role={kind === "error" ? "alert" : "status"} aria-live={kind === "error" ? "assertive" : "polite"} aria-busy={kind === "loading"}>
      {kind === "loading" ? <span className="catalog-feedback-spinner" aria-hidden="true" /> : <span className="catalog-feedback-icon" aria-hidden="true">
          {icons[kind]}
        </span>}

      <h3>{title}</h3>
      <p>{t(message)}</p>

      {onRetry && <button type="button" className="catalog-feedback-button" onClick={onRetry}>
          {actionLabel}
        </button>}
    </div>;
}
export default CatalogFeedback;
