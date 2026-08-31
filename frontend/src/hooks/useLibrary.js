import { useEffect, useState } from 'react'

import { getLibrary } from '../api/library'

const initialState = {
  items: [],
  status: 'loading',
  error: null,
}

const isCanceledRequest = (error) =>
  error?.code === 'ERR_CANCELED' ||
  error?.name === 'CanceledError' ||
  error?.name === 'AbortError'

const getLibraryErrorMessage = (error) => {
  if (!error?.response) {
    return 'The library service is unavailable. Check the backend and try again.'
  }

  if (error.response.status === 401) {
    return 'Your session has expired. Sign in again to open your library.'
  }

  if (error.response.status >= 500) {
    return 'The library service had a problem. Please try again.'
  }

  return 'Your library could not be loaded. Please try again.'
}

function useLibrary() {
  const [state, setState] = useState(initialState)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    getLibrary({ signal: controller.signal })
      .then((items) => {
        if (!controller.signal.aborted) {
          setState({ items, status: 'success', error: null })
        }
      })
      .catch((error) => {
        if (controller.signal.aborted || isCanceledRequest(error)) return

        setState({
          items: [],
          status: 'error',
          error: getLibraryErrorMessage(error),
        })
      })

    return () => controller.abort()
  }, [reloadKey])

  const retry = () => {
    setState((current) => ({
      ...current,
      status: 'loading',
      error: null,
    }))
    setReloadKey((value) => value + 1)
  }

  return {
    items: state.items,
    loading: state.status === 'loading',
    error: state.error,
    retry,
  }
}

export default useLibrary
