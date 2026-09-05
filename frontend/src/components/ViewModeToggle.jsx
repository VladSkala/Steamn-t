function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6h12M8 12h12M8 18h12" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
    </svg>
  );
}

function ViewModeToggle({
  view = "grid",
  onToggle,
  disabled = false,
  label = "items",
}) {
  const nextView = view === "grid" ? "list" : "grid";

  return (
    <button
      type="button"
      className={`view-mode-toggle is-${view}`}
      aria-label={`Switch ${label} to ${nextView} view`}
      aria-pressed={view === "list"}
      disabled={disabled}
      onClick={() => onToggle(nextView)}
    >
      <span className="view-mode-icon view-mode-icon-grid">
        <GridIcon />
      </span>
      <span className="view-mode-icon view-mode-icon-list">
        <ListIcon />
      </span>
    </button>
  );
}

export default ViewModeToggle;
