# Manual QA checklist

Use a clean local database, run `python manage.py seed_store_demo`, and create two test accounts. Keep browser developer tools open and treat unexpected 4xx/5xx or console errors as failures.

- Register, log out, log in, refresh the token, and confirm a protected deep link restores pathname, query, and hash.
- Open Home, Catalog, Game Details, Community, News, and a public profile with no session and with an expired saved session.
- Search/filter/order Catalog, switch grid/list, change pages, refresh, and use Back/Forward.
- Add an unowned game to Wishlist, move through Cart and Checkout, open the resulting Order, verify Library ownership, and confirm Wishlist cleanup.
- Toggle Library Favorite separately from Wishlist; create, rename, populate, and remove a collection.
- Open Game Details screenshots, tabs, requirements, reviews, DLC list/detail, and a bundle. Confirm owned/duplicate/base-game states.
- Create each supported community post type, preview media, open the stable deep link, comment, react, share, edit, and delete as the author. Verify another user cannot mutate it.
- Open a public profile. Check privacy-hidden sections, Follow/Unfollow, friend request lifecycle, and Message navigation.
- In Friends, search, request, accept/reject/cancel/remove, open Profile, and open Chat.
- In Chat, verify empty state, text, image, file, and voice attachments, read/unread counts, polling without duplicates, participant-only attachments, and blocking behavior.
- In Settings, save General/profile media/privacy, password, every notification toggle, Wallet top-up, and the permanent deletion validation path on a disposable test account.
- Trigger friend, comment, reaction, message, and Follow notifications. Open each deep link; mark one and all read.
- Open Orders and each receipt. Confirm stored purchase prices do not change when catalog prices change.
- Visit Terms, Privacy, and Refund from Footer, Register, and Checkout.
- Repeat core pages at 1920, 1440, 1024, 768, and 390 pixels. Check keyboard focus, headings, labels, live feedback, modal Escape/outside click, overflow, and control contrast.
