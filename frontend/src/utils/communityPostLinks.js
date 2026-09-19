export const communityPostPath = (postId, { comments = false } = {}) => {
  const normalizedId = Number(postId);
  if (!Number.isInteger(normalizedId) || normalizedId < 1) return "/community";
  return `/community/posts/${normalizedId}${comments ? "#comments" : ""}`;
};

export const postIdFromLegacyHash = (hash = "") => {
  const match = /^#post-(\d+)$/.exec(hash);
  if (!match) return null;
  const postId = Number(match[1]);
  return Number.isSafeInteger(postId) && postId > 0 ? postId : null;
};
