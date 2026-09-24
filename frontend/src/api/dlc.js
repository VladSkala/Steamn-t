import api from './client'

export const getDLC = async (params = {}, { signal } = {}) => {
  const { data } = await api.get('/dlc/', { params, signal, authMode: 'optional' })
  return data
}

export const getDLCDetail = async (id, { signal } = {}) => {
  const { data } = await api.get(`/dlc/${id}/`, { signal, authMode: 'optional' })
  return data
}
