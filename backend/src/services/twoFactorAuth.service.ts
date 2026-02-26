import crypto from "crypto";
import { authenticator } from "otplib";
import qrcode from "qrcode";
import { cacheConstants } from "../config/cache.constants.js";
import { prisma } from "../lib/prisma.js";
import { ActionType, EntityType, TwoFactorMethod } from "../prisma/prisma/generated/enums.js";
import { RabbitMQService } from "../rabbitmq/rabbitmq.queue.js";
import { ACTION_DESCRIPTIONS } from "../types/actions.types.js";
import { EmailPurpose, EmailType } from "../types/email.types.js";
import type { IBackupCodesData, ITOTPSetupData } from "../types/twoFactorAuth.types.js";
import { createAuditLog } from "../utils/auditLog.util.js";
import { decrypt, encrypt } from "../utils/encrytion.util.js";
import { AppError } from "../utils/error.util.js";
import { logger } from "../utils/logger.util.js";
import { getCacheService } from "./cache.service.js";
import { EmailTemplateService } from "./email/email.templates.service.js";
import { JWTService } from "./jwt.service.js";
import { serverConfig } from "../config/server.config.js";

export class TwoFactorService {
  private static readonly OTP_EXPIRY_SECONDS = cacheConstants.ttl.SHORT; // 5 minutes
  private static readonly BACKUP_CODES_COUNT = 10;
  private static readonly MAX_VERIFICATION_ATTEMPTS = 5;
  private static readonly APP_NAME = serverConfig.app.name.split("_")[0];
  private static readonly OTP_COOLDOWN_SECONDS = cacheConstants.ttl.VERY_SHORT; // 60 seconds
  private static readonly MAX_SETUP_ATTEMPTS = 3;
  private static readonly SETUP_LOCKOUT_SECONDS = cacheConstants.ttl.MEDIUM; // 15 minutes
  private static readonly MAX_OTP_REQUESTS_PER_HOUR = 5;

  private static get cache() {
    return getCacheService();
  }

  private static configureAuthenticator() {
    authenticator.options = { window: 1 };
  }

  // ==================== TOTP ====================

  static async generateTOTPSetup(userId: string, email: string): Promise<ITOTPSetupData> {
    this.configureAuthenticator();

    const secret = authenticator.generateSecret();
    const otpAuthUrl = authenticator.keyuri(email, this.APP_NAME!, secret);
    const qrCodeUrl = await qrcode.toDataURL(otpAuthUrl);
    const backupCodes = this.generateBackupCodes();

    await this.cache.set(cacheConstants.keys.AUTH.TOTP_SETUP, userId, { secret, backupCodes, timestamp: Date.now() }, cacheConstants.ttl.MEDIUM);

    logger.info("TOTP setup initiated", { userId });

    return { secret, qrCodeUrl, otpAuthUrl, backupCodes };
  }

  static async verifyAndEnableTOTP(userId: string, token: string): Promise<IBackupCodesData> {
    const setup = await this.cache.get<{
      secret: string;
      backupCodes: string[];
    }>(cacheConstants.keys.AUTH.TOTP_SETUP, userId);

    if (!setup) {
      throw AppError.badRequest("No pending 2FA setup found. Please start setup again.", "TwoFactorService");
    }

    this.configureAuthenticator();
    const isValid = authenticator.verify({ token, secret: setup.secret });

    if (!isValid) {
      throw AppError.unauthorized("Invalid verification code", "TwoFactorService");
    }

    const encryptedSecret = encrypt(setup.secret);
    const hashedBackupCodes = await Promise.all(setup.backupCodes.map((code) => JWTService.hashPasswordArgon2(code)));

    await prisma.user.update({
      where: { id: userId },
      data: {
        isTwoFactorEnabled: true,
        twoFactorMethod: TwoFactorMethod.GOOGLE_AUTHENTICATOR,
        twoFactorSecret: encryptedSecret,
        twoFactorBackupCodes: hashedBackupCodes,
      },
    });

    await Promise.all([
      this.cache.delete(cacheConstants.keys.AUTH.TOTP_SETUP, userId),
      createAuditLog(userId, ActionType.TWO_FA_ENABLED, EntityType.USER, userId, {
        description: ACTION_DESCRIPTIONS[ActionType.TWO_FA_ENABLED],
        method: TwoFactorMethod.GOOGLE_AUTHENTICATOR,
      }),
    ]);

    logger.info("TOTP 2FA enabled", { userId });
    return { backupCodes: setup.backupCodes };
  }

