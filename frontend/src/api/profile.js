import api from './client'

const ensureProfile = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new TypeError('Invalid profile response')
  }
  return data
}

export const getProfile = async ({ signal } = {}) => {
  const { data } = await api.get('/profile/', { signal })
  return ensureProfile(data)
}

export const updateProfile = async (updates, { signal } = {}) => {
  const hasAvatarFile = updates?.avatar instanceof File

  if (!hasAvatarFile) {
    const { data } = await api.patch('/profile/', updates, { signal })
    return ensureProfile(data)
  }

  const formData = new FormData()
  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined) return
    if (value === null) {
      formData.append(key, '')
      return
    }
    formData.append(key, value)
  })

  const { data } = await api.patch('/profile/', formData, {
    signal,
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return ensureProfile(data)
}
