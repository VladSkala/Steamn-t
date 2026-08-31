import { useEffect, useState } from 'react'

import { getLibraryFeed, getLibraryGame, getLibraryHome } from '../api/library'

const isCanceledRequest = (error) =>
  error?.code === 'ERR_CANCELED' ||
  error?.name === 'CanceledError' ||
  error?.name === 'AbortError'

const getErrorMessage = (error, fallback) => {
  if (!error?.response) {
    return 'The library service is unavailable. Check the backend and try again.'
  }
  if (error.response.status === 401) {
    return 'Your session has expired. Sign in again to open your library.'
  }
  if (error.response.status === 404) return 'not-found'
  return error.response.data?.detail || fallback
}

const createState = () => ({ data: null, loading: true, error: null })

export function useLibraryHome() {
  const [state, setState] = useState(createState)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    getLibraryHome({ signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ data, loading: false, error: null })
        }
      })
      .catch((error) => {
        if (controller.signal.aborted || isCanceledRequest(error)) return
        setState({
          data: null,
          loading: false,
          error: getErrorMessage(error, 'Your library could not be loaded.'),
        })
      })

    return () => controller.abort()
  }, [reloadKey])

  const retry = () => {
    setState((current) => ({ ...current, loading: true, error: null }))
    setReloadKey((value) => value + 1)
  }

  const refresh = () => setReloadKey((value) => value + 1)

  const updatePost = (postId, patch) => {
    setState((current) => {
      if (!current.data) return current
      const apply = (post) =>
        post.id === postId ? { ...post, ...patch } : post
      return {
        ...current,
        data: {
          ...current.data,
          news: current.data.news.map(apply),
          community: current.data.community.map(apply),
        },
      }
    })
  }

  return { ...state, retry, refresh, updatePost }
}

export function useLibraryGame(gameId) {
  const [state, setState] = useState(createState)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    getLibraryGame(gameId, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ data, loading: false, error: null })
        }
      })
      .catch((error) => {
        if (controller.signal.aborted || isCanceledRequest(error)) return
        setState({
          data: null,
          loading: false,
          error: getErrorMessage(
            error,
            'This library game could not be loaded.',
          ),
        })
      })

    return () => controller.abort()
  }, [gameId, reloadKey])

  const retry = () => {
    setState((current) => ({ ...current, loading: true, error: null }))
    setReloadKey((value) => value + 1)
  }

  const refresh = () => setReloadKey((value) => value + 1)

  const updatePost = (postId, patch) => {
    setState((current) => {
      if (!current.data) return current
      const apply = (post) =>
        post.id === postId ? { ...post, ...patch } : post
      return {
        ...current,
        data: {
          ...current.data,
          news: current.data.news.map(apply),
          community: current.data.community.map(apply),
        },
      }
    })
  }

  return { ...state, retry, refresh, updatePost }
}

export function useLibraryFeed({ tab, kind, search, ordering }) {
  const [state, setState] = useState(createState)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    getLibraryFeed(
      { tab, kind, search, ordering },
      { signal: controller.signal },
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ data, loading: false, error: null })
        }
      })
      .catch((error) => {
        if (controller.signal.aborted || isCanceledRequest(error)) return
        setState({
          data: null,
          loading: false,
          error: getErrorMessage(error, 'The feed could not be loaded.'),
        })
      })

    return () => controller.abort()
  }, [tab, kind, search, ordering, reloadKey])

  const retry = () => {
    setState((current) => ({ ...current, loading: true, error: null }))
    setReloadKey((value) => value + 1)
  }

  const refresh = () => setReloadKey((value) => value + 1)

  const updatePost = (postId, patch) => {
    setState((current) => {
      if (!current.data) return current
      return {
        ...current,
        data: {
          ...current.data,
          items: current.data.items.map((post) =>
            post.id === postId ? { ...post, ...patch } : post,
          ),
        },
      }
    })
  }

  return { ...state, retry, refresh, updatePost }
}
