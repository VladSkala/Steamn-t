import LibrarySidebar from './LibrarySidebar'

function LibraryFrame({
  items,
  activeGameId,
  title,
  className = '',
  children,
}) {
  return (
    <div className={`library-page ${className}`.trim()}>
      <h1 className="library-visually-hidden">{title}</h1>
      <div className="library-shell">
        <LibrarySidebar items={items} activeGameId={activeGameId} />
        <section className="library-main">{children}</section>
      </div>
    </div>
  )
}

export default LibraryFrame
