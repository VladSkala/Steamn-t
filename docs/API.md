# Steamn't API reference

This document describes the HTTP API implemented by the current Django and
Django REST Framework code. The base path is `/api/`.

## Conventions

- JSON is used for normal requests and responses.
- Review and avatar uploads use `multipart/form-data`.
- Protected endpoints require `Authorization: Bearer <access-token>`.
- Access tokens live for 15 minutes; refresh tokens live for 7 days.
- Identifiers are integers unless noted otherwise.
- Collection endpoints use trailing slashes.
- `400` reports validation or domain errors, `401` reports missing or invalid
  authentication, `403` reports an authenticated ownership violation, and
  `404` is used when a resource is absent or outside the caller's scope.
- `DELETE` operations normally return `204 No Content`.

## Authentication

### Register

```http
POST /api/auth/register/
Content-Type: application/json
```

```json
{
  "username": "player-one",
  "email": "player@example.com",
  "first_name": "Player",
  "last_name": "One",
  "password": "a-strong-project-password",
  "password_confirm": "a-strong-project-password"
}
```

`first_name` and `last_name` are optional. A successful request returns the user
profile plus `access` and `refresh` JWT strings.

### Login

Login uses email, not username:

```http
POST /api/auth/token/
Content-Type: application/json
```

```json
{
  "email": "player@example.com",
  "password": "a-strong-project-password"
}
```

The response contains `access`, `refresh`, and `user`.

### Refresh

```http
POST /api/auth/token/refresh/
Content-Type: application/json
```

```json
{
  "refresh": "<refresh-token>"
}
```

### Current profile

```text
GET   /api/profile/
PATCH /api/profile/
```

Both methods require authentication. Writable profile fields are `username`,
`email`, `first_name`, `last_name`, and `avatar`. The `id`, `display_name`,
`created_at`, and `stats` fields are read-only. Use multipart data to upload or
clear an avatar.

## Endpoint index

### System and catalog

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/health/` | Public | Liveness response: `{"status":"ok"}` |
| `GET` | `/api/games/` | Public | Paginated catalog |
| `GET` | `/api/games/featured/` | Public | Up to 6 featured games |
| `GET` | `/api/games/{game_id}/` | Public | Details and rating summary |
| `GET` | `/api/genres/` | Public | Unpaginated genre list |

Authenticated catalog requests also receive viewer-specific `is_owned` values.

Catalog query parameters:

| Parameter | Values |
| --- | --- |
| `search` | Case-insensitive title search |
| `genre` | Positive genre ID |
| `min_price` | Inclusive non-negative decimal |
| `max_price` | Inclusive non-negative decimal |
| `ordering` | `price`, `-price`, `title`, or `-title` |
| `page` | Positive page number |
| `page_size` | 1-50; default 12 |

`min_price` must not be greater than `max_price`.

### Cart, checkout, and library

Every endpoint in this table requires authentication and is scoped to the
current user.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/cart/` | Read or initialize the current cart |
| `POST` | `/api/cart/items/` | Add one game with `{"game_id": ID}` |
| `DELETE` | `/api/cart/items/{game_id}/` | Remove one game from the cart |
| `POST` | `/api/orders/checkout/` | Atomically purchase the current cart |
| `GET` | `/api/library/` | List completed purchases |
| `PATCH` | `/api/library/items/{item_id}/` | Set `is_favorite` |
| `GET` | `/api/library/collections/` | List personal collections |
| `POST` | `/api/library/collections/` | Create a personal collection |
| `GET` | `/api/library/collections/{collection_id}/` | Read one collection |
| `PUT` | `/api/library/collections/{collection_id}/` | Replace a collection |
| `PATCH` | `/api/library/collections/{collection_id}/` | Update fields |
| `DELETE` | `/api/library/collections/{collection_id}/` | Delete a collection |

Add-to-cart payload:

```json
{
  "game_id": 12
}
```

Checkout does not accept client-owned user, price, status, or item fields. Send
an empty object:

```json
{}
```

A successful checkout creates a completed order with immutable item-price
snapshots, grants the games to the current user's library, removes the purchased
games from the Wishlist, and clears only the purchased cart items in one database
transaction. The response is the newly created order; there is no separate order
history endpoint.

Collection payload:

```json
{
  "name": "Weekend picks",
  "game_ids": [2, 7, 11]
}
```

A collection can contain only games from the authenticated user's completed
purchases. Collection names are unique per user, case-insensitively.

### Wishlist

