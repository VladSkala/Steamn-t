import api from './client'

const normalizeCart = (data) => {
  if (
    !data ||
    typeof data !== 'object' ||
    !Array.isArray(data.items) ||
    data.total == null
  ) {
    throw new TypeError('Invalid cart response')
  }

  return data
}

export const getCart = async ({ signal } = {}) => {
  const { data } = await api.get('/cart/', { signal })
  return normalizeCart(data)
}

export const addCartItem = async (gameId, { signal } = {}) => {
  const { data } = await api.post(
    '/cart/items/',
    { game_id: gameId },
    { signal },
  )
  return normalizeCart(data)
}

export const removeCartItem = async (gameId, { signal } = {}) => {
  await api.delete(`/cart/items/${gameId}/`, { signal })
}
