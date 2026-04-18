# GEOALERT — Testing Guide

This project uses **Vitest** for unit and integration testing.

## Stack

- **Vitest** — test runner and assertion library
- **supertest** — HTTP integration testing
- **v8** — coverage provider

---

## Directory Structure

```
src/__tests__/                                ← root test directory
├── setup.ts                                  # Global setup: mocks Redis/cache, clears mocks after each test
├── README.md                                 # This file
├── unit/
│   ├── agency.service.test.ts                # AgencyService unit tests
│   ├── alert.service.test.ts                 # AlertService unit tests
│   ├── user.service.test.ts                  # UserService unit tests
│   ├── bff.service.test.ts                   # BFFService session/login/logout tests
│   ├── twoFactorAuth.service.test.ts         # TwoFactorService (TOTP, Email OTP, backup codes)
│   ├── middleware.test.ts                    # bffAuthenticate, requireBFFStepUp, checkRole, …
│   └── controllers.test.ts                  # All 5 controllers (HTTP status/shape only)
|   ├── app.utils.test.ts
│   ├── error.util.test.ts
│   ├── health.service.test.ts
│   └── auth.validators.test.ts
└── integration/
    └── routes.integration.test.ts            # Supertest end-to-end route tests
    ├── health.integration.test.ts
    └── geotargeting.integration.test.ts
```

---

## Running Tests

```bash
# All tests
npm test

# Unit tests only (fast, no DB required)
npm run test.unit

# Integration tests only (requires test DB + seed data)
npm run test.integration

# Watch mode (unit only)
npm run test.watch

# Coverage report
npm run test.coverage


### Add to `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run --project unit",
    "test:integration": "vitest run --project integration",
    "test:watch": "vitest --project unit",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

---

## Integration Test Setup

### Prerequisites

1. Copy `.env.test.example` → `.env.test` and fill in credentials.
2. Run migrations against the test DB:
   ```bash
   DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy
   ```
3. Seed required test data:
   ```bash
   DATABASE_URL=$TEST_DATABASE_URL npx ts-node tests/seed.ts
   ```

### Environment Variables (`.env.test`)

```env
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/geoalert_test
TEST_SUPER_ADMIN_EMAIL=super@nema.gov.ng
TEST_SUPER_ADMIN_PASSWORD=Test@1234
TEST_AGENCY_ADMIN_EMAIL=admin@lagos.gov.ng
TEST_AGENCY_ADMIN_PASSWORD=Test@1234
TEST_AGENCY_ID=<uuid of seeded test agency>
TEST_STATE_ID=<uuid of a state row in the test DB>
```

---

## Geotargeting Tests

The geotargeting functionality has a dedicated integration test suite covering PostGIS spatial queries.

### Running the Suite

```bash
# Run the complete geotargeting test suite
./run-geotargeting-tests.sh

# Or run individual steps:
npm run seed.test.citizens   # Seed test citizens
npm run test -- src/__tests__/integration/geotargeting.integration.test.ts
```

### Test Data

Citizens are seeded at specific geographic coordinates:

| Location | Coordinates | Purpose |
|----------|-------------|---------|
| Lagos Central | (6.5244, 3.3792) | Main test anchor |
| Within 1 km | — | 2 citizens for tight radius testing |
| Within 10 km | — | 4 citizens for medium radius testing |
| Within 50 km | — | 6 citizens for large radius testing |
| Abuja / Port Harcourt | — | Remote — should never appear in Lagos queries |
| Opted-out citizens | — | Validate `isOptedIn` filter |

### Geotargeting Scenarios

1. **50 km radius from Lagos Central** → finds 6 citizens
2. **10 km radius from Lagos Central** → finds 4 citizens
3. **1 km radius from Lagos Central** → finds 2 citizens
4. **Remote location** → finds 0 citizens
5. **Opt-out filtering** → opted-out citizens excluded
6. **Large radius** → finds all local citizens
7. **Distance ordering** → results ordered by proximity

---

## What's Covered

### Unit Tests

