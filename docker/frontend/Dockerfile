# Location: docker/frontend/Dockerfile
# ── Stage 1: Builder ─────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .

# Build args (Vite needs these to exist, but our script will override them)
ARG VITE_APP_NAME="GeoAlert"
ENV VITE_APP_NAME=$VITE_APP_NAME

RUN npm run build

# ── Stage 2: Staging (Local Runner) ──────────────────────────
FROM nginx:1.27-alpine AS staging
RUN apk add --no-cache python3 gettext && rm /etc/nginx/conf.d/default.conf

COPY docker/frontend/nginx.conf /etc/nginx/conf.d/app.conf
COPY docker/frontend/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]

# ── Stage 3: Production (Cloud Runner) ───────────────────────
FROM nginx:1.27-alpine AS production
RUN addgroup -g 1001 -S geoalert && adduser -u 1001 -S geoalert -G geoalert
RUN apk add --no-cache python3 gettext && rm /etc/nginx/conf.d/default.conf

COPY docker/frontend/nginx.conf /etc/nginx/conf.d/app.conf
COPY docker/frontend/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

COPY --from=builder /app/dist /usr/share/nginx/html

# Set permissions for Render/Cloud security
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
ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]