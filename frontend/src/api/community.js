import api from "./client";
import { OPTIONAL_AUTH_MODE } from "./authPolicy";

const ensureObject = (value, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`Invalid community response: expected ${label}`);
  }
  return value;
};

export const getCommunityFeed = async (
  { scope = "all", kind = "all", search = "", ordering = "latest", page = 1, game },
  { signal } = {},
) => {
  const { data } = await api.get("/community/posts/", {
    signal,
    authMode: OPTIONAL_AUTH_MODE,
    params: { scope, kind, search: search.trim(), ordering, page, game },
  });
  ensureObject(data, "a feed payload");
  if (!Array.isArray(data.items)) {
    throw new TypeError(
      "Invalid community response: expected items to be a list",
    );
  }
  return {
    items: data.items,
    pagination: ensureObject(data.pagination, "pagination data"),
  };
};

export const getCommunityPost = async (postId, { signal } = {}) => {
  const { data } = await api.get(`/community/posts/${postId}/`, {
    signal,
    authMode: OPTIONAL_AUTH_MODE,
  });
  return ensureObject(data, "a post");
};

export const createCommunityPost = async (payload) => {
  const { data } = await api.post("/community/posts/", payload);
  return ensureObject(data, "a created post");
};

export const updateCommunityPost = async (postId, payload) => {
  const { data } = await api.patch(`/community/posts/${postId}/`, payload);
  return ensureObject(data, "an updated post");
};

export const deleteCommunityPost = async (postId) => {
  await api.delete(`/community/posts/${postId}/`);
};
