import api from "./client";

const ensureObject = (value, name) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`Invalid reviews response: expected ${name}`);
  }
  return value;
};

const ensureArray = (value, name) => {
  if (!Array.isArray(value)) {
    throw new TypeError(
      `Invalid reviews response: expected ${name} to be a list`,
    );
  }
  return value;
};

export const getGameReviews = async (
  gameId,
  { page = 1, pageSize = 10, signal } = {},
) => {
  const { data } = await api.get(`/games/${gameId}/reviews/`, {
    signal,
    params: { page, page_size: pageSize },
  });

  ensureObject(data, "a reviews payload");
  ensureObject(data.pagination, "pagination");
  ensureObject(data.rating_distribution, "rating_distribution");
  ensureArray(data.reviews, "reviews");

  return data;
};

export const getMyReviews = async ({
  page = 1,
  pageSize = 10,
  signal,
} = {}) => {
  const { data } = await api.get("/reviews/my/", {
    signal,
    params: { page, page_size: pageSize },
  });

  ensureObject(data, "a My Reviews payload");
  ensureArray(data.results, "results");
  if (!Number.isInteger(data.count) || data.count < 0) {
    throw new TypeError(
      "Invalid reviews response: expected a non-negative count",
    );
  }
  for (const field of ["next", "previous"]) {
    if (data[field] !== null && typeof data[field] !== "string") {
      throw new TypeError(
        `Invalid reviews response: expected ${field} to be a URL or null`,
      );
    }
  }

  return data;
};

export const createGameReview = async (gameId, payload) => {
  const { data } = await api.post(`/games/${gameId}/reviews/`, payload);
  return ensureObject(data, "created review data");
};

export const updateGameReview = async (gameId, reviewId, payload) => {
  const { data } = await api.patch(
    `/games/${gameId}/reviews/${reviewId}/`,
    payload,
  );
  return ensureObject(data, "updated review data");
};

export const deleteGameReviewById = async (gameId, reviewId) => {
  await api.delete(`/games/${gameId}/reviews/${reviewId}/`);
};
