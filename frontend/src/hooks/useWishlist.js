import { useContext } from "react";

import WishlistContextValue from "../context/WishlistContextValue";

export const useWishlist = () => {
  const context = useContext(WishlistContextValue);

  if (!context) {
    throw new Error("useWishlist must be used inside WishlistProvider");
  }

  return context;
};
