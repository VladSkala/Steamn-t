import { useCallback, useEffect, useState } from 'react'

import { getProfile, updateProfile } from '../api/profile'

const initialState = {
  data: null,
  status: 'loading',
  error: null,
}

const isCanceledRequest = (error) =>
  error?.code === 'ERR_CANCELED' ||
  error?.name === 'CanceledError' ||
  error?.name === 'AbortError'

const getProfileErrorMessage = (error) => {
  if (!error?.response) {
    return 'The profile service is unavailable. Check the backend and try again.'
  }
  if (error.response.status === 401) {
    return 'Your session has expired. Sign in again to open your profile.'
  }
  if (error.response.status >= 500) {
    return 'The profile service had a problem. Please try again.'
  }
  return (
    error.response.data?.detail ||
    'Your profile could not be loaded. Please try again.'
  )
}

export default function useProfile() {
  const [state, setState] = useState(initialState)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    getProfile({ signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ data, status: 'success', error: null })
        }
      })
      .catch((error) => {
        if (controller.signal.aborted || isCanceledRequest(error)) return
        setState({
          data: null,
          status: 'error',
          error: getProfileErrorMessage(error),
        })
      })

    return () => controller.abort()
  }, [reloadKey])

  const reload = useCallback(() => {
    setState((current) => ({ ...current, status: 'loading', error: null }))
    setReloadKey((value) => value + 1)
  }, [])

  const save = useCallback(async (updates) => {
    const data = await updateProfile(updates)
    setState({ data, status: 'success', error: null })
    return data
  }, [])

  return {
    profile: state.data,
    loading: state.status === 'loading',
    error: state.error,
    reload,
    save,
  }
}
