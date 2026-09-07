import { useEffect, useState } from "react";

import { getGames, getGenres } from "../api/games";

const initialState = {
  games: [],
  genres: [],
  totalCount: 0,
  next: null,
  previous: null,
  status: "loading",
  error: null,
  requestKey: null,
};

const getCatalogErrorMessage = (error) => {
  if (!error?.response) {
    return "The catalog service is unavailable. Check the backend and try again.";
  }
  if (error.response.status === 400) {
    return "Some catalog filters are invalid. Update or reset the filters.";
  }
  if (error.response.status === 404) {
    return "That catalog page is unavailable. Return to the first page.";
  }
  if (error.response.status >= 500) {
    return "The catalog service had a problem. Please try again.";
  }
  return "The catalog could not be loaded. Please try again.";
};

function useCatalogData({
  includeGenres = false,
  search = "",
  genre = "all",
  ordering = "",
  page = 1,
  pageSize = 12,
  minPrice = "",
  maxPrice = "",
} = {}) {
  const [state, setState] = useState(initialState);
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = JSON.stringify([
    includeGenres,
    search,
    genre,
    ordering,
    page,
    pageSize,
    minPrice,
    maxPrice,
    reloadKey,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    const gamesRequest = getGames({
      signal: controller.signal,
      search,
      genre,
      ordering,
      page,
      pageSize,
      minPrice,
      maxPrice,
    });
    const request = includeGenres
      ? Promise.all([gamesRequest, getGenres({ signal: controller.signal })])
      : gamesRequest.then((gamePage) => [gamePage, []]);

    request
      .then(([gamePage, genres]) => {
        if (!controller.signal.aborted) {
          setState({
            games: gamePage.results,
            genres,
            totalCount: gamePage.count,
            next: gamePage.next,
            previous: gamePage.previous,
            status: "success",
            error: null,
            requestKey,
          });
        }
      })
      .catch((error) => {
        if (controller.signal.aborted || error?.code === "ERR_CANCELED") return;
        setState((current) => ({
          ...current,
          games: [],
          totalCount: 0,
          next: null,
          previous: null,
          status: "error",
          error: getCatalogErrorMessage(error),
          requestKey,
        }));
      });

    return () => controller.abort();
  }, [
    includeGenres,
    search,
    genre,
    ordering,
    page,
    pageSize,
    minPrice,
    maxPrice,
    reloadKey,
    requestKey,
  ]);

  const retry = () => {
    setReloadKey((value) => value + 1);
  };

  const isCurrentRequest = state.requestKey === requestKey;

  return {
    games: isCurrentRequest ? state.games : [],
    genres: state.genres,
    totalCount: isCurrentRequest ? state.totalCount : 0,
    next: isCurrentRequest ? state.next : null,
    previous: isCurrentRequest ? state.previous : null,
    loading: !isCurrentRequest || state.status === "loading",
    error: isCurrentRequest ? state.error : null,
    retry,
  };
}

export default useCatalogData;
