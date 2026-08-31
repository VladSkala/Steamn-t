import api from './client'

const ensureArray = (value, name) => {
  if (!Array.isArray(value)) {
    throw new TypeError(
      `Invalid library response: expected ${name} to be a list`,
    )
  }
  return value
}

const ensureObject = (value, name) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`Invalid library response: expected ${name}`)
  }
  return value
}

export const getLibrary = async ({ signal } = {}) => {
  const { data } = await api.get('/library/', { signal })
  ensureObject(data, 'an object')
  return ensureArray(data.items, 'items')
}

export const getLibraryHome = async ({ signal } = {}) => {
  const { data } = await api.get('/library/home/', { signal })
  ensureObject(data, 'a home payload')
  return {
    items: ensureArray(data.items, 'items'),
    collections: ensureArray(data.collections, 'collections'),
    news: ensureArray(data.news, 'news'),
    community: ensureArray(data.community, 'community'),
  }
}

export const getLibraryGame = async (gameId, { signal } = {}) => {
  const { data } = await api.get(`/library/games/${gameId}/`, { signal })
  ensureObject(data, 'a game payload')
  ensureObject(data.game, 'game data')
  ensureObject(data.library_item, 'library item data')
  return {
    ...data,
    news: ensureArray(data.news, 'news'),
    community: ensureArray(data.community, 'community'),
    friends_own: ensureArray(data.friends_own, 'friends_own'),
    friends_want: ensureArray(data.friends_want, 'friends_want'),
  }
}

export const getLibraryFeed = async (
  { tab = 'recommended', kind = 'all', search = '', ordering = 'popular' },
  { signal } = {},
) => {
  const { data } = await api.get('/library/feed/', {
    signal,
    params: { tab, kind, search: search.trim(), ordering },
  })
  ensureObject(data, 'a feed payload')
  return { items: ensureArray(data.items, 'items') }
}

export const updateLibraryItem = async (itemId, updates) => {
  const { data } = await api.patch(`/library/items/${itemId}/`, updates)
  return ensureObject(data, 'updated library item data')
}

export const createLibraryCollection = async ({ name, gameIds }) => {
  const { data } = await api.post('/library/collections/', {
    name,
    game_ids: gameIds,
  })
  return ensureObject(data, 'created collection data')
}

export const updateLibraryCollection = async (
  collectionId,
  { name, gameIds },
) => {
  const { data } = await api.patch(`/library/collections/${collectionId}/`, {
    name,
    game_ids: gameIds,
  })
  return ensureObject(data, 'updated collection data')
}

export const deleteLibraryCollection = async (collectionId) => {
  await api.delete(`/library/collections/${collectionId}/`)
}

export const saveGameReview = async (gameId, review) => {
  const { data } = await api.put(`/library/games/${gameId}/review/`, review)
  return ensureObject(data, 'saved review data')
}

export const deleteGameReview = async (gameId) => {
  await api.delete(`/library/games/${gameId}/review/`)
}

export const toggleGameWishlist = async (gameId) => {
  const { data } = await api.post(`/library/games/${gameId}/wishlist/`, {})
  return ensureObject(data, 'wishlist state')
}

export const togglePostReaction = async (postId) => {
  const { data } = await api.post(`/library/posts/${postId}/reaction/`, {})
  return ensureObject(data, 'reaction state')
}

export const getPostComments = async (postId, { signal } = {}) => {
  const { data } = await api.get(`/library/posts/${postId}/comments/`, {
    signal,
  })
  ensureObject(data, 'comments payload')
  return ensureArray(data.items, 'comments')
}

export const createPostComment = async (postId, body) => {
  const { data } = await api.post(`/library/posts/${postId}/comments/`, {
    body,
  })
  return ensureObject(data, 'created comment data')
}
