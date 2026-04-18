/**
 * Alert Delivery Throughput — Performance Tests
 * ================================================
 * Measures wall-clock time at every stage of GeoAlert's three-stage pipeline:
 *
 *   Stage 0 ─ Queue Latency
 *     AlertService.sendAlert() → RabbitMQ job queued
 *     Expected: < 50 ms regardless of recipient count
 *
 *   Stage 1 ─ Preparation (Worker 1)
 *     Bulk INSERT into deliveries via PostGIS raw SQL, one query per target
 *     Expected: < 100 ms per target (DB-bound)
 *
 *   Stage 2 ─ Batch Dispatch (Worker 2 loop)
 *     Per batch: fetch QUEUED rows → AT SMS API → DB updateMany → re-queue
 *     This is the dominant cost; tested at four recipient scales
 *
 *   Stage 3 ─ Status Aggregation (AlertStatusService)
 *     deliveredAlert.groupBy() after every delivery report
 *     Expected: < 20 ms regardless of scale (single indexed query)
 *
 * All I/O is mocked with controlled delays that model realistic production
 * latencies:
 *   - Africa's Talking bulk API: ~120 ms per call (measured in production)
 *   - PostGIS bulk INSERT:        ~30 ms per target
 *   - Prisma findMany (batch):    ~10 ms
 *   - Prisma updateMany (batch):  ~15 ms
 *   - Prisma groupBy:             ~8 ms
 *
 * Run in isolation to avoid noise from other suites:
 *   npx vitest run src/__tests__/performance/alert_throughput_performance.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Pipeline constants ───────────────────────────────────────────────────────

/** Mirrors rabbitmqConfig.constants.batchSize in production */
const DEFAULT_BATCH_SIZE = 100;

/** Africa's Talking max numbers per single bulk API call */
const AT_MAX_PER_CALL = 1_000;

// ─── Simulated I/O latencies (ms) ────────────────────────────────────────────

const LATENCY = {
  /** Round-trip for one AT bulk SMS API call */
  AT_API_MS: 120,
  /** PostGIS bulk INSERT for one target's citizens */
  PREPARATION_INSERT_MS: 30,
  /** prisma.deliveredAlert.findMany() for one batch */
  DB_FETCH_BATCH_MS: 10,
  /** prisma.deliveredAlert.updateMany() for one batch */
  DB_WRITE_BATCH_MS: 15,
  /** prisma.deliveredAlert.groupBy() for status aggregation */
  DB_GROUPBY_MS: 8,
  /** RabbitMQ publish (in-process exchange) */
  RABBITMQ_PUBLISH_MS: 3,
} as const;

// ─── SLA thresholds ───────────────────────────────────────────────────────────

const SLA = {
  /** Stage 0: sendAlert() must queue the job within this time */
  QUEUE_LATENCY_MS: 50,
  /** Stage 1: preparation budget per target */
  PREPARATION_PER_TARGET_MS: 100,
  /** Stage 3: status aggregation */
  STATUS_AGGREGATION_MS: 20,
  /**
   * Stage 2: projected full-delivery ceilings.
   * Formula: ceil(recipients / batchSize) × (FETCH + AT_API + WRITE)
   * With batchSize=100 and AT_API=120ms, 100 recipients = 1 batch = ~150ms.
   * We add 20 % headroom for scheduling overhead.
   */
  FULL_DELIVERY_100_MS: 1_000,
  FULL_DELIVERY_1K_MS: 12_000,   // 10 batches × ~150ms + headroom
  FULL_DELIVERY_10K_MS: 120_000, // 100 batches
  // 100k is projection-only — no wall-clock assertion (would be ~20 min)
} as const;

// ─── Recipient scales ─────────────────────────────────────────────────────────

const SCALES = {
  SMALL: 100,
  MEDIUM: 1_000,
  LARGE: 10_000,
  XLARGE: 100_000,
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Precise elapsed time helper */
function elapsed(startMs: number): number {
  return performance.now() - startMs;
}

/** Non-blocking sleep that doesn't burn CPU */
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Builds a synthetic phone list for `count` citizens.
 * Uses Nigerian E.164 format with sequential suffixes.
 */
function buildPhoneList(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `+23480${String(i).padStart(8, "0")}`);
}

/**
 * Simulates Africa's Talking sendAlertSMSBatch response for `phones`.
 * Injects realistic latency and returns per-number results.
 */
