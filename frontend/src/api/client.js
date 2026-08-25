import axios from 'axios'

const configuredBaseUrl = import.meta.env.VITE_API_URL?.trim()
export const API_BASE_URL = (configuredBaseUrl || '/api').replace(/\/+$/, '')

export const ACCESS_TOKEN_STORAGE_KEY = 'steamnt_access_token'
export const REFRESH_TOKEN_STORAGE_KEY = 'steamnt_refresh_token'
export const AUTH_CLEARED_EVENT = 'steamnt:auth-cleared'

const publicAuthPaths = [
  '/auth/register/',
  '/auth/token/',
  '/auth/token/refresh/',
]

const isPublicAuthRequest = (url = '') =>
  publicAuthPaths.some((path) => url.includes(path))

export const getAccessToken = () =>
  localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)

export const getRefreshToken = () =>
  localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)

export const storeTokens = ({ access, refresh }) => {
  if (access) {
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, access)
  }

  if (refresh) {
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refresh)
  }
}

export const clearTokens = () => {
  localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY)
  window.dispatchEvent(new Event(AUTH_CLEARED_EVENT))
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

let refreshPromise = null

api.interceptors.request.use((config) => {
  const access = getAccessToken()

  if (access && !isPublicAuthRequest(config.url)) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${access}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config

    if (
      error.response?.status !== 401 ||
      !original ||
      original._retry ||
      isPublicAuthRequest(original.url)
    ) {
      return Promise.reject(error)
    }

    const refresh = getRefreshToken()

    if (!refresh) {
      clearTokens()
      return Promise.reject(error)
    }

    original._retry = true

    try {
      if (!refreshPromise) {
        refreshPromise = axios
          .post(`${API_BASE_URL}/auth/token/refresh/`, { refresh })
          .then(({ data }) => {
            storeTokens(data)
            return data.access
          })
          .finally(() => {
            refreshPromise = null
          })
      }

      const access = await refreshPromise
      original.headers = original.headers ?? {}
      original.headers.Authorization = `Bearer ${access}`

      return api(original)
    } catch (refreshError) {
      clearTokens()
      return Promise.reject(refreshError)
    }
  },
)

export default api
