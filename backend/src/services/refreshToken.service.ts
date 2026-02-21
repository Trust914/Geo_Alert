import {  serverConfig } from "../config/server.config.js";
import { prisma } from "../lib/prisma.js";
import { ActionType, EntityType } from "../prisma/prisma/generated/enums.js";
import { ACTION_DESCRIPTIONS } from "../types/actions.types.js";
import type { IJWTPayload } from "../types/auth.types.js";
import { createAuditLog } from "../utils/auditLog.util.js";
import { AppError } from "../utils/error.util.js";
import { JWTService } from "./jwt.service.js";

export class RefreshTokenService {
  static async createRefreshToken(jwtPayload: IJWTPayload, ipAddress?: string, userAgent?: string): Promise<string> {
    const userId = jwtPayload.userId;
    const token = JWTService.generateRefreshToken(jwtPayload);

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + serverConfig.jwt.refreshTokenExpiryDays); // 7 days from now by default

    // Store refresh token in database
    await prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt,
        ...(ipAddress !== undefined && { ipAddress }),
        ...(userAgent !== undefined && { userAgent }),
      },
    });

    await createAuditLog(
      userId,
      ActionType.TOKEN_REFRESH,
      EntityType.REFRESH_TOKEN,
      token.substring(0, 20), // First 20 chars as identifier
      {
        description: ACTION_DESCRIPTIONS[ActionType.TOKEN_REFRESH],
        ipAddress,
        userAgent,
        expiresAt,
      },
      ipAddress,
      userAgent
    );
    return token;
  }

  static async verifyRefreshToken(token: string): Promise<{
    userId: string;
    token: string;
  }> {
    const refreshToken = await prisma.refreshToken.findUnique({
      where: { token },
    });

    if (!refreshToken) {
      throw AppError.unauthorized("Invalid refresh token", "RefreshTokenService");
    }

    if (refreshToken.isRevoked) {
      throw AppError.unauthorized("Refresh token has been revoked", "RefreshTokenService");
    }

    if (refreshToken.expiresAt < new Date()) {
      throw AppError.unauthorized("Refresh token has expired", "RefreshTokenService");
    }

    const user = await prisma.user.findUnique({
      where: { id: refreshToken.userId },
    });

    if (!user) {
      throw AppError.notFound("User not found", "RefreshTokenService");
    }

    try {
      const decoded = JWTService.verifyAndDecodeRefreshToken(refreshToken.token);
      return { userId: decoded.userId, token: refreshToken.token };
    } catch (error) {
      const errObj = error as Error;
      throw AppError.unauthorized(`Invalid Refresh Token: ${errObj.message}`, "RefreshTokenService", { errObj });
    }
  }

  static async revokeRefreshToken(token: string, userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { token },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });
    // AUDIT LOG
    await createAuditLog(userId || null, ActionType.SESSION_REVOKED, EntityType.REFRESH_TOKEN, token.substring(0, 20), {
      description: ACTION_DESCRIPTIONS[ActionType.SESSION_REVOKED],
      reason: "Manual revocation",
    });
  }

  static async revokeAllUserTokens(userId: string): Promise<void> {
    const result = await prisma.refreshToken.updateMany({
      where: {
        userId,
        isRevoked: false,
      },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });

    // AUDIT LOG
    await createAuditLog(userId, ActionType.LOGOUT_ALL, EntityType.USER, userId, {
      description: ACTION_DESCRIPTIONS[ActionType.LOGOUT_ALL],
      tokensRevoked: result.count,
      reason: "Revoke all sessions",
    });
  }

  static async cleanupExpiredTokens(): Promise<number> {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          {
            isRevoked: true,
            revokedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // 30 days old
          },
        ],
      },
    });

    return result.count;
  }

  static async getUserActiveTokens(userId: string) {
    return prisma.refreshToken.findMany({
      where: {
        userId,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        ipAddress: true,
        userAgent: true,
        isRevoked: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async revokeTokenById(tokenId: string, userId: string): Promise<void> {
    const token = await prisma.refreshToken.findFirst({
      where: {
        id: tokenId,
        userId,
      },
    });

    if (!token) {
      throw AppError.notFound("Token not found", "RefreshTokenService");
    }

    await prisma.refreshToken.update({
      where: { id: tokenId },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });
  }
}
