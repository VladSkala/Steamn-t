import api from './client'

const normalizeCheckoutOrder = (data) => {
  if (
    !data ||
    typeof data !== 'object' ||
    data.id == null ||
    data.status !== 'completed' ||
    data.total_price == null ||
    !Array.isArray(data.items)
  ) {
    throw new TypeError('Invalid checkout response')
  }

  return data
}

export const checkoutCart = async ({ signal } = {}) => {
  const { data } = await api.post('/orders/checkout/', {}, { signal })
  return normalizeCheckoutOrder(data)
}
