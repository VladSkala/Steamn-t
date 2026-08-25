import { useEffect, useState } from 'react'

import { getGames, getGenres } from '../api/games'

const initialState = {
  games: [],
  genres: [],
  status: 'loading',
  error: null,
}

const getCatalogErrorMessage = (error) => {
  if (!error?.response) {
    return 'The catalog service is unavailable. Check the backend and try again.'
  }

  if (error.response.status >= 500) {
    return 'The catalog service had a problem. Please try again.'
  }

  return 'The catalog could not be loaded. Please try again.'
}

function useCatalogData({ includeGenres = false } = {}) {
  const [state, setState] = useState(initialState)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    const request = includeGenres
      ? Promise.all([
          getGames({ signal: controller.signal }),
          getGenres({ signal: controller.signal }),
        ])
      : getGames({ signal: controller.signal }).then((games) => [games, []])

    request
      .then(([games, genres]) => {
        if (controller.signal.aborted) {
          return
        }

        setState({
          games,
          genres,
          status: 'success',
          error: null,
        })
      })
      .catch((error) => {
        if (controller.signal.aborted || error?.code === 'ERR_CANCELED') {
          return
        }

        setState({
          games: [],
          genres: [],
          status: 'error',
          error: getCatalogErrorMessage(error),
        })
      })

    return () => controller.abort()
  }, [includeGenres, reloadKey])

  const retry = () => {
    setState((current) => ({
      ...current,
      status: 'loading',
      error: null,
    }))
    setReloadKey((value) => value + 1)
  }

  return {
    games: state.games,
    genres: state.genres,
    loading: state.status === 'loading',
    error: state.error,
    retry,
  }
}

export default useCatalogData
