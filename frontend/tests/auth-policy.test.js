import test from "node:test";
import assert from "node:assert/strict";

import {
  OPTIONAL_AUTH_MODE,
  getUnauthorizedAction,
  shouldAttachAccessToken,
  shouldSkipAuth,
} from "../src/api/authPolicy.js";

test("valid and missing access tokens use predictable request policy", () => {
  const request = { url: "/games/", authMode: OPTIONAL_AUTH_MODE };
  assert.equal(shouldAttachAccessToken(request, "valid-access"), true);
  assert.equal(shouldAttachAccessToken(request, ""), false);
  assert.equal(shouldSkipAuth({ url: "/auth/token/" }), true);
});

test("an expired optional request refreshes when a refresh token exists", () => {
  assert.equal(
    getUnauthorizedAction({
      status: 401,
      config: { url: "/games/", authMode: OPTIONAL_AUTH_MODE },
      hasRefresh: true,
    }),
    "refresh",
  );
});

test("an expired optional request retries anonymously without refresh", () => {
  assert.equal(
    getUnauthorizedAction({
      status: 401,
      config: { url: "/community/posts/", authMode: OPTIONAL_AUTH_MODE },
      hasRefresh: false,
    }),
    "retry-anonymous",
  );
});

test("a protected request never falls back to anonymous access", () => {
  assert.equal(
    getUnauthorizedAction({
      status: 401,
      config: { url: "/library/" },
      hasRefresh: false,
    }),
    "clear-and-reject",
  );
});

test("retry markers prevent refresh and anonymous retry loops", () => {
  for (const config of [
    { url: "/games/", authMode: OPTIONAL_AUTH_MODE, _retry: true },
    {
      url: "/games/",
      authMode: OPTIONAL_AUTH_MODE,
      _anonymousRetry: true,
    },
  ]) {
    assert.equal(
      getUnauthorizedAction({ status: 401, config, hasRefresh: true }),
      "reject",
    );
  }
});
