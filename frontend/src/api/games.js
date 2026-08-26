import api from './client'

const normalizeCollection = (data, resourceName) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  throw new TypeError(`Invalid ${resourceName} response: expected a list`)
}

const buildGameParams = ({ search = '', genre = '', ordering = '' } = {}) => {
  const params = {}
  const normalizedSearch = search.trim()
  if (normalizedSearch) params.search = normalizedSearch
  if (genre && genre !== 'all') params.genre = genre
  if (ordering) params.ordering = ordering
  return params
}

export const getGames = async ({ signal, search, genre, ordering } = {}) => {
  const { data } = await api.get('/games/', {
    signal,
    params: buildGameParams({ search, genre, ordering }),
    skipAuth: true,
  })
  return normalizeCollection(data, 'games')
}

export const getGenres = async ({ signal } = {}) => {
  const { data } = await api.get('/genres/', { signal, skipAuth: true })
  return normalizeCollection(data, 'genres')
}
