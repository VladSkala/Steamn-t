import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { addCartItem, getCart, removeCartItem } from '../api/cart'
import { useAuth } from '../hooks/useAuth'
import { CartContext } from './CartContextValue'

const EMPTY_CART_STATE = {
  ownerId: null,
  cart: null,
  error: '',
  isLoading: false,
}

const getCartItemCount = (cart) =>
  Array.isArray(cart?.items) ? cart.items.length : 0

const getCartError = (requestError) =>
  requestError.response?.data?.detail ||
  requestError.message ||
  'Unable to load your cart right now.'

const isCanceledRequest = (requestError) =>
  requestError?.code === 'ERR_CANCELED' ||
  requestError?.name === 'CanceledError' ||
  requestError?.name === 'AbortError'

function CartProvider({ children }) {
  const {
    user,
    isAuthenticated,
    isLoading: authLoading,
  } = useAuth()
  const userId =
    isAuthenticated && user?.id != null ? String(user.id) : null
  const [cartState, setCartState] = useState(EMPTY_CART_STATE)
  const requestGeneration = useRef(0)

  useEffect(() => {
    requestGeneration.current += 1
    const generation = requestGeneration.current

    if (authLoading || !userId) {
      return undefined
    }

    let active = true
    const controller = new AbortController()

    getCart({ signal: controller.signal })
      .then((nextCart) => {
        if (active && requestGeneration.current === generation) {
          setCartState({
            ownerId: userId,
            cart: nextCart,
            error: '',
            isLoading: false,
          })
        }
      })
      .catch((requestError) => {
        if (
          active &&
          requestGeneration.current === generation &&
          !isCanceledRequest(requestError)
        ) {
          setCartState({
            ownerId: userId,
            cart: null,
            error: getCartError(requestError),
            isLoading: false,
          })
        }
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [authLoading, userId])

  const refreshCart = useCallback(async () => {
    if (!userId) {
      return null
    }

    const generation = requestGeneration.current

    setCartState((previous) => ({
      ownerId: userId,
      cart: previous.ownerId === userId ? previous.cart : null,
      error: '',
      isLoading: true,
    }))

    try {
      const nextCart = await getCart()

      if (requestGeneration.current === generation) {
        setCartState({
          ownerId: userId,
          cart: nextCart,
          error: '',
          isLoading: false,
        })
      }

      return nextCart
    } catch (requestError) {
      if (requestGeneration.current === generation) {
        setCartState((previous) => ({
          ownerId: userId,
          cart: previous.ownerId === userId ? previous.cart : null,
          error: getCartError(requestError),
          isLoading: false,
        }))
      }

      throw requestError
    }
  }, [userId])

  const addToCart = useCallback(async (gameId) => {
    if (!userId) {
      throw new Error('Sign in before adding a game to your cart.')
    }

    const generation = requestGeneration.current
    const nextCart = await addCartItem(gameId)

    if (requestGeneration.current === generation) {
      setCartState({
        ownerId: userId,
        cart: nextCart,
        error: '',
        isLoading: false,
      })
    }

    return nextCart
  }, [userId])

  const removeFromCart = useCallback(async (gameId) => {
    if (!userId) {
      throw new Error('Sign in before changing your cart.')
    }

    const generation = requestGeneration.current
    await removeCartItem(gameId)

    if (requestGeneration.current !== generation) {
      return null
    }

    return refreshCart()
  }, [refreshCart, userId])

  const ownsCartState = Boolean(
    userId && cartState.ownerId === userId,
  )
  const visibleCart = ownsCartState ? cartState.cart : null
  const visibleError = ownsCartState ? cartState.error : ''
  const isLoading = Boolean(userId) && (
    authLoading ||
    !ownsCartState ||
    cartState.isLoading
  )

  const isInCart = useCallback(
    (gameId) =>
      Array.isArray(visibleCart?.items) &&
      visibleCart.items.some(
        (item) => String(item.game?.id) === String(gameId),
      ),
    [visibleCart],
  )

  const itemCount = getCartItemCount(visibleCart)

  const value = useMemo(
    () => ({
      cart: visibleCart,
      itemCount,
      isLoading,
      error: visibleError,
      addToCart,
      removeFromCart,
      refreshCart,
      isInCart,
    }),
    [
      visibleCart,
      itemCount,
      isLoading,
      visibleError,
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
