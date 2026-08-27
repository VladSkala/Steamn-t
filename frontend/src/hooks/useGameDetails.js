import { useEffect, useState } from 'react'
import { getGameById } from '../api/games'

export default function useGameDetails(gameId) {
  const [retryKey, setRetryKey] = useState(0)

  const [state, setState] = useState({
    game: null,
    loading: true,
    error: null,
  })

  const retry = () => {
    setState((currentState) => ({
      ...currentState,
      loading: true,
      error: null,
    }))

    setRetryKey((currentKey) => currentKey + 1)
  }

  useEffect(() => {
    const controller = new AbortController()
    let isActive = true

    async function loadGame() {
      try {
        const game = await getGameById(gameId, {
          signal: controller.signal,
        })

        if (!isActive) return

        setState({
          game,
          loading: false,
          error: null,
        })
      } catch (error) {
        if (error.name === 'AbortError') return
        if (!isActive) return

        setState({
          game: null,
          loading: false,
          error: error.response?.status === 404 ? 'not-found' : 'error',
        })
      }
    }

    loadGame()

    return () => {
      isActive = false
      controller.abort()
    }
  }, [gameId, retryKey])

  return {
    ...state,
    retry,
  }
}