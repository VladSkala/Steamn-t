import api from './client'

export const getLibrary = async ({ signal } = {}) => {
  const { data } = await api.get('/library/', { signal })
  return Array.isArray(data?.items) ? data.items : []
}
