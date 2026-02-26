import { oAuth2Client, SMTP_USER, transporter } from "../../config/smtp.config.js";
import { RabbitMQService } from "../../rabbitmq/rabbitmq.queue.js";
import type { EmailTemplateData, EmailType } from "../../types/email.types.js";
import { AppError } from "../../utils/error.util.js";
import { logger } from "../../utils/logger.util.js";
import { EmailTemplateService } from "./email.templates.service.js";

export class EmailService {
  /**
   * [PUBLIC API] Queue an email to be sent asynchronously
   * Use this method in your Controllers and Services.
   */
  static async send(to: string, type: EmailType, data: EmailTemplateData): Promise<void> {
    try {
      // 1. Generate HTML and Subject
      const { subject, html } = EmailTemplateService.generateHtml(type, data);

      // 2. Queue the email job with pre-generated HTML
      await RabbitMQService.addEmailJob({
        to,
        subject,
        html,
      });

      logger.info(`Email queued successfully`, {
        type,
        to: this.maskEmail(to),
      });
    } catch (error) {
      logger.error(`Failed to queue email`, {
        type,
        to: this.maskEmail(to),
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * [WORKER API] Send the email immediately via SMTP.
   * ONLY the RabbitMQ Worker should call this method.
   */
  static async sendDirect(to: string, subject: string, html: string): Promise<void> {
    try {
      // Manually fetch the Access Token
      // This ensures we have a fresh token before attempting to send
      const { token: accessToken } = await oAuth2Client.getAccessToken();

      if (!accessToken) {
        throw AppError.internal("Failed to generate Access Token");
      }

      // Verify SMTP connection
      await transporter.verify();

      // Send email
      const info = await transporter.sendMail({
        from: `"${EmailTemplateService.APP_NAME} System" <${SMTP_USER}>`,
        to: Array.isArray(to) ? to.join(", ") : to,
        subject: subject,
        html: html,
        auth: {
          user: SMTP_USER,
          accessToken: accessToken,
        },
      });

      logger.info(`Email sent via SMTP`, {
        to: this.maskEmail(to),
        subject,
        info,
      });
    } catch (error) {
      logger.error(`SMTP transmission failed`, {
        to: this.maskEmail(to),
        subject,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw AppError.internal(`Failed to send email: ${error instanceof Error ? error.message : "Unknown error"}`, null, "EmailService", { error });
    }
  }

  /**
   * Mask email for logging privacy
   */
  static maskEmail(email: string): string {
    const [user, domain] = email.split("@");
    return `${user?.substring(0, 3)}***@${domain}`;
  }
}
