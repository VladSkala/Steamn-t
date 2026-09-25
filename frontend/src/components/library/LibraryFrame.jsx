import LibrarySidebar from "./LibrarySidebar";

function LibraryFrame({
  items,
  activeGameId,
  title,
  pageHeader,
  toolbar,
  subnav,
  className = "",
  children,
}) {
  return (
    <div className={`library-page ${className}`.trim()}>
      {pageHeader || <h1 className="library-visually-hidden">{title}</h1>}
      {toolbar}
      {subnav}
      <div className="library-shell">
        <LibrarySidebar items={items} activeGameId={activeGameId} />
        <section className="library-main">{children}</section>
      </div>
    </div>
  );
}

export default LibraryFrame;
