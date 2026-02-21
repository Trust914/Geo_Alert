import { rabbitmqConfig } from "../config/rabbitmq.config.js";
import type { AlertJobData } from "../types/alert.types.js";
import type { IEmailJob } from "../types/auth.types.js";
import type { ATDeliveryReport } from "../types/sms.types.js";
import { logger } from "../utils/logger.util.js";
import { initializeRabbitMQ, isRabbitMQConnected, publishEvent } from "../utils/rabbitmq.util.js";

// Updated interface for email jobs

export class RabbitMQService {
  /**
   * Initialize RabbitMQ on app startup
   */
  static async initialize(): Promise<void> {
    await initializeRabbitMQ();
    logger.info("RabbitMQ queue service initialized");
  }

  /**
   * Real-time connection check
   */
  static async checkConnection(): Promise<boolean> {
    return isRabbitMQConnected();
  }

  /**
   * Queue alert preparation job
   */
  static async addAlertPreparationJob(data: AlertJobData): Promise<void> {
    await publishEvent(rabbitmqConfig.constants.exchange, rabbitmqConfig.events.PREPARE_RECIPIENTS_EVENT, {
      ...data,
      action: rabbitmqConfig.jobActions.PREPARE_RECIPIENTS,
    });
    logger.info("Alert preparation job queued", { data });
  }

  /**
   * Queue alert batch processing job
   */
  static async addAlertBatchJob(data: AlertJobData): Promise<void> {
    await publishEvent(rabbitmqConfig.constants.exchange, rabbitmqConfig.events.PROCESS_BATCH_EVENT, {
      ...data,
      action: rabbitmqConfig.jobActions.PROCESS_BATCH,
    });
    logger.debug("Alert batch job queued", { alertId: data.alertId, agencyId: data.agencyId });
  }

  /**
   * Queue delivery report processing job
   */
  static async addDeliveryReportJob(data: ATDeliveryReport): Promise<void> {
    await publishEvent(rabbitmqConfig.constants.exchange, rabbitmqConfig.events.PROCESS_DELIVERY_EVENT, {
      ...data,
      action: rabbitmqConfig.jobActions.PROCESS_DELIVERY,
    });
    logger.debug("Delivery report job queued", { messageId: data.id });
  }

  /**
   * Queue an email for background sending
   * Now accepts pre-generated HTML and subject
   */
  static async addEmailJob(data: IEmailJob): Promise<void> {
    await publishEvent(rabbitmqConfig.constants.exchange, rabbitmqConfig.events.SEND_EMAIL_EVENT, {
      to: data.to,
      subject: data.subject,
      html: data.html,
      action: rabbitmqConfig.jobActions.SEND_EMAIL,
    });
    logger.debug("Email job queued", {
      recipient: data.to,
      subject: data.subject,
    });
  }
}