  static async verifyTOTP(userId: string, token: string, encryptedSecret: string): Promise<boolean> {
    await this.checkVerificationAttempts(userId);

    this.configureAuthenticator();
    const secret = decrypt(encryptedSecret);
    const isValid = authenticator.verify({ token, secret });

    if (!isValid) {
      await this.incrementVerificationAttempts(userId);
      return false;
    }

    await this.cache.delete(cacheConstants.keys.AUTH.TWO_FA_ATTEMPTS, userId);
    return true;
  }

  // ==================== Email 2FA Setup  ====================

  /**
   * STEP 1: Initiate Email 2FA Setup
   * Sends verification code to email to confirm ownership
   */
  static async initiateEmailSetup(userId: string, email: string): Promise<void> {
    // Check and increment setup attempts with auto-lockout
    await this.checkAndIncrementRateLimit(
      cacheConstants.keys.AUTH.EMAIL_SETUP,
      userId,
      this.MAX_SETUP_ATTEMPTS,
      cacheConstants.ttl.LONG, // 1 hour window
      this.SETUP_LOCKOUT_SECONDS,
      "Too many setup attempts.",
    );

    // Check recent send cooldown
    const recentlySent = await this.cache.exists(cacheConstants.keys.AUTH.EMAIL_SETUP_COOLDOWN, userId);

    if (recentlySent) {
      throw AppError.tooManyRequests("Please wait before requesting a new code", "TwoFactorService");
    }

    // Generate verification code
    const code = this.generateSecureOTP();
    const hashedCode = await JWTService.hashPasswordArgon2(code);

    // Generate backup codes (BOTH plain and hashed)
    const plainBackupCodes = this.generateBackupCodes();
    const hashedBackupCodes = await Promise.all(plainBackupCodes.map((code) => JWTService.hashPasswordArgon2(code)));

    // Calculate expiry timestamp for metadata
    const expiryTimestamp = Date.now() + this.OTP_EXPIRY_SECONDS * 1000;

    // Store setup data with expiry metadata
    await Promise.all([
      this.cache.set(
        cacheConstants.keys.AUTH.EMAIL_SETUP_OTP,
        userId,
        {
          hashedCode,
          backupCodes: hashedBackupCodes, // For DB storage
          plainBackupCodes: plainBackupCodes, // For returning to user (only once!)
          createdAt: Date.now(),
          expiresAt: expiryTimestamp,
        },
        this.OTP_EXPIRY_SECONDS, // Redis TTL handles automatic expiry
      ),
      this.cache.set(cacheConstants.keys.AUTH.EMAIL_SETUP_COOLDOWN, userId, "true", this.OTP_COOLDOWN_SECONDS),
    ]);

    // Send email using the improved service
    const { subject, html } = EmailTemplateService.generateHtml(EmailType.TWO_FACTOR_SETUP, {
      code,
      expiryMinutes: Math.floor(this.OTP_EXPIRY_SECONDS / 60),
      email,
    });

    await RabbitMQService.addEmailJob({ to: email, subject, html });

    await createAuditLog(userId, ActionType.EMAIL_OTP_SENT, EntityType.USER, userId, {
      description: ACTION_DESCRIPTIONS[ActionType.EMAIL_OTP_SENT],
      email,
      purpose: "setup",
      expiresAt: new Date(expiryTimestamp).toISOString(),
    });

    logger.info("Email 2FA setup initiated", {
      userId,
      expiresIn: `${this.OTP_EXPIRY_SECONDS}s`,
    });
  }

