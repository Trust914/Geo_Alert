# ─────────────────────────────────────────────────────────────
# GeoAlert Backend API — Multi-stage Dockerfile
# Stage 1: Build  →  Stage 2: Production runtime
# ─────────────────────────────────────────────────────────────

# ── Stage 1: Builder ─────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (argon2)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    gcc \
    libc-dev \
    linux-headers

# Copy package files first (layer cache optimisation)
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy Prisma schema before generating client
COPY src/prisma/ ./src/prisma/
COPY prisma.config.ts ./
COPY src/config/ ./src/config/
COPY src/utils/ ./src/utils/

# Generate Prisma client
RUN npm run prisma.generate

# Copy rest of source
COPY . .

# Build the application
RUN npm run build


# ── Stage 2: Production Runtime ───────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

# Install runtime-only native dependencies
RUN apk add --no-cache \
    libstdc++ \
    libgcc \
    curl

# Create non-root user for security
RUN addgroup -g 1001 -S geoalert && \
    adduser  -u 1001 -S geoalert -G geoalert

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && npm cache clean --force

# Copy Prisma generated client from builder
COPY --from=builder /app/src/prisma/prisma/generated ./src/prisma/prisma/generated

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Copy seed data (needed if running seeds inside container)
COPY --from=builder /app/src/seed/data ./src/seed/data

# Set ownership
RUN chown -R geoalert:geoalert /app

USER geoalert

EXPOSE 3000

# Health check — hits the /health endpoint
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=30s \
  CMD curl -f http://localhost:3000/api/v1/health || exit 1

# Run the compiled application
CMD ["node",  "dist/index.js"]