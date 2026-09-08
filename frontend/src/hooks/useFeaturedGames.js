
import { useEffect, useState } from "react";

import { getFeaturedGames } from "../api/games";

const initialState = {
  games: [],
  status: "loading",
  error: null,
  requestKey: null,
};

const getFeaturedErrorMessage = (error) => {
  if (!error?.response) {
    return "The featured games service is unavailable. Check the backend and try again.";
  }

  if (error.response.status >= 500) {
    return "The featured games service had a problem. Please try again.";
  }

  return "Featured games could not be loaded. Please try again.";
};

function useFeaturedGames() {
  const [state, setState] = useState(initialState);
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = String(reloadKey);

  useEffect(() => {
    const controller = new AbortController();

    getFeaturedGames({ signal: controller.signal })
      .then((games) => {
        if (controller.signal.aborted) return;

        setState({
          games,
          status: "success",
          error: null,
          requestKey,
        });
      })
      .catch((error) => {
        if (controller.signal.aborted || error?.code === "ERR_CANCELED") {
          return;
        }

        // Featured Games must not break the Home Page for unauthenticated users.
        // A 401 is treated the same as an empty Featured response.
        if (error?.response?.status === 401) {
          setState({
            games: [],
            status: "success",
            error: null,
            requestKey,
          });
          return;
        }

        setState({
          games: [],
          status: "error",
          error: getFeaturedErrorMessage(error),
          requestKey,
        });
      });

    return () => controller.abort();
  }, [reloadKey, requestKey]);

  const retry = () => {
    setReloadKey((value) => value + 1);
  };

  const isCurrentRequest = state.requestKey === requestKey;

  return {
    games: isCurrentRequest ? state.games : [],
    loading: !isCurrentRequest || state.status === "loading",
    error: isCurrentRequest ? state.error : null,
    retry,
  };
}

export default useFeaturedGames;

