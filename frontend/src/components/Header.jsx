import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import { useWishlist } from "../hooks/useWishlist";
import api from "../api/client";

const icons = {
  chat: <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6A8.4 8.4 0 0 1 12.5 3h.5a8.5 8.5 0 0 1 8 8v.5Z" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  cart: <><path d="m3 3 2 1 3 12h10l3-9H6"/><circle cx="9" cy="21" r="1"/><circle cx="18" cy="21" r="1"/></>,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
};
function Icon({ name }) { return <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>; }

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const { isAuthenticated, user, logout } = useAuth();
  const { itemCount } = useCart();
  const { itemCount: wishlistCount } = useWishlist();
  const location = useLocation();
  const headerRef = useRef(null);
  const accountButton = useRef(null);
  const close = () => { setMenuOpen(false); setAccountOpen(false); };
  const storePage = /^\/(?:$|catalog|games|dlc|bundles|cart|checkout|wishlist|news|orders)/.test(location.pathname);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let active = true;
    const load = () => api.get("/notifications/").then(({ data }) => { if (active) setUnread(data.unread_count); }).catch(() => {});
    load(); window.addEventListener("steamnt:notifications-changed", load); const timer = window.setInterval(load, 30000);
    return () => { active = false; window.removeEventListener("steamnt:notifications-changed", load); window.clearInterval(timer); };
  }, [isAuthenticated]);
  useEffect(() => {
    const escape = (event) => { if (event.key === "Escape") { if (accountOpen) accountButton.current?.focus(); close(); } };
    const outside = (event) => { if (!headerRef.current?.contains(event.target)) close(); };
    document.addEventListener("keydown", escape); document.addEventListener("pointerdown", outside);
    return () => { document.removeEventListener("keydown", escape); document.removeEventListener("pointerdown", outside); };
  }, [accountOpen]);

  return <header ref={headerRef} className="product-header"><div className="product-header-inner">
    <Link to="/" className="product-brand" onClick={close}>Steam<span>n</span>’t<span className="product-brand-dot" /></Link>
    <button type="button" className="product-menu-toggle" aria-expanded={menuOpen} aria-controls="product-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? "Close" : "Menu"}</button>
    <nav id="product-navigation" className={`product-navigation${menuOpen ? " is-open" : ""}`} aria-label="Main navigation"><Link to="/" onClick={close} className={storePage ? "active" : ""}>Store</Link><NavLink to="/community" onClick={close}>Community</NavLink>{isAuthenticated && <><NavLink to="/library" onClick={close}>Library</NavLink><NavLink to="/friends" onClick={close}>Friends</NavLink></>}</nav>
    <div className="product-header-actions">{isAuthenticated ? <>
      <NavLink to="/chat" onClick={close} className="product-icon-button" aria-label="Chat" title="Messages"><Icon name="chat" /></NavLink>
      <NavLink to="/notifications" onClick={close} className="product-icon-button" aria-label={`Notifications, ${unread} unread`} title="Notifications"><Icon name="bell" />{unread > 0 && <b>{unread > 99 ? "99+" : unread}</b>}</NavLink>
      <div className="product-account"><button ref={accountButton} type="button" className="product-account-toggle" aria-label="Account menu" aria-expanded={accountOpen} aria-controls="account-links" onClick={() => setAccountOpen(!accountOpen)}><span className="product-user-avatar">{user?.avatar ? <img src={user.avatar} alt="" /> : user?.username?.charAt(0).toUpperCase()}</span><span className="product-user-name">{user?.username}</span><span aria-hidden="true">⌄</span></button>{accountOpen && <nav id="account-links" className="product-account-menu" aria-label="Account"><span>YOUR ACCOUNT</span><Link to="/profile" onClick={close}>My profile</Link><Link to="/settings" onClick={close}>Settings</Link><Link to="/settings?section=wallet" onClick={close}>Wallet</Link><Link to="/orders" onClick={close}>Order history</Link><Link to="/wishlist" onClick={close}>Wishlist</Link><button type="button" onClick={() => { logout(); close(); }}>Sign out</button></nav>}</div>
    </> : <><Link to="/login" className="product-signin">Sign in</Link><Link to="/register" className="product-signup">Join Steamn’t</Link></>}</div>
  </div>{storePage && <div className="product-store-bar"><nav aria-label="Store navigation"><NavLink to="/catalog">Catalog</NavLink><NavLink to="/news">News</NavLink><NavLink to="/bundles">Bundles</NavLink></nav><div><NavLink to="/wishlist" aria-label={`Wishlist, ${wishlistCount} games`}><Icon name="heart" /><span>Wishlist</span>{wishlistCount > 0 && <b>{wishlistCount}</b>}</NavLink><NavLink to="/cart" aria-label={`Cart, ${itemCount} items`}><Icon name="cart" /><span>Cart</span>{itemCount > 0 && <b>{itemCount}</b>}</NavLink></div></div>}</header>;
}
