import api from './client'

export const getDLC = async (params = {}, { signal } = {}) => {
  const { data } = await api.get('/dlc/', { params, signal, authMode: 'optional' })
  return data
}

export const getDLCDetail = async (id, { signal } = {}) => {
  const { data } = await api.get(`/dlc/${id}/`, { signal, authMode: 'optional' })
  return data
}

export const getBundles = async (params = {}, { signal } = {}) => {
  const { data } = await api.get('/bundles/', { params, signal, authMode: 'optional' })
  return data
}

export const getBundleDetail = async (id, { signal } = {}) => {
  const { data } = await api.get(`/bundles/${id}/`, { signal, authMode: 'optional' })
  return data
}

export const checkoutBundle = async (id) => {
  const { data } = await api.post(`/orders/bundles/${id}/checkout/`, {})
  return data
}
