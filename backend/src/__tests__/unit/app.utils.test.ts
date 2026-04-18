import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────
// app.utils.ts imports prisma (for getNemaAgencyId), which transitively
// loads database.config.ts and calls checkIfDefined("PG_DB_USER") at
// module-evaluation time — crashing the whole suite before any tests run.
// Mocking prisma here prevents that chain from firing.

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    agency: { findFirst: vi.fn() },
  },
}));

vi.mock("../../config/server.config.js", () => ({
  serverConfig: { app: { name: "GeoAlert" } },
}));

import { asyncHandler, hideSensitiveKeys, requestContext } from "../../utils/app.utils.js";
import { AppError } from "../../utils/error.util.js";

describe("App Utils", () => {
  describe("hideSensitiveKeys", () => {
    it("should hide sensitive keys", () => {
      const obj = {
        name: "John",
        password: "secret123",
        email: "john@example.com",
        oldPasswordReq: "oldpass",
        newPassword: "newpass",
      };

      const result = hideSensitiveKeys(obj, ["password", "oldPasswordReq", "newPassword"]);

      expect(result).toEqual({
        name: "John",
        password: "**HIDDEN**",
        email: "john@example.com",
        oldPasswordReq: "**HIDDEN**",
        newPassword: "**HIDDEN**",
      });
    });

    it("should return null for empty object", () => {
      const result = hideSensitiveKeys({}, ["password"]);
      expect(result).toBeNull();
    });

    it("should return null for undefined object", () => {
      const result = hideSensitiveKeys(undefined as any, ["password"]);
      expect(result).toBeNull();
    });
  });

  describe("requestContext", () => {
    let mockReq: any;

    beforeEach(() => {
      mockReq = {
        method: "POST",
        originalUrl: "/api/auth/login",
        user: { id: "user123" },
        ip: "127.0.0.1",
        params: { id: "123" },
        query: { page: "1" },
        body: {
          email: "test@example.com",
          password: "secret123",
        },
      };
    });

    it("should create request context with sensitive data hidden", () => {
      const context = requestContext(mockReq);

      expect(context).toEqual({
        method: "POST",
        url: "/api/auth/login",
        user: "user123",
        ip: "127.0.0.1",
        params: { id: "123" },
        query: { page: "1" },
        body: {
          email: "test@example.com",
          password: "**HIDDEN**",
        },
      });
    });

    it("should handle anonymous user", () => {
      mockReq.user = undefined;
      const context = requestContext(mockReq);

      expect(context.user).toBe("anonymous");
    });

    it("should handle empty body", () => {
      mockReq.body = {};
      const context = requestContext(mockReq);

      expect(context.body).toBeUndefined();
    });
  });

  describe("asyncHandler", () => {
    it("should handle successful async function", async () => {
      const mockFn = vi.fn().mockResolvedValue("success");
      const handler = asyncHandler(mockFn);

      const mockReq = {} as any;
      const mockRes = {} as any;
      const mockNext = vi.fn();

      await handler(mockReq, mockRes, mockNext);

      expect(mockFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should handle AppError", async () => {
      const appError = new AppError({
        name: "TestError",
        message: "Test error message",
        statusCode: 400,
        handler: "TestHandler",
        isOperational: true,
      });

      const mockFn = vi.fn().mockRejectedValue(appError);
      const handler = asyncHandler(mockFn);

      const mockReq = {} as any;
      const mockRes = {} as any;
      const mockNext = vi.fn();

      await handler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(appError);
    });

    it("should convert regular error to AppError", async () => {
      const regularError = new Error("Regular error");

      const mockFn = vi.fn().mockRejectedValue(regularError);
      const handler = asyncHandler(mockFn, {
        errorMessage: "Custom error message",
        statusCode: 500,
        handler: "TestHandler",
      });

      const mockReq = {} as any;
      const mockRes = {} as any;
      const mockNext = vi.fn();

      await handler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();

      const call = mockNext.mock.calls[0];
      expect(call).toBeDefined();

      const error = call![0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe("Custom error message");
      expect(error.statusCode).toBe(500);
      expect(error.handler).toBe("TestHandler");
    });
  });
});