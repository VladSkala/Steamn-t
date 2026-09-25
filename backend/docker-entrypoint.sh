#!/bin/sh
set -eu

python manage.py migrate --noinput
python manage.py collectstatic --noinput

if [ -n "${DJANGO_SUPERUSER_USERNAME:-}" ] && \
   [ -n "${DJANGO_SUPERUSER_EMAIL:-}" ] && \
   [ -n "${DJANGO_SUPERUSER_PASSWORD:-}" ]; then
    python manage.py createsuperuser --noinput || true
fi

if [ "${RUN_FULL_DEMO_SEED:-False}" = "True" ]; then
    echo "Seeding full Steamn't demo dataset..."
    python manage.py seed_full_demo
    echo "Demo dataset seeded successfully."
fi

exec "$@"
