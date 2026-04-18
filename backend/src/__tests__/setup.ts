import { beforeAll, afterAll, afterEach, vi } from "vitest";

/**
 * Global test setup — applies to BOTH unit and integration tests.
 *
 * Philosophy:
 *  - The real Prisma / DB connection is used everywhere (unit tests mock
 *    prisma at the module level themselves; integration tests hit the
 *    real DB directly via the same DATABASE_URL the app uses).
 *  - Only infrastructure with genuine side-effects is mocked here:
 *    Redis, cache, RabbitMQ, and outbound email.
 */

// ── Redis ─────────────────────────────────────────────────────────────────────
// Prevents the app from trying to open a real Redis socket during tests.
vi.mock("../config/redis.config.js", () => ({
  redisConfig: {
    connection: {
      host: "localhost",
      port: 6379,
    },
  },
}));

// ── Cache service ─────────────────────────────────────────────────────────────
// All cache reads return null by default so services always fall through
// to the DB — deterministic and easy to override per-test with mockResolvedValue.
vi.mock("../services/cache.service.js", () => ({
  getCacheService: vi.fn(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(null),
    deletePattern: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(null),
    increment: vi.fn().mockResolvedValue(1),
    ping: vi.fn().mockResolvedValue("PONG"),
    list: vi.fn().mockResolvedValue([]),
    invalidateGroup: vi.fn().mockResolvedValue(null),
    // getOrSet always executes the fetcher so DB logic is still exercised.
    getOrSet: vi.fn().mockImplementation(
      (_prefix: string, _key: string, fetcher: () => Promise<any>) => fetcher()
    ),
  })),
  initializeCacheService: vi.fn(),
}));

// ── RabbitMQ ──────────────────────────────────────────────────────────────────
// Prevents workers / queue connections from being opened during tests.
vi.mock("../rabbitmq/rabbitmq.queue.js", () => ({
  RabbitMQService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(undefined),
    sendToQueue: vi.fn().mockResolvedValue(undefined),
    assertQueue: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../rabbitmq/rabbitmq.workers.js", () => ({
  startWorkers: vi.fn().mockResolvedValue(undefined),
}));

// ── Outbound email ────────────────────────────────────────────────────────────
vi.mock("../services/email/email.service.js", () => ({
  EmailService: {
    sendEmail: vi.fn().mockResolvedValue(undefined),
    sendBulkEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../services/activation.service.js", () => ({
  ActivationService: {
    sendActivationEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

// ── Logger ────────────────────────────────────────────────────────────────────
// Silences output during test runs; swap to vi.fn() stubs so calls don't throw.
vi.mock("../utils/logger.util.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  },
}));

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Prisma connects lazily on first query — nothing to do here.
  console.log("✅ Test environment ready");
});

afterAll(async () => {
  // Prisma's connection pool is shared across tests; closing it here would
  // break parallel suites. The process exit handles cleanup naturally.
  console.log("✅ Test suite finished");
});

afterEach(() => {
  // Reset all mock call counts / return values between tests
  // without re-applying vi.mock() (which would break module identity).
  vi.clearAllMocks();
});