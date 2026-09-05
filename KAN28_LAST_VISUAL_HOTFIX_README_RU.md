# KAN-28 — последний визуальный hotfix (QA)

Статус карточки: **IN PROGRESS** до локального Vite/ESLint gate и ручной приёмки.

Архив cumulative: включает всю актуальную KAN-28 revision. Старые ZIP/hotfix поверх него не применять.

## Исправлено

- Library List: cover, название, developer, disk size, Details и Favorites теперь находятся в одной устойчивой grid-строке.
- Между `Disk size` и значением восстановлен нормальный отступ.
- Кнопка Favorites всегда видима; active-state использует заполненную звезду.
- На 1120/760/520 px включаются отдельные компактные схемы без выпадения текста и действий.
- Wishlist filters: одинаковые горизонтальные inset, компактные fieldset/legend/options, ровные checkbox/radio и сброшенные лишние margin/padding.

## Установка

```bash
cd ~/Projects/steamnt
unzip -o ~/Downloads/STEAMNT_KAN-28_LAST_VISUAL_HOTFIX_QA.zip -d .
```

## Обязательный локальный gate

```bash
cd ~/Projects/steamnt
source .venv/bin/activate
cd backend
python manage.py migrate
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test

cd ../
npm --prefix frontend run lint
npm --prefix frontend run build
```

После ручной проверки List/Favorites/Wishlist можно коммитить:

```bash
git status
git add .
git commit -m "fix(KAN-28): polish library list and wishlist filters"
git push -u origin feature/KAN-28-frontend-wishlist
```
