# Steamn't

Steamn't is an educational full-stack game storefront built as a team project.
It combines a public catalog with authenticated cart, checkout, library,
Wishlist, profile, review, and community experiences. Checkout is a demo flow:
no real payment is processed and no commercial game download is provided.

## Features

- Public catalog with search, genre and price filters, ordering, pagination,
  featured games, screenshots, and aggregate review ratings.
- Email/password registration and login with JWT access and refresh tokens.
- Private profile editing, avatar upload, and data-backed activity counters.
- Owner-scoped cart and transactional checkout with immutable purchase prices.
- Personal library with favorites, custom collections, news, and community feed.
- Personal Wishlist with duplicate and already-owned game protection.
- Purchase-gated reviews with 1-5 ratings and up to four images.
- Review management through game pages and the private My Reviews page.
- Community post likes and comments backed by persistent data.
- Responsive loading, error, empty, and retry states across the main UI.
- Docker Compose startup for PostgreSQL, Django, and Vite.

## Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19.2.8, React Router 7.18.2, Axios 1.13.2 |
| Build and styles | Vite 8.2.0, Tailwind CSS 4.3.3 |
| Backend | Python 3.13, Django 6.1, Django REST Framework 3.18.0 |
| Authentication | Simple JWT 5.5.1 |
| Database | PostgreSQL 16 with psycopg 3.3.4 |
| Media | Pillow 12.3.0 and a persistent Docker media volume |
| Infrastructure | Docker and Docker Compose |
| Tests | Django/DRF API tests and frontend lint/build checks |

## Quick start with Docker

### Prerequisites

- Git
- Docker Desktop or Docker Engine with Docker Compose v2

Clone the repository and create the local environment file:

```bash
git clone https://github.com/VladSkala/Steamn-t.git
cd Steamn-t
cp .env.example .env
```

Replace the placeholder values in `.env`, especially
`DJANGO_SECRET_KEY` and `POSTGRES_PASSWORD`. Never commit `.env`.

Validate and start the complete stack:

```bash
docker compose config --quiet
docker compose up --build -d
docker compose ps
```

The backend container waits for PostgreSQL, applies migrations, and then starts
Django. The frontend waits for a healthy backend before starting Vite.

| Service | Local URL |
| --- | --- |
| Frontend | <http://127.0.0.1:5173> |
| Backend API | <http://127.0.0.1:8000/api/> |
| Health check | <http://127.0.0.1:8000/api/health/> |
| Django admin | <http://127.0.0.1:8000/admin/> |

Inspect logs when a service is not healthy:

```bash
docker compose logs --no-color --tail=200 db backend frontend
```

Stop the stack without deleting data:

```bash
docker compose down
```

A full reset deletes both PostgreSQL and uploaded media volumes:

```bash
docker compose down -v --remove-orphans
```

> `down -v` permanently removes the Docker database and media data. Use it only
> when a clean environment is intended.

## Demo catalog and account

Populate the bundled offline catalog without modifying any user account:

```bash
docker compose exec backend python manage.py seed_store_demo
```

The command creates 12 fictional games across 8 genres, marks the first 6 as
featured, and stores one cover plus 3 screenshots for each game.

To create a separate sample account as well, run:

```bash
docker compose exec backend python manage.py seed_store_demo --with-demo-user
```

The sample account uses:

- Username: `steamnt_demo`
- Login email: `steamnt-demo@example.invalid`
- Password: generated once and printed by the command

There is intentionally no hard-coded demo password. Save the generated password
when the account is first created. Re-running the command never resets an
existing account or password and never populates a real user's account.

For a non-Docker backend, run the same commands from `backend/` with the Python
virtual environment activated.

## Environment variables

The root `.env.example` is the canonical template for Django, PostgreSQL, and
Docker host ports.

| Variable | Required | Default/example purpose |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` | Yes | Local Django cryptographic secret |
| `DJANGO_DEBUG` | No | `True` in local development |
| `DJANGO_ALLOWED_HOSTS` | No | Comma-separated Django hosts |
| `POSTGRES_DB` | Yes | PostgreSQL database name |
| `POSTGRES_USER` | Yes | PostgreSQL user |
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password |
| `POSTGRES_HOST` | No | `127.0.0.1` for host-run Django |
| `POSTGRES_PORT` | No | PostgreSQL host port, normally `5432` |
| `POSTGRES_CONN_MAX_AGE` | No | Connection lifetime, `0` for development |
| `BACKEND_PORT` | No | Published Django port, default `8000` |
| `FRONTEND_PORT` | No | Published Vite port, default `5173` |

Docker Compose overrides the backend's database host to `db` and its internal
PostgreSQL port to `5432`. This preserves the same `.env` for both host-run and
containerized development.

Frontend-only variables are documented in `frontend/.env.example`:

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Browser-visible API base when Django is on another origin |
| `VITE_PROXY_TARGET` | Vite's server-side proxy target |

By default the browser uses `/api`, local Vite proxies to
`http://127.0.0.1:8000`, and Docker Compose proxies to
`http://backend:8000`.

