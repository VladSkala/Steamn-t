import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import CatalogFeedback from '../components/CatalogFeedback'
import { checkoutCart } from '../api/checkout'
import { useCart } from '../hooks/useCart'
import { useAuth } from '../hooks/useAuth'
import { saveLibraryItems } from '../utils/libraryStorage'

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const formatPrice = (price) => {
  const numericPrice = Number(price)

  if (!Number.isFinite(numericPrice)) {
    return 'Price unavailable'
  }

  if (numericPrice === 0) {
    return 'Free'
  }

  return priceFormatter.format(numericPrice)
}

const getCheckoutError = (error) =>
  error?.response?.data?.detail ||
  error?.message ||
  'Demo payment could not be completed. Please try again.'

function CheckoutPage() {
  const navigate = useNavigate()
  const { cart, isLoading, error, refreshCart, removeFromCart } = useCart()
  const { user } = useAuth()
  const [isPaying, setIsPaying] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [alreadyOwnedGameIds, setAlreadyOwnedGameIds] = useState([])

  const items = Array.isArray(cart?.items) ? cart.items : []

  const handleRetry = () => {
    setCheckoutError('')
    setAlreadyOwnedGameIds([])
    refreshCart().catch(() => {})
  }

  const handlePayDemo = async () => {
    setIsPaying(true)
    setCheckoutError('')
    setAlreadyOwnedGameIds([])

    try {
      const order = await checkoutCart()
      saveLibraryItems(user?.id, order.items)
      refreshCart().catch(() => {})
      navigate('/library', {
        replace: true,
        state: {
          checkoutSuccess: true,
          order,
        },
      })
    } catch (requestError) {
      const responseData = requestError?.response?.data
      const ownedIds = Array.isArray(responseData?.game_ids)
        ? responseData.game_ids.map(String)
        : []

      if (responseData?.code === 'already_owned') {
        setAlreadyOwnedGameIds(ownedIds)
        const ownedTitles = items
          .filter((item) => ownedIds.includes(String(item?.game?.id)))
          .map((item) => item?.game?.title)
          .filter(Boolean)

        const titleMessage = ownedTitles.length > 0
          ? `${ownedTitles.join(', ')} ${ownedTitles.length === 1 ? 'is' : 'are'} already in your library.`
          : 'One or more games are already in your library.'

        setCheckoutError(`${titleMessage} Remove ${ownedTitles.length === 1 ? 'it' : 'them'} from your cart before checkout.`)
      } else {
        setCheckoutError(getCheckoutError(requestError))
      }
      setIsPaying(false)
    }
  }

  if (isLoading && !cart) {
    return (
      <div className="checkout-page checkout-feedback-page">
        <CatalogFeedback
          kind="loading"
          title="Loading checkout"
          message="Preparing your order summary."
        />
      </div>
    )
  }

  if (error && !cart) {
    return (
      <div className="checkout-page checkout-feedback-page">
        <CatalogFeedback
          kind="error"
          title="Checkout unavailable"
          message={error}
          onRetry={handleRetry}
        />
        <Link className="cart-secondary-link" to="/cart">
          Back to cart
        </Link>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="checkout-page">
        <section className="checkout-empty-state">
          <span className="section-kicker">CHECKOUT</span>
          <h1>Your cart is empty.</h1>
          <p>Add at least one game before starting the demo checkout.</p>
          <Link className="primary-button" to="/catalog">
            Browse catalog
            <span>→</span>
          </Link>
        </section>
      </div>
    )
  }

  return (
    <div className="checkout-page">
      <section className="checkout-hero">
        <div>
          <span className="section-kicker">DEMO CHECKOUT</span>
          <h1>Complete your order.</h1>
          <p>This is a demo purchase. No real payment is processed.</p>
        </div>
        <Link className="cart-secondary-link" to="/cart">
          Back to cart
          <span>←</span>
        </Link>
      </section>

      {checkoutError && (
        <div className="checkout-error" role="alert">
          <div>
            <strong>Payment failed</strong>
            <span>{checkoutError}</span>
          </div>
          <button type="button" onClick={() => setCheckoutError('')}>
            Dismiss
          </button>
        </div>
      )}

      <div className="checkout-layout">
        <section className="checkout-card" aria-labelledby="checkout-items-title">
          <div className="checkout-card-heading">
            <div>
              <span className="section-kicker">ORDER</span>
              <h2 id="checkout-items-title">Your games</h2>
            </div>
            <span>{items.length} {items.length === 1 ? 'game' : 'games'}</span>
          </div>

          <div className="checkout-items">
            {items.map((item) => {
              const game = item.game
              const title = game?.title || 'Untitled game'
              const gameId = game?.id

              return (
                <article className="checkout-item" key={item.id}>
                  <div className="checkout-item-cover" aria-hidden="true">
                    <span>S</span>
                    {game?.cover && (
                      <img
                        src={game.cover}
                        alt=""
                        onError={(event) => {
                          event.currentTarget.hidden = true
                        }}
                      />
                    )}
                  </div>
                  <div className="checkout-item-info">
                    <Link to={`/games/${gameId}`}>{title}</Link>
                    <span>{game?.developer || 'Steamn’t catalog'}</span>
                  </div>
                  <strong>{formatPrice(game?.price)}</strong>
                  {alreadyOwnedGameIds.includes(String(gameId)) && (
                    <button
                      type="button"
                      className="checkout-remove-owned"
                      onClick={async () => {
                        setCheckoutError('')
                        setAlreadyOwnedGameIds([])
                        try {
                          await removeFromCart(gameId)
                        } catch (removeError) {
                          setCheckoutError(
                            removeError?.response?.data?.detail ||
                            'Unable to remove this game from your cart.',
                          )
                        }
                      }}
                    >
                      Remove from cart
                    </button>
                  )}
                </article>
              )
            })}
          </div>
        </section>

        <aside className="checkout-summary">
          <span className="section-kicker">SUMMARY</span>
          <div className="checkout-summary-row">
            <span>Items</span>
            <span>{items.length}</span>
          </div>
          <div className="checkout-summary-total">
            <span>Total</span>
            <strong>{formatPrice(cart?.total)}</strong>
          </div>

          <button
            type="button"
            className="primary-button checkout-pay-button"
            onClick={handlePayDemo}
            disabled={isPaying}
          >
            {isPaying ? 'Processing…' : 'Pay Demo'}
          </button>

          <p>
            Demo mode only. A successful checkout creates the order and moves
            purchased games into your library.
          </p>
        </aside>
      </div>
    </div>
  )
}

export default CheckoutPage
