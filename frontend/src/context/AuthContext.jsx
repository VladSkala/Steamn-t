import { useCallback, useEffect, useMemo, useState } from 'react'
import api, {
  ACCESS_TOKEN_STORAGE_KEY,
  AUTH_CLEARED_EVENT,
  REFRESH_TOKEN_STORAGE_KEY,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  storeTokens,
} from '../api/client'
import { AuthContext } from './AuthContextValue'

const hasStoredSession = () =>
  Boolean(getAccessToken() || getRefreshToken())

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(hasStoredSession)

  const logout = useCallback(() => {
    clearTokens()
    setUser(null)
  }, [])

  const reloadProfile = useCallback(async () => {
    if (!hasStoredSession()) {
      setUser(null)
      setIsLoading(false)
      return null
    }

    try {
      const { data } = await api.get('/profile/')
      setUser(data)
      return data
    } catch {
      logout()
      return null
    } finally {
      setIsLoading(false)
    }
  }, [logout])

  useEffect(() => {
    if (!hasStoredSession()) {
      return undefined
    }

    let isActive = true

    api
      .get('/profile/')
      .then(({ data }) => {
        if (isActive) {
          setUser(data)
        }
      })
      .catch(() => {
        if (isActive) {
          logout()
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [logout])

  useEffect(() => {
    const handleAuthCleared = () => {
      setUser(null)
      setIsLoading(false)
    }

    const handleStorage = (event) => {
      if (
        event.key !== ACCESS_TOKEN_STORAGE_KEY &&
        event.key !== REFRESH_TOKEN_STORAGE_KEY
      ) {
        return
      }

      if (!hasStoredSession()) {
        handleAuthCleared()
        return
      }

      reloadProfile()
    }

    window.addEventListener(AUTH_CLEARED_EVENT, handleAuthCleared)
    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener(AUTH_CLEARED_EVENT, handleAuthCleared)
      window.removeEventListener('storage', handleStorage)
    }
  }, [reloadProfile])

  const login = useCallback(async (credentials) => {
    const { data } = await api.post('/auth/token/', credentials)
    storeTokens(data)
    setUser(data.user)
    return data.user
  }, [])

  const register = useCallback(async (payload) => {
    const { data } = await api.post('/auth/register/', payload)
    storeTokens(data)
    setUser(data.user)
    return data.user
  }, [])

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
      reloadProfile,
    }),
    [user, isLoading, login, register, logout, reloadProfile],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
