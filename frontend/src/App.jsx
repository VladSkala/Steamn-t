import { Navigate, Route, Routes } from 'react-router-dom'

import GlobalLayout from './layouts/GlobalLayout'
import AuthLayout from './layouts/AuthLayout'

import HomePage from './pages/HomePage'
import CatalogPage from './pages/CatalogPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ProfilePage from './pages/ProfilePage'
import SettingsPage from './pages/SettingsPage'
import NotFoundPage from './pages/NotFoundPage'

import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <Routes>
      <Route element={<GlobalLayout />}>
        <Route index element={<HomePage />} />

        <Route path="catalog" element={<CatalogPage />} />

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
      </Route>

      <Route element={<AuthLayout />}>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
      </Route>

      <Route path="404" element={<NotFoundPage />} />

      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  )
}

export default App