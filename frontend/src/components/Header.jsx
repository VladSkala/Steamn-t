import { getLocale, t, useLocale } from "../i18n/index.js";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import { useWishlist } from "../hooks/useWishlist";
import api from "../api/client";
const icons = {
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4 22v-3a8 8 0 0 1 16 0v3" /></>,
  settings: <><circle cx="12" cy="12" r="4" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2" /></>,
  logout: <><path d="M10 3H4v18h6m5-15 6 6-6 6m-6-6h12" /></>,
  chat: <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6A8.4 8.4 0 0 1 12.5 3h.5a8.5 8.5 0 0 1 8 8v.5Z" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  cart: <><path d="m3 3 2 1 3 12h10l3-9H6" /><circle cx="9" cy="21" r="1" /><circle cx="18" cy="21" r="1" /></>,
  wallet: <><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H19a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5.5A2.5 2.5 0 0 1 3 17.5Z" /><path d="M3 8h16.5M16 13h5" /><circle cx="16" cy="13" r=".7" fill="currentColor" stroke="none" /></>,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
};
function Icon({
  name
}) {
  useLocale();
  return <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>;
}
const formatWalletBalance = value => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "—";
  return new Intl.NumberFormat(getLocale(), {
    style: "currency",
    currency: "USD"
  }).format(numericValue);
};
export default function Header() {
  useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const {
    isAuthenticated,
    user,
    logout
  } = useAuth();
  const {
    itemCount
  } = useCart();
  const {
    itemCount: wishlistCount
  } = useWishlist();
  const location = useLocation();
  const headerRef = useRef(null);
  const accountButton = useRef(null);
  const close = () => {
    setMenuOpen(false);
    setAccountOpen(false);
  };
  const storePage = /^\/(?:$|catalog|games|dlc|bundles|cart|checkout|wishlist|news|orders)/.test(location.pathname);
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let active = true;
    const load = () => api.get("/notifications/").then(({
      data
    }) => {
      if (active) setUnread(data.unread_count);
    }).catch(() => {});
    load();
    window.addEventListener("steamnt:notifications-changed", load);
    const timer = window.setInterval(load, 30000);
    return () => {
      active = false;
      window.removeEventListener("steamnt:notifications-changed", load);
      window.clearInterval(timer);
    };
  }, [isAuthenticated]);
  useEffect(() => {
    const escape = event => {
      if (event.key === "Escape") {
        if (accountOpen) accountButton.current?.focus();
        close();
      }
    };
    const outside = event => {
      if (!headerRef.current?.contains(event.target)) close();else if (!accountButton.current?.parentElement?.contains(event.target)) setAccountOpen(false);
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", escape);
      document.removeEventListener("pointerdown", outside);
    };
  }, [accountOpen]);
  return <header ref={headerRef} className="product-header"><div className="product-header-inner">
    <Link to="/" className="product-brand" onClick={close}>Steam<span>n</span>’t</Link>
    <button type="button" className="product-menu-toggle" aria-expanded={menuOpen} aria-controls="product-navigation" onClick={() => {
        setMenuOpen(!menuOpen);
        setAccountOpen(false);
      }}>{menuOpen ? t("Close") : t("Menu")}</button>
    <nav id="product-navigation" className={`product-navigation${menuOpen ? " is-open" : ""}`} aria-label={t("Main navigation")}><Link to="/" onClick={close} className={storePage ? "active" : ""}>{t("Store")}</Link><NavLink to="/community" onClick={close}>{t("Community")}</NavLink>{isAuthenticated && <><NavLink to="/library" onClick={close}>{t("Library")}</NavLink><NavLink to="/friends" onClick={close}>{t("Friends")}</NavLink></>}</nav>
    <div className="product-header-actions">{isAuthenticated ? <>
      <Link to="/settings?section=wallet" onClick={close} className="product-wallet-balance" aria-label={`${t("Wallet balance")}: ${formatWalletBalance(user?.wallet_balance)}`} title={t("Wallet balance")}><Icon name="wallet" /><span>{t("Wallet balance")}</span><strong>{formatWalletBalance(user?.wallet_balance)}</strong></Link>
      <NavLink to="/chat" onClick={close} className="product-icon-button" aria-label={t("Chat")} title={t("Messages")}><Icon name="chat" /></NavLink>
      <NavLink to="/notifications" onClick={close} className="product-icon-button" aria-label={t("Notifications, {count} unread", { count: unread })} title={t("Notifications")}><Icon name="bell" />{unread > 0 && <b>{unread > 99 ? "99+" : unread}</b>}</NavLink>
      <div className="product-account" onKeyDown={event => {
            const items = [...event.currentTarget.querySelectorAll("nav a, nav button")];
            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
              event.preventDefault();
              if (!accountOpen) {
                setAccountOpen(true);
                requestAnimationFrame(() => document.querySelector("#account-links a")?.focus());
                return;
              }
              const index = items.indexOf(document.activeElement);
              const target = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
              items[target]?.focus();
            }
          }} onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget)) setAccountOpen(false);
          }}><button ref={accountButton} type="button" className="product-account-toggle" aria-label={t("Account menu")} aria-expanded={accountOpen} aria-controls="account-links" onClick={() => {
              setAccountOpen(!accountOpen);
              setMenuOpen(false);
            }}><span className="product-user-avatar">{user?.avatar ? <img src={user.avatar} alt="" /> : user?.username?.charAt(0).toUpperCase()}</span><span className="product-user-name">{user?.username}</span><span aria-hidden="true">⌄</span></button>{accountOpen && <nav id="account-links" className="product-account-menu" aria-label={t("Account")}><Link to="/profile" onClick={close}><Icon name="profile" />{t("My profile")}</Link><Link to="/settings" onClick={close}><Icon name="settings" />{t("Settings")}</Link><button type="button" onClick={() => {
                logout();
                close();
              }}><Icon name="logout" />{t("Sign out")}</button></nav>}</div>
    </> : <><Link to="/login" className="product-signin">{t("Sign in")}</Link><Link to="/register" className="product-signup">{t("Join Steamn’t")}</Link></>}</div>
  </div>{storePage && <div className="product-store-bar"><nav aria-label={t("Store navigation")}><NavLink to="/catalog">{t("Catalog")}</NavLink><NavLink to="/news">{t("News")}</NavLink></nav><div><NavLink to="/wishlist" aria-label={t("Wishlist, {count} games", { count: wishlistCount })}><Icon name="heart" /><span>{t("Wishlist")}</span>{wishlistCount > 0 && <b>{wishlistCount}</b>}</NavLink><NavLink to="/cart" aria-label={t("Cart, {count} items", { count: itemCount })}><Icon name="cart" /><span>{t("Cart")}</span>{itemCount > 0 && <b>{itemCount}</b>}</NavLink></div></div>}</header>;
}
