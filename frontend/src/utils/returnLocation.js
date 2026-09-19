const isSafePathname = (value) =>
  typeof value === "string" && value.startsWith("/") && !value.startsWith("//");

const normalizeSuffix = (value, prefix) => {
  if (typeof value !== "string" || !value || value === prefix) return "";
  return value.startsWith(prefix) ? value : `${prefix}${value}`;
};

export const createReturnLocation = (location) => ({
  pathname: isSafePathname(location?.pathname) ? location.pathname : "/",
  search: normalizeSuffix(location?.search, "?"),
  hash: normalizeSuffix(location?.hash, "#"),
});

export const resolveReturnLocation = (value, fallback = "/profile") => {
  if (typeof value === "string") {
    if (!isSafePathname(value)) return fallback;
    const parsed = new URL(value, "https://steamnt.local");
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }

  if (!isSafePathname(value?.pathname)) return fallback;
  return `${value.pathname}${normalizeSuffix(value.search, "?")}${normalizeSuffix(value.hash, "#")}`;
};
