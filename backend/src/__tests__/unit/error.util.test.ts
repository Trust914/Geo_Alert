import { describe, it, expect } from "vitest";
import statusCodes from "http-status";
// FIX: added .js extension — required for ESM resolution in this project
import { AppError } from "../../utils/error.util.js";

describe("AppError", () => {
  describe("constructor", () => {
    it("should create AppError with all parameters", () => {
      const cause = new Error("Cause error");
      const error = new AppError({
        name: "TestError",
        message: "Test message",
        statusCode: 400,
        handler: "TestHandler",
        isOperational: true,
        details: { key: "value" },
        cause,
      });

      expect(error.name).toBe("TestError");
      expect(error.message).toBe("Test message");
      expect(error.statusCode).toBe(400);
      expect(error.handler).toBe("TestHandler");
      expect(error.isOperational).toBe(true);
      expect(error.details).toEqual({ key: "value" });
      expect(error.cause).toBeInstanceOf(Error);
    });

    it("should store the values passed to the constructor", () => {
      const error = new AppError({
        name: "TestError",
        message: "Test message",
        statusCode: 500,
        handler: "TestHandler",
        isOperational: false, // FIX: constructor stores false as false — it does NOT force to true
      });

      expect(error.name).toBe("TestError");
      expect(error.handler).toBe("TestHandler");
      expect(error.isOperational).toBe(false); // FIX: reflects actual constructor behavior
      expect(error.details).toEqual({});
    });
  });

  describe("static methods", () => {
    it("should create badRequest error", () => {
      const error = AppError.badRequest("Bad request message", "TestHandler", {
        field: "email",
      });

      expect(error.name).toBe("BadRequestError");
      expect(error.message).toBe("Bad request message");
      expect(error.statusCode).toBe(statusCodes.BAD_REQUEST);
      expect(error.handler).toBe("TestHandler");
      expect(error.isOperational).toBe(true);
      expect(error.details).toEqual({ field: "email" });
    });

    it("should create unauthorized error", () => {
      const error = AppError.unauthorized("Unauthorized message", "AuthHandler");

      expect(error.name).toBe("UnauthorizedError");
      expect(error.message).toBe("Unauthorized message");
      expect(error.statusCode).toBe(statusCodes.UNAUTHORIZED);
      expect(error.handler).toBe("AuthHandler");
      expect(error.isOperational).toBe(true);
    });

    it("should create forbidden error", () => {
      const error = AppError.forbidden("Forbidden message", "AuthHandler");

      expect(error.name).toBe("ForbiddenError");
      expect(error.message).toBe("Forbidden message");
      expect(error.statusCode).toBe(statusCodes.FORBIDDEN);
      expect(error.handler).toBe("AuthHandler");
      expect(error.isOperational).toBe(true);
    });

    it("should create notFound error", () => {
      const error = AppError.notFound("Not found message", "NotFoundHandler");

      expect(error.name).toBe("NotFoundError");
      expect(error.message).toBe("Not found message");
      expect(error.statusCode).toBe(statusCodes.NOT_FOUND);
      expect(error.handler).toBe("NotFoundHandler");
      expect(error.isOperational).toBe(true);
    });

    it("should create tooManyRequests error", () => {
      const error = AppError.tooManyRequests(
        "Too many requests message",
        "RateLimitHandler"
      );

      expect(error.name).toBe("TooManyRequestsError");
      expect(error.message).toBe("Too many requests message");
      expect(error.statusCode).toBe(statusCodes.TOO_MANY_REQUESTS);
      expect(error.handler).toBe("RateLimitHandler");
      expect(error.isOperational).toBe(true);
    });

    it("should create internal error", () => {
      const cause = new Error("Cause error");
      const error = AppError.internal(
        "Internal error message",
        cause,
        "SystemHandler"
      );

      expect(error.name).toBe("InternalServerError");
      expect(error.message).toBe("Internal error message");
      expect(error.statusCode).toBe(statusCodes.INTERNAL_SERVER_ERROR);
      expect(error.handler).toBe("SystemHandler");
      expect(error.isOperational).toBe(false);
      expect(error.cause).toBe(cause);
    });

    it("should create conflict error", () => {
      const error = AppError.conflict("Conflict message", "ConflictHandler");

      expect(error.name).toBe("ConflictError");
      expect(error.message).toBe("Conflict message");
      expect(error.statusCode).toBe(statusCodes.CONFLICT);
      expect(error.handler).toBe("ConflictHandler");
      expect(error.isOperational).toBe(true);
    });
  });

  describe("error inheritance", () => {
    it("should be instanceof Error", () => {
      const error = AppError.badRequest();
      expect(error).toBeInstanceOf(Error);
    });

    it("should have proper stack trace", () => {
      const error = AppError.badRequest();
      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe("string");
    });
  });
});