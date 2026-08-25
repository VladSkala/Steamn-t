import api from './client'

const normalizeCollection = (data, resourceName) => {
  if (Array.isArray(data)) {
    return data
  }

  if (Array.isArray(data?.results)) {
    return data.results
  }

  throw new TypeError(`Invalid ${resourceName} response: expected a list`)
}

export const getGames = async ({ signal } = {}) => {
  const { data } = await api.get('/games/', {
    signal,
    skipAuth: true,
  })

  return normalizeCollection(data, 'games')
}

export const getGenres = async ({ signal } = {}) => {
  const { data } = await api.get('/genres/', {
    signal,
    skipAuth: true,
  })

  return normalizeCollection(data, 'genres')
}
