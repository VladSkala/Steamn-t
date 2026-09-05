# KAN-28 — Unified sidebars QA

Статус: **IN PROGRESS** до локального `npm run lint`, `npm run build` и визуальной приёмки.

Архив cumulative: содержит всю актуальную KAN-28 revision. Старые ZIP поверх него не применять.

## Исправлено

Catalog filters, Library navigation и Wishlist filters переведены на одну sidebar-систему:

- одинаковая ширина 240 px на desktop;
- одинаковые фон, border, radius 14 px, shadow и нулевой внешний padding;
- одинаковый header высотой 76 px, фон и разделитель;
- единые inset 16 px, типографика, Reset, секции и строки;
- одинаковые hover/active состояния;
- сохранены sticky и внутренний scroll;
- общие responsive-правила на tablet/mobile.

## Применение

```bash
cd ~/Projects/steamnt
unzip -o ~/Downloads/STEAMNT_KAN-28_UNIFIED_SIDEBARS_QA.zip -d .
```

## Gate

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

После ручной проверки трёх страниц:

```bash
git status
git add .
git commit -m "fix(KAN-28): unify store sidebars"
git push -u origin feature/KAN-28-frontend-wishlist
```
