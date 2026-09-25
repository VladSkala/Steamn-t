import { t, useLocale } from "../i18n/index.js";
import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import PageContainer from '../components/PageContainer';
import { communityPostPath, postIdFromLegacyHash } from '../utils/communityPostLinks';
function GlobalLayout() {
  const locale = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const postId = postIdFromLegacyHash(location.hash);
    if (postId) {
      navigate(`${communityPostPath(postId)}${location.search}`, {
        replace: true
      });
    }
  }, [location.hash, location.search, navigate]);
  useEffect(() => {
    const route = location.pathname.split("/")[1];
    const titles = {
      catalog: t("Catalog"),
      community: t("Community"),
      news: t("News"),
      notifications: t("Notifications"),
      friends: t("Friends"),
      chat: t("Messages"),
      cart: t("Cart"),
      checkout: t("Checkout"),
      library: t("Library"),
      games: t("Game"),
      dlc: "DLC",
      bundles: "Bundles",
      orders: t("Orders"),
      profile: t("My profile"),
      users: t("Player profile"),
      settings: t("Settings"),
      wishlist: t("Wishlist")
    };
    const legal = {
      terms: t("Terms of Use"),
      privacy: t("Privacy Policy"),
      refund: t("Refund Policy")
    };
    const title = route === "legal" ? legal[location.pathname.split("/")[2]] : titles[route];
    document.title = title ? `${title} · Steamn’t` : "Steamn’t";
  }, [location.pathname, locale]);
  return <div className="app-shell">
      <Header />

      <main className="app-main">
        <PageContainer>
          <Outlet />
        </PageContainer>
      </main>

      <Footer />
    </div>;
}
export default GlobalLayout;
