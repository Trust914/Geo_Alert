import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { ActionType, EntityType, UserRole } from "../prisma/prisma/generated/enums.js";
import { RabbitMQService } from "../rabbitmq/rabbitmq.queue.js";
import { ACTION_DESCRIPTIONS } from "../types/actions.types.js";
import { AccountType, type IActivationEmailData, type IActivationTokenResult, type TAccountType } from "../types/activation.types.js";
import { EmailType, type IAgencyActivationData, type IUserActivationData } from "../types/email.types.js";
import { createAuditLog } from "../utils/auditLog.util.js";
import { AppError } from "../utils/error.util.js";
import { logger } from "../utils/logger.util.js";
import { getCacheService } from "./cache.service.js";
import { EmailTemplateService } from "./email/email.templates.service.js";
import { JWTService } from "./jwt.service.js";
import { cacheConstants } from "../config/cache.constants.js";
import { serverConfig } from "../config/server.config.js";

export class ActivationService {
  private static readonly APP_NAME = serverConfig.app.name.split("_")[0];
  private static readonly APP_NAME_LOWER = this.APP_NAME?.toLowerCase();
  private static readonly ACTIVATION_TOKEN_EXPIRY = cacheConstants.ttl.LONG; // 1 hour
  private static readonly MAX_ACTIVATION_ATTEMPTS = 3;
  private static readonly ACTIVATION_LOCKOUT = cacheConstants.ttl.DAY; // 24 hours

  private static get cache() {
    return getCacheService();
  }

