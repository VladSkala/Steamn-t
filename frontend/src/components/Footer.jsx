import { Link } from "react-router-dom";

export default function Footer() {
  return <footer className="site-footer"><div className="footer-container complete-footer"><div><p className="footer-logo">Steam<span>n</span>’t</p><p>Discover games, connect with players, and build your own library with Steamn’t.</p></div><nav aria-label="Footer navigation"><h2>Explore</h2><Link to="/">Home</Link><Link to="/catalog">Catalog</Link><Link to="/community">Community</Link><Link to="/news">News</Link></nav><nav aria-label="Account links"><h2>Account</h2><Link to="/profile">Profile</Link><Link to="/library">Library</Link><Link to="/orders">Orders</Link><Link to="/settings">Settings</Link></nav><nav aria-label="Policies"><h2>Policies</h2><Link to="/legal/terms">Terms of Use</Link><Link to="/legal/privacy">Privacy Policy</Link><Link to="/legal/refund">Refund Policy</Link></nav></div><div className="complete-footer-bottom">© 2026 Steamn’t</div></footer>;
}
