import { cacheConstants } from "../config/cache.constants.js";
import { prisma } from "../lib/prisma.js";
import { RabbitMQService } from "../rabbitmq/rabbitmq.queue.js";
import { ConnectionStatus, HealthStatus, ServiceNames, type ServiceHealth } from "../types/health.types.js";
import { getCacheService } from "./cache.service.js";

// Constants for thresholds
const TIMEOUT_MS = 3000; // Fail if check takes > 3s
const DEGRADED_THRESHOLD_MS = 200; // Mark degraded if check takes > 200ms

export class HealthService {
  /**
   * Helper: Enforce timeout on promises
   */
  private static async withTimeout<T>(promise: Promise<T>, serviceName: string): Promise<T> {
    let timeoutId: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`${serviceName} check timed out after ${TIMEOUT_MS}ms`));
      }, TIMEOUT_MS);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId!);
      return result;
    } catch (error) {
      clearTimeout(timeoutId!);
      throw error;
    }
  }

  /**
   * Check Database (Efficient SELECT 1)
   */
  static async checkDatabase(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      await this.withTimeout(prisma.$queryRaw`SELECT 1`, ServiceNames.DATABASE);

      const responseTime = Date.now() - start;

      return {
        status: responseTime < DEGRADED_THRESHOLD_MS ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
        responseTime,
        details: ConnectionStatus.CONNECTED,
      };
    } catch (error) {
      return {
        status: HealthStatus.UNHEALTHY,
        responseTime: Date.now() - start,
        error: (error as Error).message,
        details: ConnectionStatus.UNREACHABLE,
      };
    }
  }

  /**
   * Check Redis (Efficient PING)
   */
  static async checkRedis(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const cache = getCacheService();

      // Try to use PING if available, otherwise fallback to a read check
      if (typeof (cache as any).ping === "function") {
        await this.withTimeout((cache as any).ping(), ServiceNames.REDIS);
      } else {
        // We do not need to set the key. If Redis is running the below line will return null, otherwise, it stalls and network hangs, throwing an error
        const testKey = `${cacheConstants.keys.HEALTH.STATUS}:${Date.now().toString()}:test`;
        await this.withTimeout(cache.get(cacheConstants.keys.HEALTH.STATUS, testKey), ServiceNames.REDIS);
      }

      const responseTime = Date.now() - start;

      return {
        status: responseTime < DEGRADED_THRESHOLD_MS ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
        responseTime,
        details: ConnectionStatus.READY,
      };
    } catch (error) {
      return {
        status: HealthStatus.UNHEALTHY,
        responseTime: Date.now() - start,
        error: (error as Error).message,
        details: ConnectionStatus.UNREACHABLE,
      };
    }
  }

  /**
   * Check RabbitMQ (Connection Status)
   */
  static async checkRabbitMQ(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      // We wrap this in timeout too, just in case the check logic changes later
      const isConnected = await this.withTimeout(RabbitMQService.checkConnection(), ServiceNames.RABBITMQ);

      const responseTime = Date.now() - start;

      if (!isConnected) {
        throw new Error("Connection state is disconnected");
      }

      return {
        status: HealthStatus.HEALTHY,
        responseTime,
        details: ConnectionStatus.CONNECTED,
      };
    } catch (error) {
      return {
        status: HealthStatus.UNHEALTHY,
        responseTime: Date.now() - start,
        error: (error as Error).message,
        details: ConnectionStatus.DISCONNECTED,
      };
    }
  }
}