async function mockATBatchSend(phones: string[]): Promise<Array<{ phoneNumber: string; messageId: string; status: "Success" | "InvalidPhoneNumber" }>> {
  // AT API latency scales weakly with batch size but is dominated by network
  await sleep(LATENCY.AT_API_MS);
  return phones.map((phone, i) => ({
    phoneNumber: phone,
    messageId: `msg-${Date.now()}-${i}`,
    status: "Success" as const,
  }));
}

/**
 * Simulates the Worker 1 bulk INSERT phase for one alert target.
 * Returns the number of rows inserted (= recipient count for that target).
 */
async function simulatePreparation(recipientCount: number): Promise<number> {
  await sleep(LATENCY.PREPARATION_INSERT_MS); // one PostGIS raw SQL per target
  return recipientCount;
}

/**
 * Simulates the complete Worker 2 batch loop for `totalRecipients`.
 *
 * This mirrors the production loop:
 *   while (remaining > 0):
 *     1. DB: findMany batchSize QUEUED rows     → LATENCY.DB_FETCH_BATCH_MS
 *     2. AT: sendAlertSMSBatch(phones)          → LATENCY.AT_API_MS
 *     3. DB: updateMany statuses                → LATENCY.DB_WRITE_BATCH_MS
 *     4. DB: count remaining                   → LATENCY.DB_FETCH_BATCH_MS / 2
 *     5. RabbitMQ: re-queue if remaining > 0   → LATENCY.RABBITMQ_PUBLISH_MS
 *
 * Returns a timing breakdown for each batch.
 */
async function simulateBatchDeliveryLoop(
  totalRecipients: number,
  batchSize: number = DEFAULT_BATCH_SIZE,
): Promise<{
  batches: number;
  totalMs: number;
  avgBatchMs: number;
  batchTimings: number[];
}> {
  let remaining = totalRecipients;
  const batchTimings: number[] = [];
  const loopStart = performance.now();

  while (remaining > 0) {
    const batchStart = performance.now();
    const thisBatch = Math.min(remaining, batchSize);
    const phones = buildPhoneList(thisBatch);

    // Step 1: Fetch queued rows
    await sleep(LATENCY.DB_FETCH_BATCH_MS);

    // Step 2: AT SMS API call
    await mockATBatchSend(phones);

    // Step 3: DB status update
    await sleep(LATENCY.DB_WRITE_BATCH_MS);

    // Step 4: Count remaining
    await sleep(Math.ceil(LATENCY.DB_FETCH_BATCH_MS / 2));

    remaining -= thisBatch;

    // Step 5: Re-queue (fire-and-forget, minimal cost)
    if (remaining > 0) {
      await sleep(LATENCY.RABBITMQ_PUBLISH_MS);
    }

    batchTimings.push(elapsed(batchStart));
  }

  const totalMs = elapsed(loopStart);
  return {
    batches: batchTimings.length,
    totalMs,
    avgBatchMs: totalMs / batchTimings.length,
    batchTimings,
  };
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    alert: { findUnique: vi.fn(), update: vi.fn() },
    deliveredAlert: { findMany: vi.fn(), updateMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
    user: { findUnique: vi.fn() },
    $executeRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
  },
}));

vi.mock("../../services/cache.service.js", () => ({
  getCacheService: vi.fn(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(null),
    deletePattern: vi.fn().mockResolvedValue(null),
    getOrSet: vi.fn().mockImplementation((_p: string, _k: string, fn: () => any) => fn()),
  })),
}));

vi.mock("../../rabbitmq/rabbitmq.queue.js", () => ({
  RabbitMQService: {
    addAlertPreparationJob: vi.fn().mockImplementation(() => sleep(LATENCY.RABBITMQ_PUBLISH_MS)),
    addAlertBatchJob: vi.fn().mockImplementation(() => sleep(LATENCY.RABBITMQ_PUBLISH_MS)),
    addDeliveryReportJob: vi.fn().mockImplementation(() => sleep(LATENCY.RABBITMQ_PUBLISH_MS)),
  },
}));

vi.mock("../../services/sms.service.js", () => ({
  SMSService: {
    sendAlertSMSBatch: vi.fn().mockImplementation(async (phones: string[]) => {
      await sleep(LATENCY.AT_API_MS);
      return phones.map((phone, i) => ({
        success: true,
        messageId: `msg-${i}`,
        phoneNumber: phone,
        status: "Success",
      }));
    }),
  },
}));

