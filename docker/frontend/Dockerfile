# ─────────────────────────────────────────────────────────────
# GeoAlert Frontend — Multi-stage Dockerfile
# Build context: repo root
#
# Stages:
#   builder     → installs deps and builds the Vite app
#   staging     → nginx runner for local container testing
#   production  → hardened nginx runner for Render deployment
#
# Runtime env injection:
#   VITE_* vars      → written to window.__ENV__ by entrypoint.sh
#   NGINX_API_HOST   → substituted into nginx.conf (staging only)
#   PORT             → injected by Render; nginx listens on this port
# ─────────────────────────────────────────────────────────────

# ── Stage 1: Builder ─────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .

# Build args — passed from compose or Render environment variables
ARG VITE_API_BASE_URL
ARG VITE_APP_NAME="GeoAlert System"
ARG VITE_APP_ENV=production
ARG VITE_MAPBOX_PUBLIC_TOKEN

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_APP_ENV=$VITE_APP_ENV
ENV VITE_MAPBOX_PUBLIC_TOKEN=$VITE_MAPBOX_PUBLIC_TOKEN

RUN npm run build


# ── Stage 2: Staging ─────────────────────────────────────────
# For local Docker container testing via frontend-docker-compose.yml.
# Proxies /api/* to the backend container via NGINX_API_HOST.
FROM nginx:1.27-alpine AS staging

RUN apk add --no-cache python3 gettext && \
    rm /etc/nginx/conf.d/default.conf

COPY docker/frontend/nginx.conf /etc/nginx/conf.d/app.conf
COPY docker/frontend/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
  CMD wget -qO- http://localhost:80/ || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]


# ── Stage 3: Production ───────────────────────────────────────
# Hardened image for Render deployment.
# Non-root user, no API proxy (frontend calls api.geoalert.xyz directly).
# Listens on $PORT injected by Render at runtime.
FROM nginx:1.27-alpine AS production

RUN addgroup -g 1001 -S geoalert && \
    adduser  -u 1001 -S geoalert -G geoalert

RUN apk add --no-cache python3 gettext && \
    rm /etc/nginx/conf.d/default.conf

COPY docker/frontend/nginx.conf /etc/nginx/conf.d/app.conf
COPY docker/frontend/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

COPY --from=builder /app/dist /usr/share/nginx/html

# Grant non-root user access to all nginx runtime paths
RUN chown -R geoalert:geoalert \
      /usr/share/nginx/html \
      /var/cache/nginx \
      /var/log/nginx \
      /etc/nginx/conf.d \
      /var/run && \
    touch /var/run/nginx.pid && \
    chown geoalert:geoalert /var/run/nginx.pid

USER geoalert

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
  CMD wget -qO- http://localhost:80/ || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]