All Wishlist endpoints require authentication and are owner-scoped.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/wishlist/` | List the current user's unowned saved games |
| `POST` | `/api/wishlist/items/` | Add `{"game_id": ID}` |
| `DELETE` | `/api/wishlist/items/{game_id}/` | Remove a saved game |

Duplicate items and games already owned by the current user are rejected. A
successful checkout removes the purchased games from the Wishlist.

### Reviews and ratings

| Method | Endpoint | Access |
| --- | --- | --- |
| `GET` | `/api/games/{game_id}/reviews/` | Public |
| `POST` | `/api/games/{game_id}/reviews/` | Authenticated owner |
| `GET` | `/api/games/{game_id}/reviews/{review_id}/` | Public |
| `PUT` | `/api/games/{game_id}/reviews/{review_id}/` | Author |
| `PATCH` | `/api/games/{game_id}/reviews/{review_id}/` | Author |
| `DELETE` | `/api/games/{game_id}/reviews/{review_id}/` | Author |
| `GET` | `/api/reviews/my/` | Authenticated |

The public collection response includes reviews, the aggregate rating, the
rating distribution, and pagination data. `POST` creates a review for an owned
game. `/api/reviews/my/` lists only the authenticated user's reviews.

Review rules:

- The rating is an integer from 1 through 5.
- The body is required, trimmed, non-empty, and at most 4,000 characters.
- A user can create only one review per game.
- Creating a review requires a completed purchase of that game.
- A review can have up to four `jpg`, `jpeg`, `png`, or `webp` images.
- Each image is limited to 5 MB.
- Only the review author can update or delete it.

JSON review payload:

```json
{
  "rating": 5,
  "body": "A useful review based on the purchased game."
}
```

Multipart example:

```bash
curl -X POST "http://127.0.0.1:8000/api/games/12/reviews/" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "rating=5" \
  -F "body=A useful review." \
  -F "images=@/path/to/screenshot.webp"
```

When replacing images, send `replace_images`, repeat `keep_image_ids` for files
to retain, and repeat `images` for new uploads. See
[`backend/community/REVIEWS_API.md`](../backend/community/REVIEWS_API.md) for the
full image lifecycle contract.

Public game-review pagination uses:

```json
{
  "pagination": {
    "page": 1,
    "page_size": 10,
    "total_pages": 1,
    "next": null,
    "previous": null
  },
  "reviews": []
}
```

`/api/reviews/my/` uses standard DRF `count`, `next`, `previous`, and `results`
fields. Both endpoints accept `page` and `page_size`; the maximum page size is
50.

### Library experience and community

All endpoints below require authentication. Library game endpoints also require
a completed purchase by the current user.

| Method | Endpoint |
| --- | --- |
| `GET` | `/api/library/home/` |
| `GET` | `/api/library/feed/` |
| `GET` | `/api/library/games/{game_id}/` |
| `POST/PUT/PATCH` | `/api/library/games/{game_id}/review/` |
| `DELETE` | `/api/library/games/{game_id}/review/` |
| `POST` | `/api/library/games/{game_id}/wishlist/` |
| `POST` | `/api/library/posts/{post_id}/reaction/` |
| `GET/POST` | `/api/library/posts/{post_id}/comments/` |

The home endpoint returns library items, collections, news, and community cards.
The feed is searchable and filterable. The game endpoint returns the complete
owned-game experience. The remaining endpoints manage the current user's review,
Library UI wishlist state, likes, and comments. A comment payload is
`{"body": "..."}`.

Feed query parameters:

- `tab`: `recommended`, `following`, `mine`, or `library`.
- `kind`: `all`, `news`, `community`, `forum`, `screenshot`, `video`, or
  `guide`.
- `search`: searches title, body, game title, and author username.
- `ordering`: `popular` or `latest`.

The feed returns at most 50 published posts after filtering.

## Authentication example

```bash
curl -X POST "http://127.0.0.1:8000/api/auth/token/" \
  -H "Content-Type: application/json" \
  -d '{"email":"player@example.com","password":"your-password"}'
```

Use the returned access token for protected requests:

```bash
curl "http://127.0.0.1:8000/api/profile/" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

## Ownership and data-integrity guarantees

- Cart, library, collections, Wishlist, profile, and My Reviews are scoped from
  the authenticated user, never from a client-supplied user ID.
- A library item counts as owned only when both the item and completed order
  belong to the same user.
- Checkout calculates totals from server-side game prices and stores immutable
  purchase snapshots.
- Checkout writes and cleanup are atomic.
- Review mutations are author-only and review creation is purchase-gated.
- Public catalog and review reads expose no private user collections or carts.

## Media URLs

Django serves `/media/` in local debug mode. Vite proxies `/media` alongside
`/api`, so browser requests work through the frontend origin. Docker Compose
stores uploaded media in the persistent `media_data` volume.
