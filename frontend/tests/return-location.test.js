import test from "node:test";
import assert from "node:assert/strict";

import {
  createReturnLocation,
  resolveReturnLocation,
} from "../src/utils/returnLocation.js";

test("return location preserves pathname, query, and hash", () => {
  const location = createReturnLocation({
    pathname: "/catalog",
    search: "?genre=rpg&page=2",
    hash: "#reviews",
    key: "router-only-field",
  });
  assert.deepEqual(location, {
    pathname: "/catalog",
    search: "?genre=rpg&page=2",
    hash: "#reviews",
  });
  assert.equal(
    resolveReturnLocation(location),
    "/catalog?genre=rpg&page=2#reviews",
  );
});

test("registration and login fallback reject external redirects", () => {
  assert.equal(resolveReturnLocation("https://example.com"), "/profile");
  assert.equal(resolveReturnLocation("//example.com/path"), "/profile");
  assert.equal(resolveReturnLocation(null), "/profile");
});

test("legacy internal string state remains safely supported", () => {
  assert.equal(
    resolveReturnLocation("/wishlist?sort=latest#saved"),
    "/wishlist?sort=latest#saved",
  );
});
