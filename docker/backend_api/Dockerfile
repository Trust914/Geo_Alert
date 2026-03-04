# ─────────────────────────────────────────────────────────────
# GeoAlert Backend API — Multi-stage Dockerfile
# ─────────────────────────────────────────────────────────────

# ── Stage 1: Builder ─────────────────────────────────────────
# Compiles TS → JS and generates the Prisma client.
# Used as a source for later stages — never run directly.
# Also used by db-migrator: includes postgresql-client for pg_isready.
FROM node:22-alpine AS builder

WORKDIR /app

# Build deps for native modules (argon2) + postgresql-client for pg_isready
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    gcc \
    libc-dev \
    linux-headers \
    postgresql-client

# Layer cache: package files before source
COPY package*.json ./

# All deps needed for the build (includes devDependencies)
RUN npm ci

# Prisma schema + config must exist before generating client
COPY ./src/prisma/ ./src/prisma/
COPY ./prisma.config.ts ./
COPY ./src/config/ ./src/config/
COPY ./src/utils/ ./src/utils/

# Generate Prisma client
# Supply dummy values to bypass strict validation in database.config.ts during build
RUN NODE_ENV=development \
    PG_DB_USER=dummy \
    PG_DB_DEV_HOST=dummy \
    PG_DB_DOCKER_HOST=dummy \
    PG_DB_PORT=5432 \
    PG_DB_NAME=dummy \
    PG_DB_PASSWORD=dummy \
    npm run prisma.generate

# Copy rest of source and build
COPY . .
RUN npm run build


# ── Stage 2: Development ─────────────────────────────────────
# Used to run the API in Docker during dev,
# or for CI build verification.
FROM node:22-alpine AS development

WORKDIR /app

RUN apk add --no-cache \
    python3 make g++ gcc libc-dev linux-headers

COPY package*.json ./
RUN npm ci   # ALL deps including devDependencies

# Copy Prisma schema and generate client
COPY src/prisma/ ./src/prisma/
COPY prisma.config.ts ./
RUN npm run prisma.generate

EXPOSE 3000
CMD ["npm", "run", "start.dev"]


# ── Stage 3: Staging ─────────────────────────────────────────
# Runs the compiled app inside Docker for local container testing.
# Uses the builder output.
FROM node:22-alpine AS staging

WORKDIR /app

RUN apk add --no-cache libstdc++ libgcc curl

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/prisma/prisma/generated ./src/prisma/prisma/generated
COPY --from=builder /app/src/seed/data ./src/seed/data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=30s \
  CMD curl -f http://localhost:3000/api/v1/health || exit 1

CMD ["npm", "run", "start.staging"]


# ── Stage 4: Production ───────────────────────────────────────
# Hardened image for AWS deployment.
# Non-root user, minimal surface area, prod deps only.
# Secret files are mounted by Docker / ECS at /run/secrets/ and
# read directly by the app via getSecret() — no entrypoint needed.
FROM node:22-alpine AS production

WORKDIR /app

RUN apk add --no-cache libstdc++ libgcc curl

# Non-root user
RUN addgroup -g 1001 -S geoalert && \
    adduser  -u 1001 -S geoalert -G geoalert

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Pull compiled output and Prisma client from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/prisma/prisma/generated ./src/prisma/prisma/generated
COPY --from=builder /app/src/seed/data ./src/seed/data

RUN chown -R geoalert:geoalert /app

USER geoalert

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=30s \
  CMD curl -f http://localhost:3000/api/v1/health || exit 1

CMD ["npm", "run", "start.prod"]