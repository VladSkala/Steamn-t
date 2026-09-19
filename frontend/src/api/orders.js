import api from './client'

export const getOrders = async (page = 1, { signal } = {}) => {
  const { data } = await api.get('/orders/', { params: { page }, signal })
  return data
}

export const getOrder = async (id, { signal } = {}) => {
  const { data } = await api.get(`/orders/${id}/`, { signal })
  return data
}
