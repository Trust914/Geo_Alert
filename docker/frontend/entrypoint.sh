# #!/bin/sh
# set -e

# INDEX=/usr/share/nginx/html/index.html
# ENV_JS=/usr/share/nginx/html/__env.js
# NGINX_CONF=/etc/nginx/conf.d/app.conf

# # 1. Update Nginx Proxy (Only relevant for Staging)
# # If NGINX_API_HOST is provided, we swap it in.
# if [ -n "$NGINX_API_HOST" ]; then
#     envsubst '${NGINX_API_HOST}' < "$NGINX_CONF" > /tmp/app.conf
#     mv /tmp/app.conf "$NGINX_CONF"
# fi

# # 2. Create Browser Env File
# # This allows the frontend to know its API URL at runtime
# cat > "$ENV_JS" << EOF
# window.__ENV__ = {
#   VITE_API_BASE_URL: "${VITE_API_BASE_URL}",
#   VITE_APP_NAME: "${VITE_APP_NAME:-GeoAlert}",
#   VITE_APP_ENV: "${VITE_APP_ENV:-production}",
#   VITE_MAPBOX_PUBLIC_TOKEN: "${VITE_MAPBOX_PUBLIC_TOKEN}"
# };
# EOF

# # 3. Inject script tag into index.html
# python3 - << PYEOF
# content = open('$INDEX', 'r').read()
# tag = '<script src="/__env.js"></script>'
# if tag not in content:
#     patched = content.replace('</head>', tag + '</head>', 1)
#     open('$INDEX', 'w').write(patched)
# PYEOF

# exec "$@"

#!/bin/sh
set -e

INDEX=/usr/share/nginx/html/index.html
ENV_JS=/usr/share/nginx/html/__env.js
NGINX_CONF=/etc/nginx/conf.d/app.conf

# 1. Substitute NGINX_PORT (required by Render)
export NGINX_PORT="${PORT:-80}"
envsubst '${NGINX_PORT}' < "$NGINX_CONF" > /tmp/app.conf
mv /tmp/app.conf "$NGINX_CONF"

# 2. Create Browser Env File
cat > "$ENV_JS" << EOF
window.__ENV__ = {
  VITE_API_BASE_URL: "${VITE_API_BASE_URL}",
  VITE_APP_NAME: "${VITE_APP_NAME:-GeoAlert}",
  VITE_APP_ENV: "${VITE_APP_ENV:-production}",
  VITE_MAPBOX_PUBLIC_TOKEN: "${VITE_MAPBOX_PUBLIC_TOKEN}"
};
EOF

# 3. Inject script tag into index.html
python3 - << PYEOF
content = open('$INDEX', 'r').read()
tag = '<script src="/__env.js"></script>'
if tag not in content:
    patched = content.replace('</head>', tag + '</head>', 1)
    open('$INDEX', 'w').write(patched)
PYEOF

exec "$@"