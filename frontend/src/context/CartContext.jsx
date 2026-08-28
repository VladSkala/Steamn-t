import { useCallback, useEffect, useMemo, useState } from 'react'
import { addCartItem, getCart, removeCartItem } from '../api/cart'
import { CartContext } from './CartContextValue'
import { useAuth } from '../hooks/useAuth'

const getCartItemCount = (cart) => (Array.isArray(cart?.items) ? cart.items.length : 0)

async function loadCart({
  setCart,
  setError,
  setIsLoading,
  isActive,
}) {
  setIsLoading(true)
  setError('')

  try {
    const nextCart = await getCart()

    if (isActive()) {
      setCart(nextCart)
    }

    return nextCart
  } catch (requestError) {
    if (isActive()) {
      setError(
        requestError.response?.data?.detail ||
          'Unable to load your cart right now.',
      )
    }

    throw requestError
  } finally {
    if (isActive()) {
      setIsLoading(false)
    }
  }
}

function CartProvider({ children }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [cart, setCart] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const refreshCart = useCallback(async () => {
    if (!isAuthenticated) {
      return null
    }

    return loadCart({
      setCart,
      setError,
      setIsLoading,
      isActive: () => true,
    })
  }, [isAuthenticated])

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      return undefined
    }

    let active = true

    loadCart({
      setCart,
      setError,
      setIsLoading,
      isActive: () => active,
    }).catch(() => {})

    return () => {
      active = false
    }
  }, [authLoading, isAuthenticated])

  const addToCart = useCallback(async (gameId) => {
    const nextCart = await addCartItem(gameId)
    setCart(nextCart)
    setError('')
    return nextCart
  }, [])

  const removeFromCart = useCallback(async (gameId) => {
    await removeCartItem(gameId)
    await refreshCart()
  }, [refreshCart])

  const isInCart = useCallback(
    (gameId) =>
      Array.isArray(cart?.items) &&
      cart.items.some((item) => String(item.game?.id) === String(gameId)),
    [cart],
  )

  const visibleCart = isAuthenticated ? cart : null

  const value = useMemo(
    () => ({
      cart: visibleCart,
      itemCount: getCartItemCount(visibleCart),
      isLoading,
      error: isAuthenticated ? error : '',
      addToCart,
      removeFromCart,
      refreshCart,
      isInCart,
    }),
    [
      visibleCart,
      isLoading,
      error,
      isAuthenticated,
      addToCart,
      removeFromCart,
      refreshCart,
      isInCart,
    ],
  )

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  )
}

export default CartProvider
