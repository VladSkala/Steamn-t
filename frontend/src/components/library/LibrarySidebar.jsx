import { Link, NavLink } from 'react-router-dom'

import LibraryArtwork from './LibraryArtwork'

function LibrarySidebar({ items = [], activeGameId = null }) {
  return (
    <aside className="library-sidebar" aria-label="Your library navigation">
      <div className="library-sidebar-heading">
        <div>
          <span>Your library</span>
          <NavLink to="/library" end>
            All games
          </NavLink>
        </div>
        <span className="library-sidebar-count">{items.length}</span>
      </div>

      {items.length > 0 ? (
        <nav className="library-sidebar-list" aria-label="Owned games">
          {items.map((item) => {
            const game = item.game ?? {}
            const title = game.title?.trim() || 'Untitled game'
            const isActive = String(game.id) === String(activeGameId)

            return (
              <Link
                to={`/library/games/${game.id}`}
                className={`library-sidebar-game${isActive ? ' active' : ''}`}
                key={item.id}
                aria-label={`Open ${title}`}
              >
                <LibraryArtwork
                  game={game}
                  className="library-sidebar-artwork"
                />
                <span>{title}</span>
              </Link>
            )
          })}
        </nav>
      ) : (
        <p className="library-sidebar-empty">
          Purchased games will appear here.
        </p>
      )}

      <NavLink className="library-sidebar-feed" to="/library/feed">
        <span aria-hidden="true">◎</span>
        My feed
      </NavLink>
    </aside>
  )
}

export default LibrarySidebar