  /**
   * ✅ SECURE: Generate activation link (no password in email)
   * Creates a secure, single-use token for account activation
   */
  static async sendActivationEmail(data: IActivationEmailData): Promise<void> {
    const { userId, email, firstName, accountType, metadata } = data;

    // Check if user already activated
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerified: true, isActive: true },
    });

    if (user?.emailVerified && user?.isActive) {
      throw AppError.badRequest("Account already activated", "ActivationService");
    }
    // Generate cryptographically secure activation token
    const activationToken = JWTService.generateSystemSecret();
    const hashedToken = await JWTService.hashPasswordArgon2(activationToken);
    const expiryTimestamp = Date.now() + this.ACTIVATION_TOKEN_EXPIRY * 1000;

    // Store token metadata in cache
    await this.cache.set(
      cacheConstants.keys.AUTH.ACTIVATION_TOKEN,
      userId,
      {
        hashedToken,
        email,
        accountType,
        createdAt: Date.now(),
        expiresAt: expiryTimestamp,
        used: false,
        attempts: 0,
      },
      this.ACTIVATION_TOKEN_EXPIRY,
    );

    // Build activation URL with token
    const activationUrl = `${serverConfig.cors.frontendDomain}/activate-account?token=${activationToken}&userId=${userId}`;

    serverConfig.app.isDev && logger.debug(`Generated activation URL: ${activationUrl}`);

    const agencyTemplateData: IAgencyActivationData = {
      adminName: firstName,
      agencyName: metadata?.agencyName || "Your Agency",
      agencyType: metadata?.agencyType!,
      jurisdiction: metadata?.jurisdiction!,
      activationUrl,
      expiresInHours: Math.floor(this.ACTIVATION_TOKEN_EXPIRY / 3600),
      appName: this.APP_NAME!,
    };

    const userTemplateData: IUserActivationData = {
      firstName,
      email,
      agencyName: metadata?.agencyName || "Your Agency",
      role: metadata?.role!,
      creatorName: metadata?.creatorName!,
      activationUrl,
      expiresInHours: Math.floor(this.ACTIVATION_TOKEN_EXPIRY / 3600),
      appName: this.APP_NAME!,
    };
    // Prepare email data based on account type
    const templateData = accountType === AccountType.AGENCY_ADMIN ? agencyTemplateData : userTemplateData;

    // Generate email
    const emailType = accountType === AccountType.AGENCY_ADMIN ? EmailType.AGENCY_ACTIVATION : EmailType.USER_ACTIVATION;

    const { subject, html } = EmailTemplateService.generateHtml(emailType, templateData);

    await RabbitMQService.addEmailJob({
      to: email,
      subject,
      html,
    });

    await createAuditLog(null, ActionType.ACTIVATION_EMAIL_SENT, EntityType.USER, userId, {
      description: ACTION_DESCRIPTIONS[ActionType.ACTIVATION_EMAIL_SENT],
      email,
      accountType,
      expiresAt: new Date(expiryTimestamp).toISOString(),
    });

    logger.info("Activation email sent", {
      userId,
      accountType,
      expiresInHours: Math.floor(this.ACTIVATION_TOKEN_EXPIRY / 3600),
    });
  }

  /**
   * ✅ SECURE: Verify activation token and allow user to set their own password
   */
  static async verifyActivationToken(userId: string, token: string): Promise<IActivationTokenResult> {
    // Check for lockout
    const lockoutKey = `${cacheConstants.keys.AUTH.ACTIVATION_TOKEN}:lockout`;
    const isLockedOut = await this.cache.exists(lockoutKey, userId);

    if (isLockedOut) {
      throw AppError.tooManyRequests("Too many failed activation attempts. Please contact support.", "ActivationService");
    }

    // Get token data
    const tokenData = await this.cache.get<{
      hashedToken: string;
      email: string;
      accountType: TAccountType;
      createdAt: number;
      expiresAt: number;
      used: boolean;
      attempts: number;
    }>(cacheConstants.keys.AUTH.ACTIVATION_TOKEN, userId);

    if (!tokenData) {
      throw AppError.badRequest("Invalid or expired activation link. Please request a new one.", "ActivationService");
    }

    // Check if token already used
    if (tokenData.used) {
      throw AppError.badRequest("This activation link has already been used.", "ActivationService");
    }

    // Check expiry
    if (Date.now() > tokenData.expiresAt) {
      await this.cache.delete(cacheConstants.keys.AUTH.ACTIVATION_TOKEN, userId);
      throw AppError.badRequest("Activation link has expired. Please request a new one.", "ActivationService");
    }

    // Verify token
    const isValid = await JWTService.verifyPasswordArgon2(tokenData.hashedToken, token);

    if (!isValid) {
      // Increment failed attempts
      tokenData.attempts += 1;

      if (tokenData.attempts >= this.MAX_ACTIVATION_ATTEMPTS) {
        // Lock out user
        await Promise.all([this.cache.set(lockoutKey, userId, true, this.ACTIVATION_LOCKOUT), this.cache.delete(cacheConstants.keys.AUTH.ACTIVATION_TOKEN, userId)]);

        await createAuditLog(null, ActionType.ACTIVATION_FAILED, EntityType.USER, userId, {
          description: ACTION_DESCRIPTIONS[ActionType.ACTIVATION_FAILED],
          reason: "Too many failed attempts",
          email: tokenData.email,
        });

        throw AppError.tooManyRequests("Too many failed attempts. Account locked for 24 hours.", "ActivationService");
      }

      // Update attempts
      await this.cache.set(cacheConstants.keys.AUTH.ACTIVATION_TOKEN, userId, tokenData, Math.floor((tokenData.expiresAt - Date.now()) / 1000));

      throw AppError.unauthorized("Invalid activation token", "ActivationService");
    }

    return {
      valid: true,
      email: tokenData.email,
      accountType: tokenData.accountType,
    };
  }

  /**
   * ✅ SECURE: Complete activation - user sets their own password
   */
  static async completeActivation(userId: string, token: string, newPassword: string): Promise<void> {
    // Verify token first
    const { valid, email } = await this.verifyActivationToken(userId, token);

    if (!valid) {
      throw AppError.unauthorized("Invalid activation token", "ActivationService");
    }

    // Validate password strength
    JWTService.validatePasswordStrength(newPassword);

    // Hash new password
    const hashedPassword = await JWTService.hashPasswordArgon2(newPassword);

    // Update user account and activate it
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: hashedPassword,
        isActive: true,
        mustChangePassword: false,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    // Mark token as used and delete
    await this.cache.delete(cacheConstants.keys.AUTH.ACTIVATION_TOKEN, userId);

    await createAuditLog(userId, ActionType.ACCOUNT_ACTIVATED, EntityType.USER, userId, {
      description: ACTION_DESCRIPTIONS[ActionType.ACCOUNT_ACTIVATED],
      email,
      activatedAt: new Date().toISOString(),
    });

    logger.info("Account activated successfully", { userId, email });
  }

  /**
   * Resend activation email (rate limited)
   */
  static async resendActivationEmail(userId: string): Promise<void> {
    // Rate limit check
    const rateLimitKey = `${cacheConstants.keys.AUTH.ACTIVATION_TOKEN}:resend`;
    const recentlySent = await this.cache.exists(rateLimitKey, userId);

    if (recentlySent) {
      throw AppError.tooManyRequests("Please wait before requesting a new activation email.", "ActivationService");
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        agency: {
          include: {
            createdBy: true,
          },
        },
      },
    });

    if (!user) {
      throw AppError.notFound("User not found", "ActivationService");
    }

    if (user.isActive && user.emailVerified) {
      throw AppError.badRequest("Account is already activated", "ActivationService");
    }

    // Determine account type
    const accountType = user.role === UserRole.ADMIN ? AccountType.AGENCY_ADMIN : AccountType.USER;

    const emailData: IActivationEmailData = {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      accountType,
      metadata: {
        agencyName: user.agency.name,
        role: user.role,
        creatorName: user.agency.createdBy!.firstName,
        agencyType: user.agency.type,
        jurisdiction: user.agency.jurisdiction,
      },
    };

    // Send new activation email
    await this.sendActivationEmail(emailData);

    // Set rate limit
    await this.cache.set(
      rateLimitKey,
      userId,
      true,
      cacheConstants.ttl.SHORT, // 5 minutes
    );
  }
}
