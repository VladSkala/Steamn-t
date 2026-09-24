import { t, useLocale } from "../../i18n/index.js";
import { Link, NavLink } from "react-router-dom";
import LibraryArtwork from "./LibraryArtwork";
function LibrarySidebar({
  items = [],
  activeGameId = null
}) {
  useLocale();
  return <aside className="library-sidebar store-sidebar" aria-label={t("Your library navigation")}>
      <div className="library-sidebar-heading store-sidebar-header">
        <div>
          <span>{t("Your library")}</span>
          <NavLink to="/library" end>{t("All games")}</NavLink>
        </div>
        <span className="library-sidebar-count">{items.length}</span>
      </div>

      {items.length > 0 ? <nav className="library-sidebar-list store-sidebar-section" aria-label={t("Owned games")}>
          {items.map(item => {
        const game = item.game ?? {};
        const title = game.title?.trim() || t("Untitled game");
        const isActive = String(game.id) === String(activeGameId);
        return <Link to={`/library/games/${game.id}`} className={`library-sidebar-game store-sidebar-row${isActive ? " active" : ""}`} key={item.id} aria-label={t("Open {title}", { title })}>
                <LibraryArtwork game={game} className="library-sidebar-artwork" />
                <span>{title}</span>
              </Link>;
      })}
        </nav> : <p className="library-sidebar-empty">{t("Purchased games will appear here.")}</p>}

      <NavLink className="library-sidebar-feed store-sidebar-footer" to="/library/feed">
        <span aria-hidden="true">◎</span>{t("My feed")}</NavLink>
    </aside>;
}
export default LibrarySidebar;
