# Design QA — 17 September 2026

Все 106 PNG из `screens.zip` просмотрены в десяти контактных листах. Референсы определяют композицию, пропорции и плотность, а последнее требование пользователя определяет тёмную фиолетовую палитру. Попиксельная приёмка всех отдельных изображений не проводилась и не заявляется.

| Группа | PNG | Реализация |
| --- | ---: | --- |
| Home / Catalog / Cart / Wishlist | 18 | Hero, thumbnails, shelves, filters, grid/list, purchase flow |
| Store game | 8 | Gallery, purchase sidebar, requirements, DLC, reviews |
| Library | 10 | Sidebar, collections, favorites, owned game, feed |
| Community | 7 | Sources, search, kinds, ordering, composer, feed |
| Postcards / details / composers | 11 | Different media types, comments, reactions, author actions |
| Public account | 16 | Cover, overlapping avatar, sections, social state, privacy |
| Own account | 20 | Activity, library previews, reviews, posts, connections |
| Chat | 6 | Dialogs / conversation / media sidebar, empty and attachment states |
| Settings | 5 | Sidebar, General, Password, Notifications, Wallet, Delete |
| Legal | 5 | Shared readable article layout and footer navigation |
| Total | **106** | |

## Токены

`frontend/src/static/styles/base.css` задаёт одну базовую палитру и её светлый вариант. Dark: main #100d18, panel #191423, card #221b30, accent #9259eb, primary text #f6f2fc. Общий шрифт — локальный variable Noto Sans, объявленный как Steamn’t UI. Радиусы 8/12/18 px, основной шаг отступов 4 px. Hero широкоформатный, обложки карточек кадрируются, изображения сохраняют пропорции, аватары круглые.

Исторические импорты polish/v5/v6 и конкурирующие root-палитры удалены. Правила компонентов собраны в один файл с сохранением актуального каскада; точные повторные declarations удалены. `components.css` остаётся большим и содержит исторические `!important`. Полное устранение всех неиспользуемых selectors и разделение этого файла по владельцам пока не подтверждены.

## Проверка адаптации

Браузерный прогон: 23 страницы × ширины 1920, 1440, 1024, 768, 390 = 115 состояний. На этих данных нет горизонтального document overflow, обнаруженных выходящих за viewport основных блоков, сломанных загруженных изображений и ошибок JavaScript. Проверяются загруженные изображения; изображения с lazy loading могут загружаться только после прокрутки.

Страницы: Home, Catalog, Game, DLC, Bundles/list/detail, Library, owned game, Community, post detail, own/public profile, Friends, populated Chat, General settings, Wallet, Orders, Notifications, News, Refund policy, Wishlist, Cart, Checkout. Wishlist/Cart/Checkout в матрице включают пустые состояния; заполненная корзина и checkout дополнительно проверены через покупку в браузере.

Снимки desktop/mobile и формы просмотрены вручную. Встроенный браузер давал искажённые Retina-снимки, поэтому для достоверных снимков использовался отдельный headless Chrome с deviceScaleFactor=1 и изолированными тестовыми сессиями.

Визуальная проверка не равнозначна полному аудиту доступности, измерению каждого элемента Figma или испытанию каждой комбинации длинных данных, ошибок сети и всех возможных состояний. Такие критерии сохранены открытыми в roadmap.
