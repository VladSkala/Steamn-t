# Steamn’t demo catalog

12 fictional games; original generated concept illustrations, not screenshots of shipped games.
Prices, dates, requirements and disk sizes are illustrative. Downloads are intentionally blank.
No publisher artwork, network image URLs, fake ratings, discounts, reviews or friends are used.

Run `python manage.py seed_store_demo` from backend after migrations to populate only the catalog.
`--with-demo-user` additionally creates a NEW separate account, never populating an existing one.
Repeated runs leave existing games, passwords and accounts unchanged. No delete/reset operation is included.
To edit the demo titles or artwork, use Django admin. Existing QA/user games are not removed.

Artwork in assets/ was generated specifically for this teaching project using deterministic Pillow drawings.
It may be reused and modified with this project. The bundled Noto Sans font has its own OFL license in frontend/public/fonts/OFL.txt.
