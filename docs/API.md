# Steamn't API

All endpoints use the `/api/` prefix. JSON is used unless a request contains media, in which case use `multipart/form-data`. Protected endpoints require `Authorization: Bearer <access token>`. Access tokens last 15 minutes and refresh tokens last 7 days. A password or account-security change invalidates tokens issued earlier.

List endpoints use bounded pagination where the response exposes pagination data. User-owned resources are always filtered server-side; identifiers in a payload never transfer ownership.

## Authentication and accounts

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/register/` | Public | Create an account and return access/refresh tokens |
| POST | `/auth/token/` | Public | Sign in with email and password |
| POST | `/auth/token/refresh/` | Public | Exchange a valid refresh token |
| GET, PATCH | `/profile/` | User | Read or update the current profile and privacy preferences |
| GET | `/users/{id}/` | Public | Privacy-filtered public profile |
| GET, POST, DELETE | `/users/{id}/social/` | User | Read relationship state, follow, or unfollow |
| POST | `/settings/password/` | User | Change password after current-password verification |
| GET, POST | `/settings/wallet/` | User | Demo wallet balance/history or bounded demo top-up |
| POST | `/settings/delete-account/` | User | Permanently delete account and associated data after username/password/DELETE confirmation |

## Catalog, DLC, and bundles

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/games/` | Public, optional auth | Search/filter/order/paginate games; optional ownership state |
| GET | `/games/{id}/` | Public, optional auth | Game details, screenshots, aggregate rating, ownership |
| GET | `/games/featured/` | Public | Featured home carousel |
| GET | `/genres/` | Public | Catalog genres |
| GET | `/games/{id}/dlc/`, `/dlc/{id}/` | Public | DLC list and detail |
| GET | `/bundles/`, `/bundles/{id}/` | Public | Bundle list and detail |

## Cart, checkout, orders, and library

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/cart/` | Current cart with game and DLC items |
| POST | `/cart/items/`, `/cart/dlc-items/` | Add an unowned item |
| DELETE | `/cart/items/{gameId}/`, `/cart/dlc-items/{dlcId}/` | Remove an item |
| POST | `/orders/checkout/` | Transactional cart checkout |
| POST | `/orders/bundles/{bundleId}/checkout/` | Transactional bundle checkout |
| GET | `/orders/`, `/orders/{id}/` | Paginated history and owner-only receipt |
| GET | `/library/` | Permanent game ownership |
| PATCH | `/library/items/{id}/` | Toggle Library Favorite |
| GET, POST | `/library/collections/` | List or create owner collections |
| GET, PATCH, DELETE | `/library/collections/{id}/` | Manage an owner collection |

Checkout records immutable item prices, removes purchased games from Wishlist, and uses database transactions to prevent duplicate ownership. Wishlist and Library Favorite are separate concepts.

## Wishlist, reviews, and community

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/wishlist/` | User | Unowned Wishlist items |
| POST | `/wishlist/items/` | User | Add an unowned game |
| DELETE | `/wishlist/items/{gameId}/` | User | Remove a game |
| GET, POST | `/games/{gameId}/reviews/` | Public read; owner write | Paginated reviews or purchase-gated create |
| PATCH, DELETE | `/games/{gameId}/reviews/{reviewId}/` | Author | Edit or delete a review |
| GET | `/reviews/my/` | User | Current user's reviews |
| GET, POST | `/community/posts/` | Public read; user write | Filtered community feed or create a post |
| GET, PATCH, DELETE | `/community/posts/{id}/` | Public read; author write | Stable post detail and owner lifecycle |
| POST | `/library/posts/{id}/reaction/` | User | Idempotent reaction toggle |
| GET, POST | `/library/posts/{id}/comments/` | Public read; user write | Paginated comment list and create |

Community list filters include `scope`, `kind`, `game`, `search`, `ordering`, `page`, and bounded `page_size`. Uploaded post/review media is validated and deleted with its owning record.

