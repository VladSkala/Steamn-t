import { Link } from "react-router-dom";

export default function SettingsPage() {
  return (
    <div className="settings-page">
      <header className="store-page-title">
        <h1>Settings</h1>
      </header>
      <div className="account-settings-grid">
        <section>
          <h2>Profile details</h2>
          <p>Manage your name, email and avatar from your profile.</p>
          <Link to="/profile" className="secondary-button">
            Open profile <span aria-hidden="true">↗</span>
          </Link>
        </section>
        <section>
          <h2>Your games</h2>
          <p>Organize owned games and the titles you want to play next.</p>
          <div>
            <Link to="/library">Library →</Link>
            <Link to="/wishlist">Wishlist →</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
