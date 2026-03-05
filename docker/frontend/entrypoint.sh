#!/bin/sh
# ─────────────────────────────────────────────────────────────
# GeoAlert Frontend — Container Entrypoint
#
# Runs before nginx starts. Handles:
#   1. Nginx port substitution  — Render injects $PORT at runtime
#   2. Nginx proxy substitution — staging only, via NGINX_API_HOST
#   3. Runtime env file         — writes window.__ENV__ to __env.js
#   4. Index.html injection     — injects <script src="/__env.js">
# ─────────────────────────────────────────────────────────────
set -e

INDEX=/usr/share/nginx/html/index.html
ENV_JS=/usr/share/nginx/html/__env.js
NGINX_CONF=/etc/nginx/conf.d/app.conf

# ── 1. Nginx Config Substitution ─────────────────────────────
# Always substitute NGINX_PORT (required for Render's dynamic $PORT).
# Also substitute NGINX_API_HOST if provided (staging proxy).
export NGINX_PORT="${PORT:-80}"

if [ -n "$NGINX_API_HOST" ]; then
  # Staging: substitute both PORT and API host
  envsubst '${NGINX_PORT} ${NGINX_API_HOST}' < "$NGINX_CONF" > /tmp/app.conf
else
  # Production: substitute PORT only
  envsubst '${NGINX_PORT}' < "$NGINX_CONF" > /tmp/app.conf
fi

mv /tmp/app.conf "$NGINX_CONF"

# ── 2. Runtime Env File ───────────────────────────────────────
# Writes VITE_* vars to window.__ENV__ so the browser can read
# them at runtime without requiring a rebuild.
cat > "$ENV_JS" << EOF
window.__ENV__ = {
  VITE_API_BASE_URL: "${VITE_API_BASE_URL}",
  VITE_APP_NAME: "${VITE_APP_NAME:-GeoAlert System}",
  VITE_APP_ENV: "${VITE_APP_ENV:-production}",
  VITE_MAPBOX_PUBLIC_TOKEN: "${VITE_MAPBOX_PUBLIC_TOKEN}"
};
EOF

# ── 3. Inject Script Tag into index.html ─────────────────────
# Adds <script src="/__env.js"></script> before </head> if not
# already present (idempotent).
python3 - << PYEOF
content = open('$INDEX', 'r').read()
tag = '<script src="/__env.js"></script>'
if tag not in content:
    patched = content.replace('</head>', tag + '</head>', 1)
    open('$INDEX', 'w').write(patched)
PYEOF

# ── 4. Start nginx ────────────────────────────────────────────
exec "$@"