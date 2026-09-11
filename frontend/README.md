# Steamn't frontend

The Steamn't client is a React 19 single-page application built with Vite 8.
It provides the public storefront and the authenticated cart, checkout, library,
profile, Wishlist, review, and community experiences.

The canonical project setup, Docker workflow, environment reference, testing
commands, and team Git workflow are documented in the
[root README](../README.md). The backend contract is documented in
[docs/API.md](../docs/API.md).

## Local commands

```bash
npm ci
npm run dev
```

Additional checks:

```bash
npm run lint
npm run build
npm run preview
```

The browser uses `/api` by default. Local Vite proxies `/api` and `/media` to
`http://127.0.0.1:8000`; Docker Compose supplies `http://backend:8000` through
`VITE_PROXY_TARGET`. See [`.env.example`](.env.example) before configuring a
separate API origin.
