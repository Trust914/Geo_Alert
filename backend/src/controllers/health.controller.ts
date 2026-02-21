import type { Request, Response } from "express";
import statusCodes from "http-status";
import { HealthService } from "../services/health.service.js";
import { ConnectionStatus, HealthStatus, type HealthCheckResponse } from "../types/health.types.js";
import { asyncHandler, formatBytes, formatCpuTime, formatUptime } from "../utils/app.utils.js";
import { serverConfig } from "../config/server.config.js";

export class HealthController {
  static getHealthStatus = asyncHandler(async (req: Request, res: Response) => {
    const startTime = process.hrtime();

    // Run checks in parallel
    const [database, redis, rabbitmq] = await Promise.all([HealthService.checkDatabase(), HealthService.checkRedis(), HealthService.checkRabbitMQ()]);

    // Calculate API response time (high precision)
    const diff = process.hrtime(startTime);
    const responseTime = (diff[0] * 1e9 + diff[1]) / 1e6; // Convert to ms

    // Raw Metrics
    const rawMem = process.memoryUsage();
    const rawCpu = process.cpuUsage();

    const services = { database, redis, rabbitmq };

    // Determine Global Status
    const unhealthyServices = Object.values(services).filter((s) => s.status === HealthStatus.UNHEALTHY);
    const degradedServices = Object.values(services).filter((s) => s.status === HealthStatus.DEGRADED);

    let overallStatus;
    let httpCode;

    if (unhealthyServices.length > 0) {
      overallStatus = HealthStatus.UNHEALTHY;
      httpCode = statusCodes.SERVICE_UNAVAILABLE;
    } else if (degradedServices.length > 0) {
      overallStatus = HealthStatus.DEGRADED;
      httpCode = statusCodes.OK;
    } else {
      overallStatus = HealthStatus.HEALTHY;
      httpCode = statusCodes.OK;
    }

    const response: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: formatUptime(process.uptime()), // Readable uptime
      environment: serverConfig.app.environment,
      version: serverConfig.app.version,
      services: {
        api: {
          status: HealthStatus.HEALTHY,
          responseTime: Number(responseTime.toFixed(2)),
          details: ConnectionStatus.OPERATIONAL,
        },
        ...services,
      },
      system: {
        memory: {
          physicalTotal: formatBytes(rawMem.rss),
          heapTotal: formatBytes(rawMem.heapTotal),
          heapUsed: formatBytes(rawMem.heapUsed),
          externalCPlusPlus: formatBytes(rawMem.external),
          binaryBuffers: formatBytes(rawMem.arrayBuffers),
        },
        cpu: formatCpuTime(rawCpu), // Returns { userProcessTime, osSystemTime }
      },
    };

    res.status(httpCode).json(response);
  });
}
