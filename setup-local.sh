#!/bin/sh
set -eu
cd "$(dirname "$0")"
python3 - <<'PY'
from pathlib import Path
import secrets
env = Path('.env')
if env.exists():
    print('Using existing .env; no values changed.')
else:
    text = Path('.env.example').read_text()
    text = text.replace('replace-with-a-local-development-secret', secrets.token_urlsafe(48))
    text = text.replace('replace-with-a-local-development-password', secrets.token_urlsafe(32))
    env.write_text(text)
    env.chmod(0o600)
    print('Created .env with local credentials. Frontend: http://localhost:5180')
PY
