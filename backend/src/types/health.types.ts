export type HealthStatus = "Healthy" | "Degraded" | "Unhealthy";

export interface ServiceHealth {
  status: HealthStatus;
  responseTime?: number;
  details?: string;
  error?: string;
}


export interface SystemHealth {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
}

export interface SystemMetrics {
  memory: {
    physicalTotal: string;      // originally 'rss'
    heapTotal: string;          // originally 'heapTotal'
    heapUsed: string;           // originally 'heapUsed'
    externalCPlusPlus: string;  // originally 'external'
    binaryBuffers: string;      // originally'arrayBuffers' 
  };
  cpu: {
    userProcessTime: string;    // originally 'user'
    osSystemTime: string;       // originally'system'
  };
}

export interface HealthCheckResponse {
  status: HealthStatus;
  timestamp: string;
  uptime: string;
  environment: string;
  version: string;
  services: {
    api: ServiceHealth;
    database: ServiceHealth;
    redis: ServiceHealth;
    rabbitmq: ServiceHealth;
  };
  system: SystemMetrics;
}

export const HealthStatus  = {
  HEALTHY: "Healthy",
  DEGRADED: "Degraded",
  UNHEALTHY: "Unhealthy"
} as const


export const ServiceNames = {
  API: "API",
  DATABASE: "Database",
  REDIS: "Redis",
  RABBITMQ: "RabbitMQ"
} as const

export const ConnectionStatus = {
    CONNECTED: "Connected",
    DISCONNECTED: "Disconnected",
    UNREACHABLE : "Unreachable",
    READY: "Ready",
    OPERATIONAL: "Operational"
}