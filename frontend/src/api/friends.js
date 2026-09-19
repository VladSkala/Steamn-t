import api from "./client";

const ensureObject = (value, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`Invalid friends response: expected ${label}`);
  }
  return value;
};

const ensureList = (value, label) => {
  if (!Array.isArray(value)) {
    throw new TypeError(
      `Invalid friends response: expected ${label} to be a list`,
    );
  }
  return value;
};

export const getFriendsOverview = async ({ signal } = {}) => {
  const { data } = await api.get("/friends/", { signal });
  ensureObject(data, "an overview");
  return {
    friends: ensureList(data.friends, "friends"),
    incoming: ensureList(data.incoming, "incoming"),
    outgoing: ensureList(data.outgoing, "outgoing"),
    activity: data.activity || [],
  };
};

export const searchUsers = async (query, { signal } = {}) => {
  const { data } = await api.get("/friends/search/", {
    signal,
    params: { q: query.trim() },
  });
  ensureObject(data, "search results");
  return ensureList(data.items, "items");
};

export const sendFriendRequest = async (userId) => {
  const { data } = await api.post("/friends/requests/", { user_id: userId });
  return ensureObject(data, "a friend request");
};

export const acceptFriendRequest = async (requestId) => {
  const { data } = await api.post(`/friends/requests/${requestId}/accept/`, {});
  return ensureObject(data, "an accepted friendship");
};

export const rejectFriendRequest = async (requestId) => {
  await api.post(`/friends/requests/${requestId}/reject/`, {});
};

export const cancelFriendRequest = async (requestId) => {
  await api.post(`/friends/requests/${requestId}/cancel/`, {});
};

export const removeFriend = async (userId) => {
  await api.delete(`/friends/${userId}/`);
};