| Module | Scenarios |
|--------|-----------|
| `AgencyService` | createAgency (all conflict/not-found/invalid-jurisdiction cases), getById, update (name conflict), soft-delete (blocked when alerts exist), reactivate, stats, all `validateJurisdictionLevel` combinations via `it.each` |
| `AlertService` | createAlert (VIEWER blocked, jurisdiction enforced per level), estimateRecipients (admin boundaries + spatial + combined), cancelAlert (DRAFT → error, SENT → success, not-found), getAlerts (NEMA super-admin scoping), getAlertStats |
| `UserService` | createUser (agency admin forced to own agencyId, super admin cross-agency, role/agency/inactive-agency validation), getUserById, deactivate (self-deactivation blocked), reactivate, resetUserPassword |
| `BFFService` | validateAndRefreshSession (expired, idle, stale access token, not found, auto-refresh), login (success, bad creds, inactive account, 2FA trigger), logout, revokeSession, fingerprint hashing consistency |
| `TwoFactorService` | generateTOTPSetup (caches setup), verifyAndEnableTOTP (success + bad token + no pending setup), verifyTOTP (attempt-limit lockout), verifyEmailOTP (expired OTP), disable2FA (password check), regenerateBackupCodes, verifyBackupCode (used code invalidated) |
| `bffAuthenticate` | Valid session, no cookie, invalid session, user not found, email unverified, account inactive, agency inactive |
| `requireBFFStepUp` | No 2FA → pass-through, TOTP, Email OTP, 8-char backup code, wrong code → error, missing `bffContext` |
| `checkBFFPasswordChangeRequired` | Normal pass-through, allowed paths (change-password/logout), blocked paths during forced change |
| `checkRole / helpers` | Per-role allow/deny, `isAdminOrCoordinator`, `requireAlertWriteAccess` (VIEWER blocked), `canViewSensitiveData` |
| All 5 controllers | HTTP status codes, response shapes, error propagation from service layer |

### Integration Tests

Full request/response cycle via supertest against the real Express app with a Postgres test DB:

- `POST /bff/auth/login` — invalid creds → 401, valid → 200 + session cookie
- `GET /bff/auth/me` — no cookie → 401, valid session → 200
- Agency CRUD with role enforcement (agency admin 403 on super-admin routes)
- Alert lifecycle: estimate recipients → create DRAFT → read → preview → cancel
- User lifecycle: create → read → deactivate → reactivate
- RBAC: `GET /agencies` and `GET /agencies/stats` return 403 for non-super-admin

---

## Writing Tests

### Unit Test Pattern

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// 1. Mock all external dependencies BEFORE importing the module under test
vi.mock("../../src/lib/prisma.js", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

// 2. Import after mocks
import { SomeService } from "../../src/services/some.service.js";
import { prisma } from "../../src/lib/prisma.js";

describe("SomeService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does something on happy path", async () => {
    // Arrange
    (prisma.user.findUnique as any).mockResolvedValue({ id: "user-001" });

    // Act
    const result = await SomeService.doSomething("user-001");

    // Assert
    expect(result).toMatchObject({ id: "user-001" });
  });

  it("throws AppError when resource not found", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    await expect(SomeService.doSomething("nonexistent")).rejects.toThrow(AppError);
  });
});
```

### Integration Test Pattern

```typescript
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";

describe("GET /api/v1/resource", () => {
  it("returns 401 without authentication", async () => {
    const res = await request(app).get("/api/v1/resource");
    expect(res.status).toBe(401);
  });

  it("returns paginated results for authenticated user", async () => {
    const res = await request(app)
      .get("/api/v1/resource")
      .set("Cookie", sessionCookie)
      .query({ page: 1, limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.pagination).toBeDefined();
  });
});
```

---

## Mocking

```typescript
// Mock an entire module
vi.mock("../services/someService.js", () => ({
  SomeService: { someMethod: vi.fn() },
}));

// Mock a single function's resolved value
(SomeService.someMethod as any).mockResolvedValue({ id: "123" });

// Spy on a method without replacing it
const spy = vi.spyOn(SomeService, "someMethod");

// Parametrised tests
it.each([
  { role: UserRole.ADMIN, expectPass: true },
  { role: UserRole.VIEWER, expectPass: false },
])("role $role → pass: $expectPass", async ({ role, expectPass }) => { ... });
```

---

## Best Practices

1. **Always mock before importing** — `vi.mock()` calls are hoisted but imports must come after.
2. **Clear mocks in `beforeEach`** — prevents state leaking between tests (`vi.clearAllMocks()`).
3. **Test one thing per test** — keep Arrange/Act/Assert tightly scoped.
4. **Test error paths explicitly** — every `if (!x) throw AppError` should have a corresponding test.
5. **Use `toMatchObject` over `toEqual`** — more resilient to added fields.
6. **Integration tests run sequentially** — the `vitest.config.ts` sets `singleFork: true` for the integration project to avoid DB conflicts.
7. **Don't assert on mock call count unless it matters** — prefer asserting on outputs over implementation details.

---

## Coverage Thresholds

Configured in `vitest.config.ts`:

| Metric | Threshold |
|--------|-----------|
| Lines | 70% |
| Functions | 70% |
| Branches | 65% |
| Statements | 70% |

Run `npm run test:coverage` to see the full HTML report in `./coverage/`.