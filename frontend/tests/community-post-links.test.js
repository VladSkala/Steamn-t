import test from "node:test";
import assert from "node:assert/strict";

import {
  communityPostPath,
  postIdFromLegacyHash,
} from "../src/utils/communityPostLinks.js";

test("community publication links use one canonical route", () => {
  assert.equal(communityPostPath(42), "/community/posts/42");
  assert.equal(
    communityPostPath(42, { comments: true }),
    "/community/posts/42#comments",
  );
});

test("legacy post hashes are recognized without accepting malformed ids", () => {
  assert.equal(postIdFromLegacyHash("#post-42"), 42);
  assert.equal(postIdFromLegacyHash("#post-nope"), null);
  assert.equal(postIdFromLegacyHash("#comments"), null);
  assert.equal(communityPostPath("external"), "/community");
});
