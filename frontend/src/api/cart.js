import api from './client'

const normalizeCart = (data) => {
  if (!data || typeof data !== 'object' || !Array.isArray(data.items)) {
    throw new TypeError('Invalid cart response')
  }

  return data
}

export const getCart = async () => {
  const { data } = await api.get('/cart/')
  return normalizeCart(data)
}

export const addCartItem = async (gameId) => {
  const { data } = await api.post('/cart/items/', { game_id: gameId })
  return normalizeCart(data)
}

export const removeCartItem = async (gameId) => {
  await api.delete(`/cart/items/${gameId}/`)
}
