/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import { resolve } from "path";
import dotenv from "dotenv";

export default defineConfig(({ mode }) => {
  // 1. Determine which env file to load
  // Priority: NODE_ENV > mode > default to 'test'
  const envTarget = process.env.NODE_ENV || mode || "test";
  const envPath = resolve(__dirname, `envs/.env.${envTarget}`);

  // 2. Load the environment variables globally BEFORE Vitest parses test files
  dotenv.config({ path: envPath });

  console.log(`🧪 Vitest: Loading environment from ${envPath}`);

  return {
    test: {
      environment: "node",
      globals: true,

      // Single flat setup — compatible with vitest 2.x.
      // The `projects` API was only added in vitest v3+, which requires
      // upgrading @vitest/ui at the same time. To avoid the peer-dep conflict,
      // we use a flat config and scope test runs via CLI flags instead.
      //
      // Run specific suites:
      //   npm run test:unit        → only unit tests
      //   npm run test:integration → only integration tests
      //   npm run test:run         → all tests
      setupFiles: ["./src/__tests__/setup.ts"],
      include: ["src/__tests__/**/*.{test,spec}.{ts,js}"],
      exclude: ["node_modules", "dist"],

      // Integration tests can be slow; give them room.
      testTimeout: 30_000,
      hookTimeout: 30_000,

      // Sequential execution prevents concurrent DB writes during integration tests.
      pool: "forks",
      poolOptions: {
        forks: { singleFork: true },
      },

      // ── Coverage ──────────────────────────────────────────────────────────────
      coverage: {
        provider: "v8",
        reporter: ["text", "lcov", "html"],
        reportsDirectory: "./coverage",
        include: [
          "src/services/**/*.ts",
          "src/controllers/**/*.ts",
          "src/middlewares/**/*.ts",
        ],
        exclude: [
          "src/prisma/**",
          "src/types/**",
          "src/**/*.d.ts",
          "src/**/index.ts",
        ],
        thresholds: {
          lines: 70,
          functions: 70,
          branches: 65,
          statements: 70,
        },
      },
    },

    resolve: {
      alias: {
        "@": resolve(__dirname, "./src"),
      },
    },
  };
});