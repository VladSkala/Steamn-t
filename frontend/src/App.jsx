import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import AuthLayout from "./layouts/AuthLayout";
import GlobalLayout from "./layouts/GlobalLayout";
const CartPage = lazy(() => import("./pages/CartPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const CatalogPage = lazy(() => import("./pages/CatalogPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const CommunityPage = lazy(() => import("./pages/CommunityPage"));
const CommunityPostPage = lazy(() => import("./pages/CommunityPostPage"));
const FriendsPage = lazy(() => import("./pages/FriendsPage"));
import { DLCListPage, DLCDetailPage, BundleListPage, BundleDetailPage } from "./pages/DLCPage";
import { OrderHistoryPage, OrderDetailPage } from "./pages/OrdersPage";
const GameDetailsPage = lazy(() => import("./pages/GameDetailsPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const LibraryFeedPage = lazy(() => import("./pages/LibraryFeedPage"));
const LibraryGamePage = lazy(() => import("./pages/LibraryGamePage"));
const LibraryPage = lazy(() => import("./pages/LibraryPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const PasswordResetPage = lazy(() => import("./pages/PasswordResetPage"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const NewsPage = lazy(() => import("./pages/NewsPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const MyReviewsPage = lazy(() => import("./pages/MyReviewsPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const PublicProfilePage = lazy(() => import("./pages/PublicProfilePage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const SettingsPage = lazy(() => import("./pages/SettingsCompletePage"));
const WishlistPage = lazy(() => import("./pages/WishlistPage"));

const protectedPage = (page) => <ProtectedRoute>{page}</ProtectedRoute>;

function App() {
  return (
    <Suspense fallback={<div className="chat-empty" role="status">Loading page…</div>}><Routes>
      <Route element={<GlobalLayout />}>
        <Route index element={<HomePage />} />
        <Route path="catalog" element={<CatalogPage />} />
        <Route path="community" element={<CommunityPage />} />
        <Route path="news" element={<NewsPage />} />
        <Route path="legal/:policy" element={<LegalPage />} />
        <Route path="notifications" element={protectedPage(<NotificationsPage />)} />
        <Route path="community/posts/:postId" element={<CommunityPostPage />} />
        <Route path="friends" element={protectedPage(<FriendsPage />)} />
        <Route path="chat" element={protectedPage(<ChatPage />)} />
        <Route path="cart" element={protectedPage(<CartPage />)} />
        <Route path="checkout" element={protectedPage(<CheckoutPage />)} />
        <Route path="library" element={protectedPage(<LibraryPage />)} />
        <Route
          path="library/games/:gameId"
          element={protectedPage(<LibraryGamePage />)}
        />
        <Route
          path="library/feed"
          element={protectedPage(<LibraryFeedPage />)}
        />
        <Route path="games/:gameId" element={<GameDetailsPage />} />
        <Route path="games/:gameId/dlc" element={<DLCListPage />} />
        <Route path="dlc/:dlcId" element={<DLCDetailPage />} />
        <Route path="bundles" element={<BundleListPage />} />
        <Route path="bundles/:bundleId" element={<BundleDetailPage />} />
        <Route path="orders" element={protectedPage(<OrderHistoryPage />)} />
        <Route path="orders/:orderId" element={protectedPage(<OrderDetailPage />)} />
        <Route path="profile" element={protectedPage(<ProfilePage />)} />
        <Route path="users/:userId" element={<PublicProfilePage />} />
        <Route
          path="profile/reviews"
          element={protectedPage(<MyReviewsPage />)}
        />
        <Route path="settings" element={protectedPage(<SettingsPage />)} />
        <Route path="wishlist" element={protectedPage(<WishlistPage />)} />
        <Route path="404" element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route element={<AuthLayout />}>
        <Route path="login" element={<LoginPage />} />
        <Route path="reset-password" element={<PasswordResetPage />} />
        <Route path="register" element={<RegisterPage />} />
      </Route>
    </Routes></Suspense>
  );
}

export default App;
