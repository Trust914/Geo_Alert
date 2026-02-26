import argon2 from "argon2";
import crypto from "crypto";
import type { Response } from "express";
import jwt from "jsonwebtoken";
import { argon2Config } from "../config/argon2.config.js";
import type { IJWTPayload } from "../types/auth.types.js";
import { AppError } from "../utils/error.util.js";
import { serverConfig } from "../config/server.config.js";

export class JWTService {
  private static readonly accessTokenExpiresIn = serverConfig.jwt.accessTokenExpiry as jwt.SignOptions["expiresIn"];
  private static readonly refreshTokenExpiresIn = serverConfig.jwt.refreshTokenExpiry as jwt.SignOptions["expiresIn"];
  private static readonly preAuthTokenExpiresIn = serverConfig.jwt.twoFactorPendingExpiry as jwt.SignOptions["expiresIn"];

  // Base options shared by both
  private static readonly BaseOptions = {
    issuer: "geoalert-api",
    audience: "geoalert-client",
  };

  static generateAccessToken(userId: string, agencyId: string, role: string): string {
    const payload: IJWTPayload = {
      userId,
      agencyId,
      role: role as any,
    };

    const options: jwt.SignOptions = {
      ...this.BaseOptions,
    };

    if (this.accessTokenExpiresIn) {
      options.expiresIn = this.accessTokenExpiresIn;
    }

    return jwt.sign(payload, serverConfig.jwt.accessTokenSecret, options);
  }

  static verifyAccessToken = (token: string): IJWTPayload => {
    try {
      // Use VerifyOptions (SignOptions are slightly different)
      const verifyOptions: jwt.VerifyOptions = {
        ...this.BaseOptions,
      };

      const decoded = jwt.verify(token, serverConfig.jwt.accessTokenSecret, verifyOptions) as unknown as IJWTPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw AppError.unauthorized("Token has expired", "JWTUtil");
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw AppError.unauthorized("Invalid token", "JWTUtil");
      }
      throw AppError.unauthorized("Token verification failed", "JWTUtil");
    }
  };

  static generateRefreshToken = (payload: IJWTPayload): string => {
    const options: jwt.SignOptions = {
      ...this.BaseOptions,
    };

    if (this.refreshTokenExpiresIn) {
      options.expiresIn = this.refreshTokenExpiresIn;
    }

    return jwt.sign(payload, serverConfig.jwt.refreshTokenSecret, options);
  };

  static verifyAndDecodeRefreshToken = (token: string): IJWTPayload => {
    try {
      const verifyOptions: jwt.VerifyOptions = {
        ...this.BaseOptions,
      };

      const decoded = jwt.verify(token, serverConfig.jwt.refreshTokenSecret, verifyOptions) as unknown as IJWTPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw AppError.unauthorized("Refresh token has expired", "JWTUtil");
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw AppError.unauthorized("Invalid refresh token", "JWTUtil");
      }
      throw AppError.unauthorized("Refresh token verification failed", "JWTUtil");
    }
  };

  static generatePreAuthToken = (userId: string) => {
    // Note: This payload uses 'sub', not 'userId'
    const payload = {
      sub: userId,
      scope: "2fa_pending",
      isPreAuth: true,
    };

    const options: jwt.SignOptions = {
      ...this.BaseOptions,
    };

    if (this.preAuthTokenExpiresIn) {
      options.expiresIn = this.preAuthTokenExpiresIn;
    }

    return jwt.sign(payload, serverConfig.jwt.twoFactorTokenSecret, options);
  };

  /**
   * Verify pre-auth token (for 2FA flow)
   */
  static verifyPreAuthToken = (token: string): { userId: string } => {
    try {
      const verifyOptions: jwt.VerifyOptions = {
        ...this.BaseOptions,
      };
      const decoded = jwt.verify(token, serverConfig.jwt.twoFactorTokenSecret, verifyOptions) as jwt.JwtPayload;

      // Ensure it's a pre-auth token (not a stolen access token)
      // We manually check these fields since we didn't cast to IJWTPayload
      if (!decoded.isPreAuth || decoded.scope !== "2fa_pending") {
        throw AppError.unauthorized("Invalid token type");
      }

      return { userId: decoded.sub as string };
    } catch (error) {
      throw AppError.unauthorized("Invalid or expired pre-auth token", "JWTUtil", { error });
    }
  };

  static generateRandomPassword = (length = serverConfig.security.defaultPasswordLength): string => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    const values = crypto.randomBytes(length);

    for (let i = 0; i < length; i++) {
      password += charset[(values[i] as number) % charset.length];
    }
    return password;
  };

  static hashPasswordArgon2 = async (password: string): Promise<string> => {
    try {
      const hash = await argon2.hash(password, argon2Config.options);
      return hash;
    } catch (error) {
      throw AppError.internal("Password hashing failed", error, "HashPasswordUtil");
    }
  };

  static generateSystemSecret = (bytes = serverConfig.security.systemSecretBytesLength) => {
    const secret = crypto.randomBytes(bytes);
    return secret.toString("hex");
  };

  static verifyPasswordArgon2 = async (storedPasswordHash: string, inputPassword: string): Promise<boolean> => {
    try {
      const isValid = await argon2.verify(storedPasswordHash, inputPassword, argon2Config.options);
      return isValid;
    } catch (error) {
      throw AppError.internal("Password verification failed", error, "VerifyPasswordUtil");
    }
  };

  /**
   * Validate password strength
   */
  static validatePasswordStrength(password: string): void {
    if (password.length < 8) {
      throw AppError.badRequest("Password must be at least 8 characters long", "ActivationService");
    }

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const criteriaMet = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(Boolean).length;

    if (criteriaMet < 3) {
      throw AppError.badRequest("Password must contain at least 3 of: uppercase, lowercase, numbers, special characters", "ActivationService");
    }
  }

  static setCookie = <T>(res: Response, valueToSet: T, valueName: string, maxAge: number): void => {
    res.cookie(valueName, valueToSet, {
      httpOnly: true,
      secure: serverConfig.app.isProd || serverConfig.app.isStaging,
      sameSite: serverConfig.app.isProd || serverConfig.app.isStaging ? "none" : "lax",
      partitioned: serverConfig.app.isProd || serverConfig.app.isStaging,
      maxAge: maxAge * 1000,
      path: "/",
    });
  };

  static clearCookie = (res: Response, valueName: string): void => {
    res.clearCookie(valueName, {
      httpOnly: true,
      secure: serverConfig.app.isProd || serverConfig.app.isStaging,
      partitioned: serverConfig.app.isProd || serverConfig.app.isStaging,
      sameSite: serverConfig.app.isProd || serverConfig.app.isStaging ? "none" : "lax",
      path: "/",
    });
  };
}
