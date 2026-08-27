import { Route, Routes } from 'react-router-dom'

import ProtectedRoute from './components/ProtectedRoute'
import AuthLayout from './layouts/AuthLayout'
import GlobalLayout from './layouts/GlobalLayout'
import CatalogPage from './pages/CatalogPage'
import HomePage from './pages/HomePage'
import GameDetailsPage from './pages/GameDetailsPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import ProfilePage from './pages/ProfilePage'
import RegisterPage from './pages/RegisterPage'
import SettingsPage from './pages/SettingsPage'

function App() {
  return (
    <Routes>
      <Route element={<GlobalLayout />}>
        <Route index element={<HomePage />} />
        <Route path="catalog" element={<CatalogPage />} />
        <Route path="games/:gameId" element={<GameDetailsPage />} />

        <Route
          path="profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

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
