import { useCallback, useEffect, useMemo, useState } from "react";

import { getCommunityFeed } from "../api/community";

const canceled = (error) =>
  error?.code === "ERR_CANCELED" ||
  error?.name === "CanceledError" ||
  error?.name === "AbortError";

const messageFor = (error) => {
  if (!error?.response) {
    return "The community service is unavailable. Check the backend and try again.";
  }
  if (error.response.status === 401) {
    return "Sign in again to use this community view.";
  }
  return (
    error.response.data?.detail || "The community feed could not be loaded."
  );
};

export default function useCommunityFeed(filters) {
  const [result, setResult] = useState({
    requestKey: null,
    data: null,
    error: "",
  });
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = useMemo(
    () =>
      JSON.stringify([
        filters.scope,
        filters.game,
        filters.kind,
        filters.ordering,
        filters.search,
        filters.page,
        reloadKey,
      ]),
    [filters, reloadKey],
  );

  useEffect(() => {
    const controller = new AbortController();
    getCommunityFeed(filters, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult({ requestKey, data, error: "" });
        }
      })
      .catch((error) => {
        if (controller.signal.aborted || canceled(error)) return;
        setResult({ requestKey, data: null, error: messageFor(error) });
      });
    return () => controller.abort();
  }, [filters, requestKey]);

  const reload = useCallback(() => setReloadKey((value) => value + 1), []);
  const updatePost = useCallback((postId, patch) => {
    setResult((current) => {
      if (!current.data) return current;
      return {
        ...current,
        data: {
          ...current.data,
          items: current.data.items.map((post) =>
            post.id === postId ? { ...post, ...patch } : post,
          ),
        },
      };
    });
  }, []);
  const removePost = useCallback((postId) => {
    setResult((current) => {
      if (!current.data) return current;
      return {
        ...current,
        data: {
          ...current.data,
          items: current.data.items.filter((post) => post.id !== postId),
          pagination: {
            ...current.data.pagination,
            count: Math.max(0, Number(current.data.pagination.count || 0) - 1),
          },
        },
      };
    });
  }, []);

  const isCurrent = result.requestKey === requestKey;
  return {
    data: isCurrent ? result.data : null,
    loading: !isCurrent,
    error: isCurrent ? result.error : "",
    reload,
    updatePost,
    removePost,
  };
}
