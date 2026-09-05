import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  addWishlistItem,
  deleteWishlistItem,
  getWishlist,
} from "../api/wishlist";
import { useAuth } from "../hooks/useAuth";
import WishlistContextValue from "./WishlistContextValue";

const EMPTY_WISHLIST_STATE = {
  ownerId: null,
  items: [],
  error: "",
  isLoading: false,
};

const EMPTY_PENDING_STATE = {
  ownerId: null,
  gameIds: [],
};

const EMPTY_ITEMS = [];

const isCanceledRequest = (requestError) =>
  requestError?.code === "ERR_CANCELED" ||
  requestError?.name === "CanceledError";

const getWishlistError = (requestError, fallback) => {
  const payload = requestError?.response?.data;
  const gameError = payload?.game_id;

  if (Array.isArray(gameError) && gameError.length > 0)
    return String(gameError[0]);
  if (typeof gameError === "string") return gameError;
  if (typeof payload?.detail === "string") return payload.detail;
  if (typeof payload?.non_field_errors?.[0] === "string") {
    return payload.non_field_errors[0];
  }
  if (requestError instanceof TypeError && requestError.message) {
    return requestError.message;
  }

  return fallback;
};

function WishlistProvider({ children }) {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const userId = isAuthenticated && user?.id != null ? String(user.id) : null;
  const [wishlistState, setWishlistState] = useState(EMPTY_WISHLIST_STATE);
  const [pendingState, setPendingState] = useState(EMPTY_PENDING_STATE);
  const requestGeneration = useRef(0);

  useEffect(() => {
    requestGeneration.current += 1;
    const generation = requestGeneration.current;

    if (authLoading || !userId) return undefined;

    const controller = new AbortController();

    getWishlist({ signal: controller.signal })
      .then((items) => {
        if (generation !== requestGeneration.current) return;
        setWishlistState({
          ownerId: userId,
          items,
          error: "",
          isLoading: false,
        });
      })
      .catch((requestError) => {
        if (
          isCanceledRequest(requestError) ||
          generation !== requestGeneration.current
        ) {
          return;
        }

        setWishlistState({
          ownerId: userId,
          items: [],
          error: getWishlistError(
            requestError,
            "Unable to load your Wishlist right now.",
          ),
          isLoading: false,
        });
      });

    return () => controller.abort();
  }, [authLoading, userId]);

  const ownsWishlistState = Boolean(userId && wishlistState.ownerId === userId);
  const ownsPendingState = Boolean(userId && pendingState.ownerId === userId);
  const visibleItems = ownsWishlistState ? wishlistState.items : EMPTY_ITEMS;
  const visiblePendingIds = ownsPendingState
    ? pendingState.gameIds
    : EMPTY_ITEMS;

  const setGamePending = useCallback(
    (gameId, pending) => {
      const normalizedGameId = String(gameId);

      setPendingState((currentState) => {
        const currentIds =
          currentState.ownerId === userId ? currentState.gameIds : [];
        const nextIds = pending
          ? [...new Set([...currentIds, normalizedGameId])]
          : currentIds.filter((currentId) => currentId !== normalizedGameId);

        return { ownerId: userId, gameIds: nextIds };
      });
    },
    [userId],
  );

  const refreshWishlist = useCallback(async () => {
    if (!userId) return [];

    const generation = requestGeneration.current;
    setWishlistState((currentState) => ({
      ownerId: userId,
      items: currentState.ownerId === userId ? currentState.items : [],
      error: "",
      isLoading: true,
    }));

    try {
      const items = await getWishlist();
      if (generation === requestGeneration.current) {
        setWishlistState({
          ownerId: userId,
          items,
          error: "",
          isLoading: false,
        });
      }
      return items;
    } catch (requestError) {
      if (generation === requestGeneration.current) {
        setWishlistState((currentState) => ({
          ownerId: userId,
          items: currentState.ownerId === userId ? currentState.items : [],
          error: getWishlistError(
            requestError,
            "Unable to refresh your Wishlist right now.",
          ),
          isLoading: false,
        }));
      }
      throw requestError;
    }
  }, [userId]);

  const addToWishlist = useCallback(
    async (gameId) => {
      if (!userId) throw new Error("Sign in to add games to your Wishlist.");

      const generation = requestGeneration.current;
      const normalizedGameId = String(gameId);
      setGamePending(normalizedGameId, true);

      try {
        const wishlistItem = await addWishlistItem(gameId);
        if (generation === requestGeneration.current) {
          setWishlistState((currentState) => {
            const currentItems =
              currentState.ownerId === userId ? currentState.items : [];
            const nextItems = [
              wishlistItem,
              ...currentItems.filter(
                (item) => String(item.game.id) !== normalizedGameId,
              ),
            ];

            return {
              ownerId: userId,
              items: nextItems,
              error: "",
              isLoading: false,
            };
          });
        }
        return wishlistItem;
      } finally {
        if (generation === requestGeneration.current) {
          setGamePending(normalizedGameId, false);
        }
      }
    },
    [setGamePending, userId],
  );

  const removeFromWishlist = useCallback(
    async (gameId) => {
      if (!userId) throw new Error("Sign in to update your Wishlist.");

      const generation = requestGeneration.current;
      const normalizedGameId = String(gameId);
      setGamePending(normalizedGameId, true);

      try {
        await deleteWishlistItem(gameId);
        if (generation === requestGeneration.current) {
          setWishlistState((currentState) => ({
            ownerId: userId,
            items:
              currentState.ownerId === userId
                ? currentState.items.filter(
                    (item) => String(item.game.id) !== normalizedGameId,
                  )
                : [],
            error: "",
            isLoading: false,
          }));
        }
      } finally {
        if (generation === requestGeneration.current) {
          setGamePending(normalizedGameId, false);
        }
      }
    },
    [setGamePending, userId],
  );

  const removePurchasedGames = useCallback(
    (gameIds) => {
      if (!userId || !Array.isArray(gameIds)) return;

      const purchasedIds = new Set(
        gameIds
          .filter((gameId) => gameId != null)
          .map((gameId) => String(gameId)),
      );

      if (purchasedIds.size === 0) return;

      setWishlistState((currentState) => ({
        ownerId: userId,
        items:
          currentState.ownerId === userId
            ? currentState.items.filter(
                (item) => !purchasedIds.has(String(item.game.id)),
              )
            : [],
        error: "",
        isLoading: false,
      }));

      setPendingState((currentState) => ({
        ownerId: userId,
        gameIds:
          currentState.ownerId === userId
            ? currentState.gameIds.filter(
                (gameId) => !purchasedIds.has(String(gameId)),
              )
            : [],
      }));
    },
    [userId],
  );

  const isWishlisted = useCallback(
    (gameId) =>
      visibleItems.some((item) => String(item.game.id) === String(gameId)),
    [visibleItems],
  );

  const isPending = useCallback(
    (gameId) => visiblePendingIds.includes(String(gameId)),
    [visiblePendingIds],
  );

  const toggleWishlist = useCallback(
    (gameId) =>
      isWishlisted(gameId) ? removeFromWishlist(gameId) : addToWishlist(gameId),
    [addToWishlist, isWishlisted, removeFromWishlist],
  );

  const value = useMemo(
    () => ({
      items: visibleItems,
      itemCount: visibleItems.length,
      isLoading:
        Boolean(userId) && (!ownsWishlistState || wishlistState.isLoading),
      error: ownsWishlistState ? wishlistState.error : "",
      addToWishlist,
      removeFromWishlist,
      removePurchasedGames,
      toggleWishlist,
      refreshWishlist,
      isWishlisted,
      isPending,
    }),
    [
      addToWishlist,
      isPending,
      isWishlisted,
      ownsWishlistState,
      refreshWishlist,
      removePurchasedGames,
      removeFromWishlist,
      toggleWishlist,
      userId,
      visibleItems,
      wishlistState.error,
      wishlistState.isLoading,
    ],
  );

  return (
    <WishlistContextValue.Provider value={value}>
      {children}
    </WishlistContextValue.Provider>
  );
}

export default WishlistProvider;
