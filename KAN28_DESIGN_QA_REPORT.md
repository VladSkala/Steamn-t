# KAN-28 — фактический QA

Статус: **QA CANDIDATE — NOT FINAL**. KAN-28 остаётся IN PROGRESS.

## Что действительно выполнено

| Проверка | Результат |
|---|---|
| Baseline до редизайна, Django tests | 134/134, стандартные hashers, SQLite |
| Текущий полный backend suite | 144/144, SQLite + MD5 test hasher в отдельном sandbox settings |
| Django system check | PASS, 0 issues |
| makemigrations --check --dry-run после новой миграции | PASS, No changes detected |
| Python AST | 81 файл, PASS |
| JSX/JS parse | 55 файлов, PASS |
| CSS parse | 24 файла, PASS |
| Локальные импорты | 109 путей, PASS |
| esbuild component bundle | 69 inputs, PASS; не Vite build |
| Demo assets | 48 WebP, декодированы; 12 covers + 36 gallery images |
| Демо-seed | создан / повторён / безопасность существующих данных проверены tests |
| Font | self-hosted variable Noto Sans WOFF + OFL license |
| Browser component snapshots | 126 PASS из 126 завершённых отчётов; план 126 |

MD5 hasher применялся только к временной тестовой БД, чтобы ускорить suite; production settings и хеширование паролей проекта НЕ изменялись. Тестовые настройки, tokens, тестовая БД и QA adapters в ZIP не входят.

## Ограничения, которые нельзя скрывать

- Полный `npm run lint` здесь **не выполнен**: ESLint недоступен в offline sandbox.
- Полный `npm run build` здесь **не выполнен**: Vite недоступен. package.json/package-lock.json оставлены без изменений; зависимости не подменялись для поставляемого проекта.
- Browser preview выполнен в Chromium на реальном React source и настоящем Django API, но через отдельные QA-adapters маршрутизации/HTTP, а не установленные React Router/Axios. CSS reset также является частью QA harness, не результатом Tailwind build. Для стабильных кадров отключены CSS-анимации.
- Поэтому эти результаты **не равны production E2E/ESLint/Vite gate** и не гарантируют pixel-perfect совпадение с Figma.
- Прогоны браузера прерывались при остановке sandbox-сервисов и отдельными Chromium timeouts. В таблице указаны только реально сохранённые отчёты, а не число запланированных запусков. Итоговые числа — в KAN28_DESIGN_BROWSER_SUMMARY.json.
- Финальное визуальное принятие и обычные npm/Django gates на машине Андрея остаются обязательными перед commit/merge.

## Что проверял browser smoke

Ширины с успешными отчётами: 320, 390, 700, 820, 1024, 1440 px.

Home/carousel; Catalog grid/list; Library grid/list/search/favorites/collection dialog/empty;
Wishlist populated/empty; Cart populated/empty; Profile; Settings; store-game owned/unowned;
gallery switch/open/close; requirements tab; Library game; My Feed back link.
Проверялись: горизонтальное переполнение страницы, top alignment Library, одинаковые steady-state стили Header/tab,
одинарная рамка поиска, отсутствие S под ownership badge, отсутствие commerce actions для owned game, загрузка artwork.

В этой среде нельзя было повторно открыть итоговые изображения в основном чате из-за лимита просмотра изображений.
Preview JPEG предоставлен для пользовательской визуальной приёмки; независимый финальный visual approval не заявляется.

## Что было исправлено по результатам проверки

- В тесте с двумя пользователями добавлены уникальные email; seed дополнительно проверяет занятость demo-email.
- Бюджет detail-query обновлён с 2 до 3: игра, genres, screenshots. Это новая реальная gallery-prefetch, не отключение теста.
- На tablet старый Library layout переключал shell в block и ставил sidebar над результатами. Восстановлен grid и сброшены старые grid placements.
- Проверка сравнивает установившийся цвет navigation tabs, не промежуточный кадр CSS transition.
- Сохранены исправления `community:game-review`, отсутствия несуществующего LibraryItem.review prefetch и React review editor reset.

## Что не сделано и не возвращено

Нет Orders History API/page, Friends API, gifting, public Wishlist, второго Profile API, фиктивных отзывов/скидок/социальной статистики.
Нет Git commit/push/PR/merge. Нельзя переводить KAN-28 в DONE только на основании этого архива.

Команды установки, запуска, demo и приёмки: KAN28_DESIGN_README_RU.md.
