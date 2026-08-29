import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'
import { getStoredLibrary, saveLibraryItems } from '../utils/libraryStorage'
import { getLibrary } from '../api/library'

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

function LibraryPage() {
  const location = useLocation()
  const { user } = useAuth()
  const order = location.state?.order
  const isCheckoutSuccess = location.state?.checkoutSuccess === true
  const stateItems = Array.isArray(order?.items) ? order.items : []
  const [libraryItems, setLibraryItems] = useState(() =>
    stateItems.length > 0 ? stateItems : getStoredLibrary(user?.id),
  )

  useEffect(() => {
    const controller = new AbortController()
    getLibrary({ signal: controller.signal })
      .then((items) => {
        if (!controller.signal.aborted) {
          setLibraryItems(items)
          saveLibraryItems(user?.id, items)
        }
      })
      .catch((requestError) => {
        if (controller.signal.aborted || requestError?.code === 'ERR_CANCELED') return
        setLibraryItems(getStoredLibrary(user?.id))
      })

    return () => controller.abort()
  }, [user?.id])

  const items = libraryItems


  return (
    <div className="library-page">
      {isCheckoutSuccess ? (
        <section className="library-success" role="status">
          <div className="library-success-icon" aria-hidden="true">✓</div>
          <span className="section-kicker">PURCHASE COMPLETE</span>
          <h1>Your games are in the library.</h1>
          <p>
            Demo order #{order?.id} was completed successfully. No real payment
            was processed.
          </p>
        </section>
      ) : items.length > 0 ? (
        <section className="library-success" role="status">
          <span className="section-kicker">LIBRARY</span>
          <h1>Your library</h1>
          <p>Your purchased games are ready to play.</p>
        </section>
      ) : (
        <section className="library-empty">
          <span className="section-kicker">LIBRARY</span>
          <h1>Your library</h1>
          <p>
            Your purchased games will appear here after a successful demo checkout.
          </p>
        </section>
      )}

      {items.length > 0 && (
        <section className="library-purchased" aria-labelledby="library-purchased-title">
          <div className="library-section-heading">
            <div>
              <span className="section-kicker">{isCheckoutSuccess ? 'JUST ADDED' : 'PURCHASED GAMES'}</span>
              <h2 id="library-purchased-title">Your games</h2>
            </div>
            {order?.total_price != null && (
              <strong>{formatPrice(order.total_price)}</strong>
            )}
          </div>

          <div className="library-purchased-grid">
            {items.map((item) => {
              const game = item.game
              const gameId = game?.id ?? item.game_id

              return (
                <article className="library-game" key={item.id ?? gameId}>
                  <div className="library-game-cover" aria-hidden="true">
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
                  <div className="library-game-info">
                    <Link to={`/games/${gameId}`}>
                      {game?.title || 'Untitled game'}
                    </Link>
                    <span>{game?.developer || 'Steamn’t catalog'}</span>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      <div className="library-actions">
        <Link to="/catalog" className="primary-button">
          Continue shopping
          <span>→</span>
        </Link>
        <Link to="/profile" className="cart-secondary-link">
          View profile
        </Link>
      </div>
    </div>
  )
}

export default LibraryPage
