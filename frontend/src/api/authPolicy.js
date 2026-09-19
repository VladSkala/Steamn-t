export const OPTIONAL_AUTH_MODE = "optional";

const publicAuthPaths = [
  "/auth/register/",
  "/auth/token/",
  "/auth/token/refresh/",
];

export const isPublicAuthRequest = (url = "") =>
  publicAuthPaths.some((path) => url.includes(path));

export const shouldSkipAuth = (config = {}) =>
  config.skipAuth === true || isPublicAuthRequest(config.url);

export const shouldAttachAccessToken = (config, accessToken) =>
  Boolean(accessToken) && !shouldSkipAuth(config);

export const getUnauthorizedAction = ({ status, config, hasRefresh }) => {
  if (
    status !== 401 ||
    !config ||
    config._anonymousRetry ||
    shouldSkipAuth(config)
  ) {
    return "reject";
  }
  if (config._retry) {
    return "reject";
  }
  if (hasRefresh) return "refresh";
  if (config.authMode === OPTIONAL_AUTH_MODE) return "retry-anonymous";
  return "clear-and-reject";
};