  /**
   * STEP 2: Verify Email and Enable 2FA
   * Confirms email ownership and enables 2FA
   */
  static async verifyAndEnableEmail2FA(userId: string, code: string): Promise<{ backupCodes: string[] }> {
    const setup = await this.cache.get<{
      hashedCode: string;
      backupCodes: string[];
      plainBackupCodes: string[];
      createdAt: number;
      expiresAt: number;
    }>(cacheConstants.keys.AUTH.EMAIL_SETUP_OTP, userId);

    if (!setup) {
      throw AppError.badRequest("Setup session expired. Please start again.", "TwoFactorService");
    }

    // Additional expiry check (defense in depth)
    if (Date.now() > setup.expiresAt) {
      await this.cache.delete(cacheConstants.keys.AUTH.EMAIL_SETUP_OTP, userId);
      throw AppError.badRequest("Verification code has expired. Please request a new one.", "TwoFactorService");
    }

    // Verify the code
    const isValid = await JWTService.verifyPasswordArgon2(setup.hashedCode, code);

    if (!isValid) {
      await createAuditLog(userId, ActionType.TWO_FA_VERIFICATION_FAILED, EntityType.USER, userId, {
        description: ACTION_DESCRIPTIONS[ActionType.TWO_FA_VERIFICATION_FAILED],
        method: TwoFactorMethod.EMAIL,
        reason: "Invalid setup code",
      });

      throw AppError.unauthorized("Invalid verification code", "TwoFactorService");
    }

    // Enable 2FA in database with HASHED backup codes
    await prisma.user.update({
      where: { id: userId },
      data: {
        isTwoFactorEnabled: true,
        twoFactorMethod: TwoFactorMethod.EMAIL,
        twoFactorBackupCodes: setup.backupCodes, // These are already hashed
      },
    });

    // Clear setup cache
    await Promise.all([
      this.cache.delete(cacheConstants.keys.AUTH.EMAIL_SETUP_OTP, userId),
      this.cache.delete(cacheConstants.keys.AUTH.EMAIL_SETUP_ATTEMPTS, userId),
      this.cache.delete(cacheConstants.keys.AUTH.EMAIL_SETUP_COOLDOWN, userId),
      createAuditLog(userId, ActionType.TWO_FA_ENABLED, EntityType.USER, userId, {
        description: ACTION_DESCRIPTIONS[ActionType.TWO_FA_ENABLED],
        method: TwoFactorMethod.EMAIL,
      }),
    ]);

    logger.info("Email 2FA enabled", { userId });

    // Return the PLAIN backup codes for user to save (only shown once)
    return { backupCodes: setup.plainBackupCodes };
  }

  /**
   * Send Login OTP (for already enabled Email 2FA)
   */
  static async sendEmailOTP(userId: string, email: string, purpose: string = EmailPurpose.LOGIN): Promise<void> {
    // Check hourly rate limit with auto-lockout
    await this.checkAndIncrementRateLimit(
      cacheConstants.keys.AUTH.EMAIL_OTP_HOURLY,
      userId,
      this.MAX_OTP_REQUESTS_PER_HOUR,
      3600, // 1 hour window
      this.SETUP_LOCKOUT_SECONDS,
      "Too many OTP requests.",
    );

    // Check cooldown
    const recentlySent = await this.cache.exists(cacheConstants.keys.AUTH.EMAIL_OTP_COOLDOWN, userId);

    if (recentlySent) {
      throw AppError.tooManyRequests("Please wait before requesting a new code", "TwoFactorService");
    }

    // Generate and hash code
    const code = this.generateSecureOTP();
    const hashedCode = await JWTService.hashPasswordArgon2(code);
    const expiryTimestamp = Date.now() + this.OTP_EXPIRY_SECONDS * 1000;

    await Promise.all([
      this.cache.set(
        cacheConstants.keys.AUTH.EMAIL_OTP,
        userId,
        {
          hashedCode,
          createdAt: Date.now(),
          expiresAt: expiryTimestamp,
        },
        this.OTP_EXPIRY_SECONDS,
      ),
      this.cache.set(cacheConstants.keys.AUTH.EMAIL_OTP_COOLDOWN, userId, "true", this.OTP_COOLDOWN_SECONDS),
    ]);

    let emailType: EmailType;

    switch (purpose) {
      case EmailPurpose.SETUP:
        emailType = EmailType.TWO_FACTOR_SETUP;
        break;
      case EmailPurpose.ACTION: // For protected routes (delete, change password)
        emailType = EmailType.TWO_FACTOR_ACTION;
        break;
      case EmailPurpose.LOGIN:
      default:
        emailType = EmailType.TWO_FACTOR_LOGIN;
        break;
    }

    // Send email
    const { subject, html } = EmailTemplateService.generateHtml(emailType, {
      code,
      expiryMinutes: Math.floor(this.OTP_EXPIRY_SECONDS / 60),
    });

    await RabbitMQService.addEmailJob({ to: email, subject, html });

    await createAuditLog(userId, ActionType.EMAIL_OTP_SENT, EntityType.USER, userId, {
      description: ACTION_DESCRIPTIONS[ActionType.EMAIL_OTP_SENT],
      email,
      purpose: purpose,
      expiresAt: new Date(expiryTimestamp).toISOString(),
    });

    logger.info("Email OTP sent", {
      userId,
      expiresIn: `${this.OTP_EXPIRY_SECONDS}s`,
    });
  }

