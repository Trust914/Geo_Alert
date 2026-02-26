# ─────────────────────────────────────────────────────────────
# GeoAlert — PostgreSQL + PostGIS
# ─────────────────────────────────────────────────────────────
FROM postgis/postgis:16-3.4-alpine

# Install useful extensions
RUN apk add --no-cache \
    curl \
    bash

# Copy init scripts — run once on first container start
# Place any .sql or .sh files in docker/postgres/init/
COPY ./init/ /docker-entrypoint-initdb.d/

# Postgres config tuning (optional — safe defaults for 4GB RAM server)
COPY ./postgresql.conf /etc/postgresql/postgresql.conf

EXPOSE 5432

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB} || exit 1