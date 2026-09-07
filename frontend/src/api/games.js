import api from "./client";

const normalizeCollection = (data, resourceName) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  throw new TypeError(`Invalid ${resourceName} response: expected a list`);
};

const normalizeGamePage = (data) => {
  if (Array.isArray(data)) {
    return {
      results: data,
      count: data.length,
      next: null,
      previous: null,
    };
  }

  if (!Array.isArray(data?.results)) {
    throw new TypeError("Invalid games response: expected paginated results");
  }

  if (!Number.isInteger(data.count) || data.count < 0) {
    throw new TypeError(
      "Invalid games response: expected a non-negative count",
    );
  }

  for (const key of ["next", "previous"]) {
    if (data[key] !== null && typeof data[key] !== "string") {
      throw new TypeError(`Invalid games response: expected ${key} link`);
    }
  }

  return {
    results: data.results,
    count: data.count,
    next: data.next,
    previous: data.previous,
  };
};

const buildGameParams = ({
  search = "",
  genre = "",
  ordering = "",
  page = 1,
  pageSize = 12,
  minPrice = "",
  maxPrice = "",
} = {}) => {
  const params = {
    page,
    page_size: pageSize,
  };
  const normalizedSearch = String(search).trim();
  const normalizedGenre = String(genre).trim();
  const normalizedMinPrice = String(minPrice).trim();
  const normalizedMaxPrice = String(maxPrice).trim();

  if (normalizedSearch) params.search = normalizedSearch;
  if (normalizedGenre && normalizedGenre !== "all") {
    params.genre = normalizedGenre;
  }
  if (ordering) params.ordering = ordering;
  if (normalizedMinPrice) params.min_price = normalizedMinPrice;
  if (normalizedMaxPrice) params.max_price = normalizedMaxPrice;
  return params;
};

export const getGames = async ({
  signal,
  search,
  genre,
  ordering,
  page,
  pageSize,
  minPrice,
  maxPrice,
} = {}) => {
  const { data } = await api.get("/games/", {
    signal,
    params: buildGameParams({
      search,
      genre,
      ordering,
      page,
      pageSize,
      minPrice,
      maxPrice,
    }),
  });
  return normalizeGamePage(data);
};

export const getFeaturedGames = async ({ signal } = {}) => {
  const { data } = await api.get("/games/featured/", { signal });
  return normalizeCollection(data, "featured games");
};

export const getGenres = async ({ signal } = {}) => {
  const { data } = await api.get("/genres/", { signal, skipAuth: true });
  return normalizeCollection(data, "genres");
};

export const getGameById = async (id, { signal } = {}) => {
  const { data } = await api.get(`/games/${id}/`, { signal });
  return data;
};
