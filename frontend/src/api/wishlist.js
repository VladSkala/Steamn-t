import api from "./client";

const ensureWishlistItem = (value) => {
  if (
    !value ||
    typeof value !== "object" ||
    !value.game ||
    value.game.id == null
  ) {
    throw new TypeError("The Wishlist API returned an invalid item.");
  }

  return value;
};

export const getWishlist = async (options = {}) => {
  const response = await api.get("/wishlist/", options);
  const payload = response.data;

  if (!payload || !Array.isArray(payload.items)) {
    throw new TypeError("The Wishlist API returned an invalid response.");
  }

  return payload.items.map(ensureWishlistItem);
};

export const addWishlistItem = async (gameId) => {
  const response = await api.post("/wishlist/items/", { game_id: gameId });
  return ensureWishlistItem(response.data);
};

export const deleteWishlistItem = async (gameId) => {
  await api.delete(`/wishlist/items/${gameId}/`);
};