  /**
   * Verify Email OTP (for login)
   */
  static async verifyEmailOTP(userId: string, code: string): Promise<boolean> {
    await this.checkVerificationAttempts(userId);

    const otpData = await this.cache.get<{
      hashedCode: string;
      createdAt: number;
      expiresAt: number;
    }>(cacheConstants.keys.AUTH.EMAIL_OTP, userId);

    if (!otpData) {
      await createAuditLog(userId, ActionType.TWO_FA_VERIFICATION_FAILED, EntityType.USER, userId, {
        description: ACTION_DESCRIPTIONS[ActionType.TWO_FA_VERIFICATION_FAILED],
        method: TwoFactorMethod.EMAIL,
        reason: "Code expired or not found",
      });
      throw AppError.badRequest("Verification code expired. Please request a new one.", "TwoFactorService");
    }

    // Additional expiry check
    if (Date.now() > otpData.expiresAt) {
      await this.cache.delete(cacheConstants.keys.AUTH.EMAIL_OTP, userId);
      throw AppError.badRequest("Verification code has expired. Please request a new one.", "TwoFactorService");
    }

    // Verify using constant-time comparison via argon2
    const isValid = await JWTService.verifyPasswordArgon2(otpData.hashedCode, code);

    if (!isValid) {
      await Promise.all([
        this.incrementVerificationAttempts(userId),
        createAuditLog(userId, ActionType.TWO_FA_VERIFICATION_FAILED, EntityType.USER, userId, {
          description: ACTION_DESCRIPTIONS[ActionType.TWO_FA_VERIFICATION_FAILED],
          method: TwoFactorMethod.EMAIL,
          reason: "Invalid code",
        }),
      ]);
      return false;
    }

    await Promise.all([
      this.cache.delete(cacheConstants.keys.AUTH.EMAIL_OTP, userId),
      this.cache.delete(cacheConstants.keys.AUTH.TWO_FA_ATTEMPTS, userId),
      createAuditLog(userId, ActionType.TWO_FA_VERIFICATION_SUCCESS, EntityType.USER, userId, {
        description: ACTION_DESCRIPTIONS[ActionType.TWO_FA_VERIFICATION_SUCCESS],
        method: TwoFactorMethod.EMAIL,
      }),
    ]);

    logger.info("Email OTP verified", { userId });
    return true;
  }

  // ==================== Backup Codes ====================

  static async verifyBackupCode(userId: string, code: string, hashedCodes: string[]): Promise<boolean> {
    for (let i = 0; i < hashedCodes.length; i++) {
      const isValid = await JWTService.verifyPasswordArgon2(hashedCodes[i]!, code);

      if (isValid) {
        const updatedCodes = hashedCodes.filter((_, index) => index !== i);

        await Promise.all([
          prisma.user.update({
            where: { id: userId },
            data: { twoFactorBackupCodes: updatedCodes },
          }),
          createAuditLog(userId, ActionType.BACKUP_CODE_USED, EntityType.USER, userId, {
            description: ACTION_DESCRIPTIONS[ActionType.BACKUP_CODE_USED],
            remainingCodes: updatedCodes.length,
          }),
        ]);

        logger.info("Backup code used", {
          userId,
          remainingCodes: updatedCodes.length,
        });
        return true;
      }
    }

    return false;
  }

  static async regenerateBackupCodes(userId: string): Promise<IBackupCodesData> {
    const backupCodes = this.generateBackupCodes();
    const hashedBackupCodes = await Promise.all(backupCodes.map((code) => JWTService.hashPasswordArgon2(code)));

    await Promise.all([
      prisma.user.update({
        where: { id: userId },
        data: { twoFactorBackupCodes: hashedBackupCodes },
      }),
      createAuditLog(userId, ActionType.BACKUP_CODES_REGENERATED, EntityType.USER, userId, {
        description: ACTION_DESCRIPTIONS[ActionType.BACKUP_CODES_REGENERATED],
        newCodesCount: hashedBackupCodes.length,
      }),
    ]);

    logger.info("Backup codes regenerated", { userId });
    return { backupCodes };
  }

  // ==================== Disable 2FA ====================

