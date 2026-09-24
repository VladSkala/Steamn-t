export const getCartItemCount = cart => {
  const gameCount = Array.isArray(cart?.items) ? cart.items.length : 0
  const dlcCount = Array.isArray(cart?.dlc_items) ? cart.dlc_items.length : 0
  return gameCount + dlcCount
}

export const createEmptyCartSnapshot = cart => ({
  ...(cart || {}),
  items: [],
  dlc_items: [],
  total: '0.00',
})
