import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'
const ACCESS_KEY = 'steamnt_access_token'
const REFRESH_KEY = 'steamnt_refresh_token'

export const getAccessToken = () => localStorage.getItem(ACCESS_KEY)
export const getRefreshToken = () => localStorage.getItem(REFRESH_KEY)
export const storeTokens = ({ access, refresh }) => {
  if (access) localStorage.setItem(ACCESS_KEY, access)
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
}
export const clearTokens = () => {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

const api = axios.create({ baseURL: API_BASE_URL, headers: { 'Content-Type': 'application/json' } })
let refreshPromise = null

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    if (error.response?.status !== 401 || original?._retry || original?.url?.includes('auth/token/')) {
      return Promise.reject(error)
    }
    const refresh = getRefreshToken()
    if (!refresh) return Promise.reject(error)
    original._retry = true
    try {
      if (!refreshPromise) {
        refreshPromise = axios.post(`${API_BASE_URL}/auth/token/refresh/`, { refresh })
          .then(({ data }) => {
            storeTokens(data)
            return data.access
          })
          .finally(() => { refreshPromise = null })
      }
      const access = await refreshPromise
      original.headers.Authorization = `Bearer ${access}`
      return api(original)
    } catch (refreshError) {
      clearTokens()
      return Promise.reject(refreshError)
    }
  },
)

export default api
