import { useCallback, useEffect, useMemo, useState } from 'react'
import api, { clearTokens, getAccessToken, getRefreshToken, storeTokens } from '../api/client'
import { AuthContext } from './AuthContextValue'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  const logout = useCallback(() => {
    clearTokens()
    setUser(null)
  }, [])

  const reloadProfile = useCallback(async () => {
    if (!getAccessToken() && !getRefreshToken()) {
      setIsLoading(false)
      return
    }
    try {
      const { data } = await api.get('/profile/')
      setUser(data)
    } catch {
      logout()
    } finally {
      setIsLoading(false)
    }
  }, [logout])

  useEffect(() => { reloadProfile() }, [reloadProfile])

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

  const value = useMemo(() => ({
    user, isLoading, isAuthenticated: Boolean(user),
    login, register, logout, reloadProfile,
  }), [user, isLoading, login, register, logout, reloadProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
