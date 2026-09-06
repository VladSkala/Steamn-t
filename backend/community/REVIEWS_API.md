# Reviews and ratings API

KAN-30 extends the existing `GameReview` model and keeps the Library review endpoint backward compatible.

- `GET /api/games/{game_id}/reviews/` is public and returns `average_rating`, `review_count`, a 1–5 `rating_distribution`, `viewer_review`, pagination metadata and `reviews`.
- `POST /api/games/{game_id}/reviews/` requires authentication, a completed purchase, rating 1–5, and a non-empty body. Multipart requests may include up to four images.
- `GET /api/games/{game_id}/reviews/{review_id}/` is public.
- `PUT`, `PATCH`, and `DELETE /api/games/{game_id}/reviews/{review_id}/` are author-only.

Collection query parameters are `page` and `page_size`; the default is 10 and maximum is 50. Image updates reuse `replace_images`, repeated `keep_image_ids`, and repeated `images` fields.

`GET /api/games/{game_id}/` now also includes two-decimal `average_rating` (or `null`) and integer `review_count`.

The existing `/api/library/games/{game_id}/review/` endpoint remains available to the current Library UI and uses the shared validation and image lifecycle.
