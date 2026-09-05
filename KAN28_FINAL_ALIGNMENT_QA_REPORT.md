# KAN-28 — final alignment QA report

## PASS

- Backend: **144/144 tests**, SQLite, отдельный sandbox-only MD5 test hasher; production settings не менялись.
- Django `check`: PASS, 0 issues.
- `makemigrations --check --dry-run`: PASS, No changes detected.
- Supplemental frontend: 55 JS/JSX parsed, 24 CSS parsed, 69 esbuild inputs bundled.
- Browser changed-scope matrix: **66/66 unique cases PASS after two isolated infrastructure retries**, widths 1440/1024/820/700/390/320.
- Explicit browser checks: shared toolbar, Wishlist grid/list, Library grid/list/Favorites/search, exact initial Library alignment, responsive no-overflow and real sticky movement for Catalog/Wishlist/Library above their stacking breakpoints.
- ZIP: CRC, safe relative paths, extraction and byte hashes checked.

## Honest limits

- Sandbox does not contain the project-installed ESLint/Vite executables, so `npm run lint` and production `npm run build` are still mandatory locally.
- Browser smoke renders the actual React source and live Django API, but substitutes offline QA router/Axios adapters and is not production Vite E2E.
- Two first-pass Chromium cases ended without a report (`1440 Wishlist`) / timed out (`1024 Catalog`); both passed when immediately rerun alone. They are recorded as infrastructure retries, not hidden.
- No Git commit, push, PR or board status change was made.

See `KAN28_FINAL_ALIGNMENT_BROWSER_SUMMARY.json` and `KAN28_FINAL_ALIGNMENT_README_RU.md`.