## Friends, chat, and notifications

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/friends/` | Friend and request overview |
| GET | `/friends/search/` | User search with relationship state |
| POST | `/friends/requests/` | Create an idempotent request |
| POST | `/friends/requests/{id}/accept/`, `/reject/`, `/cancel/` | Request lifecycle |
| DELETE | `/friends/{userId}/` | Remove a friendship |
| GET, POST | `/chat/conversations/` | Paginated list or create a one-to-one conversation |
| GET | `/chat/conversations/{id}/` | Participant-only conversation detail |
| GET, POST | `/chat/conversations/{id}/messages/` | Paginated history or text/media send |
| POST | `/chat/conversations/{id}/read/` | Mark incoming messages read |
| GET | `/chat/messages/{id}/attachment/` | Participant-only attachment stream |
| GET | `/notifications/` | Latest notifications and unread count |
| POST | `/notifications/{id}/read/`, `/notifications/read-all/` | Read state |

Chat attachment types are allowlisted by message kind, limited to 10 MB, and served only to participants. Blocking either direction prevents new messages. Notifications honor saved event preferences and contain internal deep-link paths.

## Errors and health

Validation errors use HTTP 400 with field messages. Authentication failures use 401, permission failures 403, missing or inaccessible owner-scoped objects 404, and ownership/duplicate conflicts use the endpoint's documented 400/409 response. The UI converts these into user-facing loading, error, retry, and empty states.

`GET /api/health/` returns `{ "status": "ok" }` when Django is running.


## Release additions (17 September 2026)

- `POST /auth/password-reset/`: `{email}`. Same 200 response for known/unknown email; 5 requests/hour per anonymous source. Local mail is logged, SMTP requires configuration.
- `POST /auth/password-reset/confirm/`: `{uid, token, password}`. Token expires after one hour and becomes invalid after use; previous sessions are revoked.
- `GET /store/home/`: actual recent/budget/free/popular/recommendation shelves, genres and available bundles. Optional authentication adds ownership and library-based recommendations.
- `GET /users/{id}/content/?section=games|wishlist|reviews|friends|activity|discussions|screenshots|videos|guides|news&page=1&search=&ordering=latest|oldest|title`: 12-item pages (`count,next,previous,results`). Private sections return 403; unknown sections return 400.
- `GET /users/{id}/social/` includes following, friend_status, relationship_id, request_direction, blocked and can_message. Pending direction is incoming/outgoing.
- `GET /blocks/`: current user's blocked identities. `POST/DELETE /users/{id}/block/` blocks/unblocks. Blocking removes mutual friendship and follows and prevents new chat/friend/follow actions.
- `GET /friends/` additionally returns `activity`: up to ten published posts from accepted friends whose activity privacy is public.
- `GET /chat/conversations/{id}/` includes muted, blocked, can_message. `PATCH` accepts `{muted: boolean}`. `DELETE` sets the requesting participant's history-clear timestamp; the other participant retains their history.
- `GET /chat/conversations/{id}/messages/?before_id={id}&kind=image|file|voice`: bounded message/media history. Message payload exposes `has_attachment`, never a public storage URL.
- `GET /chat/messages/{id}/attachment/`: participant-only binary response, private/no-store cache policy and nosniff. Cleared messages cannot be downloaded by the participant who cleared them.
- `POST /chat/conversations/{id}/report/`: `{reason}` (10–1000 characters), creates admin-visible moderation report. Only participants may submit reports.
- `PATCH/DELETE /library/posts/{postId}/comments/{commentId}/`: author-only comment mutation. Cross-user/cross-post identifiers return 404.
- `GET /settings/wallet/?page=1`: `{balance,transactions,count,next,previous}`; 20 transactions per page, balance includes all entries. `POST` accepts `{amount,request_id}` with amount 1.00–500.00. Repeating the same key/amount is idempotent; changing the amount with a reused key returns 409.
- `POST /orders/checkout/`: optional `{payment_method: "demo"|"wallet"}`. Wallet debit and order ownership commit atomically. Demo records matching credit/debit; no real payment happens.
- `POST /orders/{id}/refund/`: refunds an owner's completed order within 14 days, credits wallet, removes that order's game/DLC ownership, preserves receipt items with refunded status. Repeat request is idempotent. Separate owned DLC must be refunded before its base game.
- Bundle list/detail `purchase_price` excludes already owned contents and equals the checkout quote; `is_owned` indicates complete ownership.
- `GET /notifications/?page=1`: 20 items with count,next,previous,unread_count. Existing read/read-all endpoints remain owner-scoped.

Account deletion cascades through demo orders, wallet, library, social relations, published content and conversations; corresponding profile/chat/post/review files are removed after transaction commit. Conversation deletion affects both participants. This is explicitly disclosed in UI and Privacy Policy.

Conversation overview and comments use bounded page-number pagination while preserving their existing `items` collection field.