## Local development without the full Docker stack

### Backend

Python 3.13 and PostgreSQL 16 are the reference versions. PostgreSQL can still
run in Docker while Django runs on the host:

```bash
cp .env.example .env
docker compose up -d db

python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt

cd backend
python manage.py migrate
python manage.py runserver
```

Keep `POSTGRES_HOST=127.0.0.1` in `.env` for this workflow.

### Frontend

In a second terminal:

```bash
cd frontend
npm ci
npm run dev
```

The frontend is then available at <http://127.0.0.1:5173> and proxies `/api`
and `/media` to the local Django server.

## Verification

Run backend checks and the complete test suite in Docker:

```bash
docker compose exec backend python manage.py check
docker compose exec backend python manage.py migrate --check
docker compose exec backend python manage.py test
```

The current backend suite contains 205 tests.

Run frontend validation:

```bash
docker compose exec frontend npm run lint
docker compose exec frontend npm run build
```

Equivalent host commands can be run from `backend/` and `frontend/` after their
local dependencies are installed.

## API overview

The API base is `/api/`. Protected endpoints require this header:

```http
Authorization: Bearer <access-token>
```

Access tokens expire after 15 minutes; refresh tokens expire after 7 days.

| Area | Main endpoints |
| --- | --- |
| Health | `GET /api/health/` |
| Authentication | `POST /api/auth/register/`, `POST /api/auth/token/` |
| Profile | `GET/PATCH /api/profile/` |
| Catalog | `GET /api/games/`, `GET /api/games/{id}/`, `GET /api/genres/` |
| Cart and checkout | `GET /api/cart/`, `POST /api/orders/checkout/` |
| Library | `GET /api/library/`, collections, favorites, and library feed |
| Wishlist | `GET/POST/DELETE /api/wishlist/...` |
| Reviews | Public reads; owned-game writes at `/api/games/{id}/reviews/` |
| Community | Library posts, likes, and comments under `/api/library/...` |

See [docs/API.md](docs/API.md) for the complete method, authentication, payload,
filter, pagination, and ownership reference. Review image lifecycle details are
also available in
[backend/community/REVIEWS_API.md](backend/community/REVIEWS_API.md).

## Project structure

```text
.
├── backend/
│   ├── config/       # Django project settings and root URLs
│   ├── core/         # Shared models, validators, health, API tests
│   ├── users/        # Authentication and current-user profile
│   ├── games/        # Catalog, genres, screenshots, filters, demo seed
│   ├── store/        # Cart, checkout, orders, library, collections
│   └── community/    # Wishlist, reviews, feed, reactions, comments
├── frontend/
│   ├── src/api/      # Axios API boundary
│   ├── src/components/
│   ├── src/context/  # Authentication, cart, and Wishlist state
│   ├── src/hooks/
│   ├── src/pages/
│   └── src/static/styles/
├── docs/API.md
├── docker-compose.yml
└── .env.example
```

## Team Git workflow

The integration branch is `develop`. Every card is implemented in its own
feature branch created from the latest `develop`:

```bash
git status --short
git switch develop
git pull --ff-only origin develop
git switch -c feature/KAN-XX-short-description
```

Development rules:

1. Keep one card in one branch; do not mix unrelated work.
2. Preserve existing architecture and verify the actual code before editing.
3. Do not create empty branches, commits, or pull requests.
4. Run relevant backend tests and frontend checks before committing.
5. Stage only the intended files and inspect the staged diff.
6. Push the feature branch and open the pull request into `develop`.
7. Complete review and fixes before merging.
8. Do not push feature work directly to `main`.

Typical verification and delivery commands:

```bash
git diff --check
git status --short
git add -- <explicit-files>
git diff --cached --check
git diff --cached --name-status
git commit -m "docs(KAN-XX): describe the change"
git push -u origin HEAD
```

Pull request direction:

```text
feature/KAN-XX-short-description -> develop
```

The stable release merge and version tag are handled separately after final
integration testing.
