const LIBRARY_STORAGE_PREFIX = 'steamnt_library_'

const getStorageKey = (userId) =>
  userId == null ? null : `${LIBRARY_STORAGE_PREFIX}${String(userId)}`

export const getStoredLibrary = (userId) => {
  const key = getStorageKey(userId)
  if (!key) return []

  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const saveLibraryItems = (userId, items) => {
  const key = getStorageKey(userId)
  if (!key || !Array.isArray(items)) return

  const current = getStoredLibrary(userId)
  const byGameId = new Map()

  const mergedItems = [...current, ...items]

  mergedItems.forEach((item) => {
    const gameId = item?.game?.id ?? item?.game_id
    if (gameId != null) {
      byGameId.set(String(gameId), item)
    }
  })

  try {
    localStorage.setItem(key, JSON.stringify([...byGameId.values()]))
  } catch {
    // Library persistence is a convenience layer; checkout itself remains server-backed.
  }
}
