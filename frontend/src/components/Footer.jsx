import { t, useLocale } from "../i18n/index.js";
import { Link } from "react-router-dom";
export default function Footer() {
  useLocale();
  return <footer className="site-footer"><div className="footer-container complete-footer"><div><p className="footer-logo">Steam<span>n</span>’t</p><p>{t("Discover games, connect with players, and build your own library with Steamn’t.")}</p></div><nav aria-label={t("Footer navigation")}><h2>{t("Explore")}</h2><Link to="/">{t("Home")}</Link><Link to="/catalog">{t("Catalog")}</Link><Link to="/community">{t("Community")}</Link><Link to="/news">{t("News")}</Link></nav><nav aria-label={t("Account links")}><h2>{t("Account")}</h2><Link to="/profile">{t("Profile")}</Link><Link to="/library">{t("Library")}</Link><Link to="/orders">{t("Orders")}</Link><Link to="/settings">{t("Settings")}</Link></nav><nav aria-label={t("Policies")}><h2>{t("Policies")}</h2><Link to="/legal/terms">{t("Terms of Use")}</Link><Link to="/legal/privacy">{t("Privacy Policy")}</Link><Link to="/legal/refund">{t("Refund Policy")}</Link></nav></div><div className="complete-footer-bottom">© 2026 Steamn’t</div></footer>;
}