  static async disable2FA(userId: string, passwordString: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, twoFactorMethod: true },
    });

    if (!user) {
      throw AppError.notFound("User not found");
    }

    // Verify Password
    const isPasswordValid = await JWTService.verifyPasswordArgon2(user.passwordHash!, passwordString);
    if (!isPasswordValid) {
      throw AppError.unauthorized("Invalid password", "TwoFactorService");
    }

    // Disable 2FA
    await prisma.user.update({
      where: { id: userId },
      data: {
        isTwoFactorEnabled: false,
        twoFactorMethod: TwoFactorMethod.NONE,
        twoFactorSecret: null,
        twoFactorBackupCodes: [],
      },
    });

    // Clear all 2FA related cache keys
    await Promise.all([
      this.cache.delete(cacheConstants.keys.AUTH.TOTP_SETUP, userId),
      this.cache.delete(cacheConstants.keys.AUTH.EMAIL_OTP, userId),
      this.cache.delete(cacheConstants.keys.AUTH.EMAIL_SETUP_OTP, userId),
      this.cache.delete(cacheConstants.keys.AUTH.TWO_FA_ATTEMPTS, userId),
      this.cache.delete(cacheConstants.keys.AUTH.EMAIL_OTP_COOLDOWN, userId),
      this.cache.delete(cacheConstants.keys.AUTH.EMAIL_SETUP_COOLDOWN, userId),
      this.cache.delete(`${cacheConstants.keys.AUTH.EMAIL_SETUP}:attempts`, userId),
      this.cache.delete(`${cacheConstants.keys.AUTH.EMAIL_SETUP}:lockout`, userId),
      this.cache.delete(`${cacheConstants.keys.AUTH.EMAIL_OTP_HOURLY}:attempts`, userId),
      this.cache.delete(`${cacheConstants.keys.AUTH.EMAIL_OTP_HOURLY}:lockout`, userId),
      createAuditLog(userId, ActionType.TWO_FA_DISABLED, EntityType.USER, userId, {
        description: ACTION_DESCRIPTIONS[ActionType.TWO_FA_DISABLED],
        previousMethod: user?.twoFactorMethod,
      }),
    ]);

    logger.info("2FA disabled", { userId });
  }

  // ==================== Helpers ====================

  private static generateBackupCodes(): string[] {
    return Array.from({ length: this.BACKUP_CODES_COUNT }, () => crypto.randomBytes(4).toString("hex").toUpperCase());
  }

  /**
   * Generate cryptographically secure 6-digit OTP
   */
  private static generateSecureOTP(): string {
    // Use crypto.randomInt for secure random numbers
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Universal rate limiting with automatic lockout
   * @param cacheKey - The cache key prefix for this rate limit
   * @param userId - User identifier
   * @param maxAttempts - Maximum attempts allowed
   * @param windowSeconds - Time window in seconds
   * @param lockoutSeconds - Lockout duration after exceeding attempts
   * @param errorMessage - Custom error message
   */
  private static async checkAndIncrementRateLimit(cacheKey: string, userId: string, maxAttempts: number, windowSeconds: number, lockoutSeconds: number, errorMessage: string): Promise<void> {
    const lockoutKey = `${cacheKey}:lockout`;
    const attemptsKey = `${cacheKey}:attempts`;

    // Check if user is locked out
    const isLockedOut = await this.cache.exists(lockoutKey, userId);
    if (isLockedOut) {
      throw AppError.tooManyRequests(`${errorMessage} Please try again later.`, "TwoFactorService");
    }

    // Increment and check attempts
    const attempts = await this.cache.increment(attemptsKey, userId, windowSeconds);

    if (attempts > maxAttempts) {
      // Trigger lockout
      await this.cache.set(lockoutKey, userId, true, lockoutSeconds);

      throw AppError.tooManyRequests(`${errorMessage} Account locked for ${Math.floor(lockoutSeconds / 60)} minutes.`, "TwoFactorService");
    }
  }

  /**
   * Check verification attempts (for OTP/TOTP verification)
   */
  private static async checkVerificationAttempts(userId: string): Promise<void> {
    const attempts = await this.cache.get<number>(cacheConstants.keys.AUTH.TWO_FA_ATTEMPTS, userId);

    if (attempts && attempts >= this.MAX_VERIFICATION_ATTEMPTS) {
      throw AppError.tooManyRequests("Too many failed verification attempts. Please try again later.", "TwoFactorService");
    }
  }

  /**
   * Increment verification attempts
   */
  private static async incrementVerificationAttempts(userId: string): Promise<void> {
    await this.cache.increment(cacheConstants.keys.AUTH.TWO_FA_ATTEMPTS, userId, cacheConstants.ttl.MEDIUM);
  }
}
