# KAN-28 — final alignment QA candidate

Статус: **IN PROGRESS / QA CANDIDATE**, ветка `feature/KAN-28-frontend-wishlist`, baseline `d810447`.

Архив cumulative: он уже включает предыдущую KAN-28 revision, оба v6 hotfix, редизайн Home/Game Details, демоданные и этот последний UI alignment. Старые KAN-28 ZIP/hotfix поверх него не применять.

## Последний блок исправлений

- Catalog, Library и Wishlist используют один `StoreToolbar`: одинаковые поиск, сортировка, счётчик и одна кнопка grid/list.
- Wishlist получил настоящий grid/list state без второго toolbar.
- Wishlist filter panel и карточки начинаются на одной горизонтали; лишняя правая строка счётчика удалена.
- Library tabs вынесены в отдельный общий subnav; ниже sidebar и первая карточка начинаются на одной горизонтали.
- All games/Favorites используют ту же 320ms underline-анимацию, что и Header.
- Catalog filters, Wishlist filters и Library sidebar закреплены через `position: sticky`; длинные панели прокручиваются внутри.
- Исправлен root cause sticky: `overflow-x: hidden` на body создавал отдельный scroll-container. Используется `overflow-x: clip`, а legacy shell clipping сброшен.
- На узких экранах панели корректно переходят в обычный поток вместо липкого двухколоночного layout.

## Установка на Mac

Сначала останови backend/frontend и сделай backup незакоммиченных файлов.

```bash
cd ~/Projects/steamnt
git branch --show-current
unzip -o ~/Downloads/STEAMNT_KAN-28_FINAL_ALIGNMENT_QA.zip -d .
```

Должна быть ветка `feature/KAN-28-frontend-wishlist`.

## Backend gate

```bash
cd ~/Projects/steamnt
source .venv/bin/activate
cd backend
python manage.py migrate
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
```

Опционально обновить идемпотентный демокаталог:

```bash
python manage.py seed_store_demo --with-demo-user
```

## Frontend gate

```bash
cd ~/Projects/steamnt
npm --prefix frontend install
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix frontend run dev -- --host 127.0.0.1
```

Если зависимости уже установлены по lock-файлу, `npm install` можно не повторять. package.json и package-lock.json этой revision не менялись.

## Ручная приёмка

1. Catalog: toolbar не изменился визуально; grid/list работает; filters остаются видимыми при длинном скролле.
2. Library: toolbar идентичен Catalog; All games/Favorites плавно анимируют underline; первая карточка ровно по верхней границе Your library; sidebar sticky.
3. Wishlist: тот же toolbar; list и grid показывают те же игры; filters и карточки начинаются ровно; filter panel sticky.
4. Проверить ширины 1440, 1024, 820, 700, 390 и 320 px без горизонтального overflow.

## Commit и push — только после PASS выше

```bash
cd ~/Projects/steamnt
git status
git add .
git commit -m "fix(KAN-28): finalize wishlist and library UI"
git push -u origin feature/KAN-28-frontend-wishlist
```

PR открывать в `develop`. Не переводить KAN-28 в DONE до CI и review.