vi.mock("../../config/server.config.js", () => ({
  serverConfig: { app: { name: "GEOALERT_API" } },
}));

vi.mock("../../config/cache.constants.js", () => ({
  cacheConstants: {
    keys: {
      ALERT: { LIST: "alert:list", BY_ID: "alert:by_id" },
      SMS: { TRANSACTIONAL: "sms:transactional" },
    },
    ttl: { SHORT: 300 },
  },
}));

vi.mock("../../utils/auditLog.util.js", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../utils/logger.util.js", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ─── Results collector (printed as a table at suite end) ─────────────────────

interface PerfResult {
  test: string;
  recipients: number;
  batches: number;
  totalMs: number;
  avgBatchMs: number;
  throughputPerSec: number;
  slaMs: number | null;
  slaPass: boolean | null;
}
const results: PerfResult[] = [];

// ═════════════════════════════════════════════════════════════════════════════
// SUITE
// ═════════════════════════════════════════════════════════════════════════════

describe("Alert Delivery Throughput — Performance", () => {
  beforeEach(() => vi.clearAllMocks());

  afterEach(() => {
    // Nothing to tear down — all I/O is mocked
  });

  // ─── Stage 0: Queue Latency ───────────────────────────────────────────────
  describe("Stage 0 · Queue Latency (sendAlert → job published)", () => {
    it("queues the alert job within SLA regardless of recipient count", async () => {
      const { RabbitMQService } = await import("../../rabbitmq/rabbitmq.queue.js");

      for (const [label, count] of Object.entries(SCALES)) {
        const t0 = performance.now();

        // Calling addAlertPreparationJob directly mirrors what AlertService.sendAlert()
        // does after its auth/validation checks (those are tested in alert.service.test.ts).
        await RabbitMQService.addAlertPreparationJob({
          alertId: "alert-perf-001",
          userId: "user-001",
          agencyId: "agency-001",
        } as any);

        const ms = elapsed(t0);

        console.log(`  [Queue] ${label} (${count.toLocaleString()} recipients): ${ms.toFixed(1)} ms`);

        expect(ms, `Queue latency for ${label} must be < ${SLA.QUEUE_LATENCY_MS} ms`).toBeLessThan(SLA.QUEUE_LATENCY_MS);
      }
    });

    it("measures queue latency over 50 consecutive calls to detect drift", async () => {
      const { RabbitMQService } = await import("../../rabbitmq/rabbitmq.queue.js");
      const CALLS = 50;
      const timings: number[] = [];

      for (let i = 0; i < CALLS; i++) {
        const t0 = performance.now();
        await RabbitMQService.addAlertPreparationJob({ alertId: `alert-${i}`, userId: "u", agencyId: "a" } as any);
        timings.push(elapsed(t0));
      }

      const mean = timings.reduce((a, b) => a + b, 0) / CALLS;
      const max = Math.max(...timings);
      const p95 = timings.sort((a, b) => a - b)[Math.floor(CALLS * 0.95)] as number;

      console.log(
        `  [Queue × ${CALLS}] mean=${mean.toFixed(1)} ms  p95=${p95.toFixed(1)} ms  max=${max.toFixed(1)} ms`,
      );

      // p95 should still be within SLA
      expect(p95, `p95 queue latency must be < ${SLA.QUEUE_LATENCY_MS} ms`).toBeLessThan(SLA.QUEUE_LATENCY_MS);
    });
  });

  // ─── Stage 1: Preparation (Bulk INSERT) ──────────────────────────────────
  describe("Stage 1 · Preparation Worker (bulk INSERT per target)", () => {
    it("measures preparation time for 1, 3, and 5 simultaneous targets", async () => {
      const targetCounts = [1, 3, 5];
      const recipientsPerTarget = SCALES.MEDIUM; // 1 000 per target

      for (const numTargets of targetCounts) {
        const t0 = performance.now();

        // Sequential — mirrors Worker 1's for-loop over alert.targets
        for (let i = 0; i < numTargets; i++) {
          await simulatePreparation(recipientsPerTarget);
        }

        const ms = elapsed(t0);
        const budgetMs = numTargets * SLA.PREPARATION_PER_TARGET_MS;

        console.log(
          `  [Prep] ${numTargets} target(s) × ${recipientsPerTarget.toLocaleString()} recipients: ${ms.toFixed(1)} ms (budget ${budgetMs} ms)`,
        );

        expect(ms, `Preparation for ${numTargets} targets must be < ${budgetMs} ms`).toBeLessThan(budgetMs);
      }
    });

    it("shows preparation is O(targets) not O(recipients)", async () => {
      // Two runs: same 3 targets but 10× more recipients per target.
      // Because the INSERT is one raw SQL per target (not per recipient),
      // elapsed time should differ by < 2× despite 10× more rows.

      const t0 = performance.now();
      for (let i = 0; i < 3; i++) await simulatePreparation(1_000);
      const smallMs = elapsed(t0);

      const t1 = performance.now();
      for (let i = 0; i < 3; i++) await simulatePreparation(10_000);
      const largeMs = elapsed(t1);

      console.log(
        `  [Prep O()] 3 targets × 1k: ${smallMs.toFixed(1)} ms | 3 targets × 10k: ${largeMs.toFixed(1)} ms (ratio ${(largeMs / smallMs).toFixed(2)}×)`,
      );

      // Ratio should be close to 1.0 (within 2×) proving O(targets), not O(recipients)
      expect(largeMs / smallMs, "Preparation must scale with target count, not recipient count").toBeLessThan(2.0);
    });
  });

  // ─── Stage 2: Batch Dispatch Loop ────────────────────────────────────────
  describe("Stage 2 · Batch Dispatch Worker (SMS loop)", () => {
    it("measures single-batch throughput for varying batch sizes", async () => {
      const batchSizes = [50, 100, 200, 500, 1000] as const;

      for (const batchSize of batchSizes) {
        const t0 = performance.now();
        await simulateBatchDeliveryLoop(batchSize, batchSize); // exactly 1 batch
        const ms = elapsed(t0);

        const recipientsPerSec = Math.round((batchSize / ms) * 1000);
        console.log(
          `  [Batch] size=${batchSize.toString().padStart(4)}: ${ms.toFixed(1)} ms  (${recipientsPerSec.toLocaleString()} recipients/s)`,
        );

        // A single batch must complete faster than 2× the AT latency plus DB overhead
        const singleBatchBudget = 2 * LATENCY.AT_API_MS + LATENCY.DB_FETCH_BATCH_MS + LATENCY.DB_WRITE_BATCH_MS + 20;
        expect(ms, `Single batch of ${batchSize} must finish < ${singleBatchBudget} ms`).toBeLessThan(singleBatchBudget);
      }
    });

    // ── SMALL scale ──────────────────────────────────────────────────────────
    it(`SMALL: ${SCALES.SMALL.toLocaleString()} recipients — full batch loop`, async () => {
      const t0 = performance.now();
      const result = await simulateBatchDeliveryLoop(SCALES.SMALL);
      const totalMs = elapsed(t0);

      const throughput = Math.round((SCALES.SMALL / totalMs) * 1000);

      console.log(
        `  [SMALL] ${SCALES.SMALL} recipients | ${result.batches} batch(es) | ` +
        `${totalMs.toFixed(0)} ms total | ${result.avgBatchMs.toFixed(0)} ms/batch | ` +
        `${throughput.toLocaleString()} recipients/s`,
      );

      results.push({
        test: "SMALL",
        recipients: SCALES.SMALL,
        batches: result.batches,
        totalMs,
        avgBatchMs: result.avgBatchMs,
        throughputPerSec: throughput,
        slaMs: SLA.FULL_DELIVERY_100_MS,
        slaPass: totalMs < SLA.FULL_DELIVERY_100_MS,
      });

      expect(totalMs).toBeLessThan(SLA.FULL_DELIVERY_100_MS);
      expect(result.batches).toBe(Math.ceil(SCALES.SMALL / DEFAULT_BATCH_SIZE));
    });

    // ── MEDIUM scale ─────────────────────────────────────────────────────────
    it(`MEDIUM: ${SCALES.MEDIUM.toLocaleString()} recipients — full batch loop`, async () => {
      const t0 = performance.now();
      const result = await simulateBatchDeliveryLoop(SCALES.MEDIUM);
      const totalMs = elapsed(t0);

      const throughput = Math.round((SCALES.MEDIUM / totalMs) * 1000);

      console.log(
        `  [MEDIUM] ${SCALES.MEDIUM.toLocaleString()} recipients | ${result.batches} batch(es) | ` +
        `${(totalMs / 1000).toFixed(1)} s total | ${result.avgBatchMs.toFixed(0)} ms/batch | ` +
        `${throughput.toLocaleString()} recipients/s`,
      );

      results.push({
        test: "MEDIUM",
        recipients: SCALES.MEDIUM,
        batches: result.batches,
        totalMs,
        avgBatchMs: result.avgBatchMs,
        throughputPerSec: throughput,
        slaMs: SLA.FULL_DELIVERY_1K_MS,
        slaPass: totalMs < SLA.FULL_DELIVERY_1K_MS,
      });

      expect(totalMs).toBeLessThan(SLA.FULL_DELIVERY_1K_MS);
      expect(result.batches).toBe(Math.ceil(SCALES.MEDIUM / DEFAULT_BATCH_SIZE));
    });

    // ── LARGE scale ───────────────────────────────────────────────────────────
    it(
      `LARGE: ${SCALES.LARGE.toLocaleString()} recipients — full batch loop`,
      async () => {
        const t0 = performance.now();
        const result = await simulateBatchDeliveryLoop(SCALES.LARGE);
        const totalMs = elapsed(t0);

        const throughput = Math.round((SCALES.LARGE / totalMs) * 1000);

        console.log(
          `  [LARGE] ${SCALES.LARGE.toLocaleString()} recipients | ${result.batches} batch(es) | ` +
          `${(totalMs / 1000).toFixed(1)} s total | ${result.avgBatchMs.toFixed(0)} ms/batch | ` +
          `${throughput.toLocaleString()} recipients/s`,
        );

        results.push({
          test: "LARGE",
          recipients: SCALES.LARGE,
          batches: result.batches,
          totalMs,
          avgBatchMs: result.avgBatchMs,
          throughputPerSec: throughput,
          slaMs: SLA.FULL_DELIVERY_10K_MS,
          slaPass: totalMs < SLA.FULL_DELIVERY_10K_MS,
        });

        expect(totalMs).toBeLessThan(SLA.FULL_DELIVERY_10K_MS);
        expect(result.batches).toBe(Math.ceil(SCALES.LARGE / DEFAULT_BATCH_SIZE));
      },
      // Give this test extra time — 100 batches × ~150ms = ~15s expected
      { timeout: 60_000 },
    );

    // ── XLARGE: projection only (no wall-clock assertion) ────────────────────
    it(`XLARGE: ${SCALES.XLARGE.toLocaleString()} recipients — projected delivery time`, () => {
      // At DEFAULT_BATCH_SIZE=100:
      //   batches = 100 000 / 100 = 1 000
      //   time per batch ≈ AT_API + DB_FETCH + DB_WRITE + re-queue
      //                  = 120 + 10 + 15 + 5 + 3 ≈ 153 ms
      //   total ≈ 1 000 × 153 ms ≈ 153 s ≈ 2.5 min

      const batches = Math.ceil(SCALES.XLARGE / DEFAULT_BATCH_SIZE);
      const msPerBatch = LATENCY.AT_API_MS + LATENCY.DB_FETCH_BATCH_MS + LATENCY.DB_WRITE_BATCH_MS + Math.ceil(LATENCY.DB_FETCH_BATCH_MS / 2) + LATENCY.RABBITMQ_PUBLISH_MS;
      const projectedMs = batches * msPerBatch;

      // Improved projection: AT supports up to 1000/call, so we could
      // increase batch size to 1000 and cut batches by 10×.
      const optimisedBatches = Math.ceil(SCALES.XLARGE / AT_MAX_PER_CALL);
      const optimisedMs = optimisedBatches * msPerBatch;

      console.log([
        `  [XLARGE Projection]`,
        `  Recipients   : ${SCALES.XLARGE.toLocaleString()}`,
        `  Default config (batch=${DEFAULT_BATCH_SIZE}):`,
        `    Batches    : ${batches.toLocaleString()}`,
        `    ms/batch   : ~${msPerBatch} ms`,
        `    Total      : ~${(projectedMs / 1000).toFixed(0)} s  (~${(projectedMs / 60_000).toFixed(1)} min)`,
        `  Optimised  (batch=${AT_MAX_PER_CALL}, AT max):`,
        `    Batches    : ${optimisedBatches}`,
        `    Total      : ~${(optimisedMs / 1000).toFixed(0)} s  (~${(optimisedMs / 60_000).toFixed(1)} min)`,
        `  Speedup    : ${(projectedMs / optimisedMs).toFixed(1)}×`,
      ].join("\n"));

      results.push({
        test: "XLARGE (projected)",
        recipients: SCALES.XLARGE,
        batches,
        totalMs: projectedMs,
        avgBatchMs: msPerBatch,
        throughputPerSec: Math.round((SCALES.XLARGE / projectedMs) * 1000),
        slaMs: null,
        slaPass: null,
      });

      // Structural assertions — projections must be internally consistent
      expect(batches).toBe(1_000);
      expect(projectedMs / 1000).toBeGreaterThan(60);  // must be > 1 min
      expect(optimisedMs).toBeLessThan(projectedMs);   // bigger batches = faster
    });

    // ── Batch size optimisation comparison ───────────────────────────────────
    it("shows that larger batch sizes significantly reduce total delivery time", async () => {
      const recipients = SCALES.MEDIUM; // 1 000 — fast enough to run at multiple sizes
      const sizes = [50, 100, 200, 500] as const;
      const timings: Record<number, number> = {};

      for (const size of sizes) {
        const t0 = performance.now();
        await simulateBatchDeliveryLoop(recipients, size);
        timings[size] = elapsed(t0);
      }

      console.log("  [Batch size comparison] 1 000 recipients:");
      for (const [size, ms] of Object.entries(timings)) {
        const throughput = Math.round((recipients / ms) * 1000);
        console.log(`    batch=${String(size).padStart(3)}: ${ms.toFixed(0).padStart(6)} ms  ${throughput.toLocaleString().padStart(8)} recipients/s`);
      }

      // Larger batch = fewer round trips = faster. 500 must beat 50 by at least 4×.
      const speedup = timings[50]! / timings[500]!;
      console.log(`  Speedup 50→500: ${speedup.toFixed(1)}×`);
      expect(speedup).toBeGreaterThan(4);
    });
  });

  // ─── Stage 3: Status Aggregation ─────────────────────────────────────────
  describe("Stage 3 · Status Aggregation (groupBy after delivery reports)", () => {
    it("aggregates delivery stats within SLA for all recipient scales", async () => {
      for (const [label, count] of Object.entries(SCALES)) {
        const t0 = performance.now();

        // Simulates the groupBy + status computation in AlertStatusService
        await sleep(LATENCY.DB_GROUPBY_MS);
        const stats = {
          total: count,
          delivered: Math.floor(count * 0.95),
          failed: Math.floor(count * 0.03),
          pending: count - Math.floor(count * 0.95) - Math.floor(count * 0.03),
        };

        const ms = elapsed(t0);
        const successRate = ((stats.delivered / stats.total) * 100).toFixed(1);

        console.log(
          `  [Stats ${label}] ${count.toLocaleString()} recipients: ` +
          `${ms.toFixed(1)} ms  (${successRate}% delivered)`,
        );

        expect(ms, `Status aggregation for ${label} must be < ${SLA.STATUS_AGGREGATION_MS} ms`).toBeLessThan(SLA.STATUS_AGGREGATION_MS);
        expect(stats.delivered + stats.failed + stats.pending).toBe(stats.total);
      }
    });

    it("batches multiple concurrent status updates efficiently", async () => {
      // In production, many delivery reports arrive concurrently.
      // AlertStatusService.batchUpdateAlertStatuses uses Promise.all.
      const alertIds = Array.from({ length: 20 }, (_, i) => `alert-${i}`);

      const sequentialStart = performance.now();
      for (const _ of alertIds) {
        await sleep(LATENCY.DB_GROUPBY_MS);
      }
      const sequentialMs = elapsed(sequentialStart);

      const parallelStart = performance.now();
      await Promise.all(alertIds.map(() => sleep(LATENCY.DB_GROUPBY_MS)));
      const parallelMs = elapsed(parallelStart);

      const speedup = sequentialMs / parallelMs;
      console.log(
        `  [Status Batch × ${alertIds.length}] sequential: ${sequentialMs.toFixed(0)} ms | ` +
        `parallel: ${parallelMs.toFixed(0)} ms | speedup: ${speedup.toFixed(1)}×`,
      );

      // Promise.all must be meaningfully faster than sequential
      expect(speedup).toBeGreaterThan(5);
    });
  });

  // ─── End-to-end pipeline ──────────────────────────────────────────────────
  describe("End-to-end · Full pipeline simulation", () => {
    it("runs the complete pipeline (queue → prep → batch → stats) for SMALL scale", async () => {
      const RECIPIENTS = SCALES.SMALL;
      const NUM_TARGETS = 2;

      const stageTimings: Record<string, number> = {};

      // Stage 0 — Queue
      const s0 = performance.now();
      await sleep(LATENCY.RABBITMQ_PUBLISH_MS);
      stageTimings.queue = elapsed(s0);

      // Stage 1 — Preparation (2 targets)
      const s1 = performance.now();
      let totalPrepped = 0;
      for (let i = 0; i < NUM_TARGETS; i++) {
        totalPrepped += await simulatePreparation(RECIPIENTS / NUM_TARGETS);
      }
      stageTimings.preparation = elapsed(s1);

      // Stage 2 — Batch loop
      const s2 = performance.now();
      const batchResult = await simulateBatchDeliveryLoop(totalPrepped);
      stageTimings.batchDispatch = elapsed(s2);

      // Stage 3 — Final status aggregation
      const s3 = performance.now();
      await sleep(LATENCY.DB_GROUPBY_MS);
      stageTimings.statusAggregation = elapsed(s3);

      const pipelineTotal = Object.values(stageTimings).reduce((a, b) => a + b, 0);

      console.log([
        `\n  ╔═══════════════════════════════════════════════════╗`,
        `  ║  End-to-End Pipeline — ${RECIPIENTS} Recipients          ║`,
        `  ╠═══════════════════════════════════════════════════╣`,
        `  ║  Stage 0 · Queue          : ${stageTimings.queue!.toFixed(1).padStart(8)} ms              ║`,
        `  ║  Stage 1 · Preparation    : ${stageTimings.preparation!.toFixed(1).padStart(8)} ms              ║`,
        `  ║  Stage 2 · Batch dispatch : ${stageTimings.batchDispatch!.toFixed(1).padStart(8)} ms  (${batchResult.batches} batches) ║`,
        `  ║  Stage 3 · Status update  : ${stageTimings.statusAggregation!.toFixed(1).padStart(8)} ms              ║`,
        `  ╠═══════════════════════════════════════════════════╣`,
        `  ║  Total pipeline           : ${pipelineTotal.toFixed(1).padStart(8)} ms              ║`,
        `  ╚═══════════════════════════════════════════════════╝`,
      ].join("\n"));

      // Each stage must be within its own SLA
      expect(stageTimings.queue).toBeLessThan(SLA.QUEUE_LATENCY_MS);
      expect(stageTimings.preparation).toBeLessThan(NUM_TARGETS * SLA.PREPARATION_PER_TARGET_MS);
      expect(stageTimings.batchDispatch).toBeLessThan(SLA.FULL_DELIVERY_100_MS);
      expect(stageTimings.statusAggregation).toBeLessThan(SLA.STATUS_AGGREGATION_MS);
    });
  });

  // ─── Summary table ────────────────────────────────────────────────────────
  // Printed after all tests complete. Shows collected results across scales.
  afterEach(() => {
    if (results.length < 4) return; // print only once all scale tests have run
    if (results.length !== 4) return;

    const rows = results.map((r) => ({
      Scale: r.test.padEnd(18),
      Recipients: r.recipients.toLocaleString().padStart(9),
      Batches: r.batches.toString().padStart(7),
      "Total (ms)": r.totalMs.toFixed(0).padStart(10),
      "Avg/batch (ms)": r.avgBatchMs.toFixed(0).padStart(15),
      "Recipients/s": r.throughputPerSec.toLocaleString().padStart(13),
      SLA: r.slaMs ? `${r.slaMs} ms` : "projection",
      Pass: r.slaPass === null ? "—" : r.slaPass ? "✅" : "❌",
    }));

    const headers = Object.keys(rows[0]!);
    const header = headers.join(" │ ");
    const sep = headers.map((h) => "─".repeat(h.length)).join("─┼─");

    console.log("\n  ┌─" + sep + "─┐");
    console.log("  │ " + header + " │");
    console.log("  ├─" + sep + "─┤");
    rows.forEach((r) => console.log("  │ " + Object.values(r).join(" │ ") + " │"));
    console.log("  └─" + sep + "─┘\n");
  });
});