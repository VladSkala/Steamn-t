import { Route, Routes } from 'react-router-dom'

import ProtectedRoute from './components/ProtectedRoute'
import AuthLayout from './layouts/AuthLayout'
import GlobalLayout from './layouts/GlobalLayout'
import CartPage from './pages/CartPage'
import CatalogPage from './pages/CatalogPage'
import CheckoutPage from './pages/CheckoutPage'
import GameDetailsPage from './pages/GameDetailsPage'
import HomePage from './pages/HomePage'
import LibraryFeedPage from './pages/LibraryFeedPage'
import LibraryGamePage from './pages/LibraryGamePage'
import LibraryPage from './pages/LibraryPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import ProfilePage from './pages/ProfilePage'
import RegisterPage from './pages/RegisterPage'
import SettingsPage from './pages/SettingsPage'

const protectedPage = (page) => <ProtectedRoute>{page}</ProtectedRoute>

function App() {
  return (
    <Routes>
      <Route element={<GlobalLayout />}>
        <Route index element={<HomePage />} />
        <Route path="catalog" element={<CatalogPage />} />
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
        <Route path="profile" element={protectedPage(<ProfilePage />)} />
        <Route path="settings" element={protectedPage(<SettingsPage />)} />
        <Route path="404" element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route element={<AuthLayout />}>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
      </Route>
    </Routes>
  )
}

export default App
