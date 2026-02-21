import type { Redis } from "ioredis";
import { cacheConstants } from "../config/cache.constants.js";
import { AppError } from "../utils/error.util.js";
import { logger } from "../utils/logger.util.js";
import { serverConfig } from "../config/server.config.js";

export class CacheService {
  private redis: Redis;
  private defaultTTL: number = cacheConstants.ttl.SHORT;
  private readonly APP_NAME = serverConfig.app.name.split("_")[0]?.toLowerCase();

  constructor(redisClient: Redis) {
    this.redis = redisClient;
  }
  public async ping(): Promise<string> {
    return this.redis.ping();
  }

  private generateKey(prefix: string, identifier: string): string {
    return `${this.APP_NAME}:${prefix}:${identifier}`;
  }

  async get<T>(prefix: string, identifier: string): Promise<T | null> {
    try {
      const key = this.generateKey(prefix, identifier);
      const cached = await this.redis.get(key);

      if (!cached) {
        return null;
      }

      return JSON.parse(cached) as T;
    } catch (error) {
      logger.error("Cache get error", {
        prefix,
        identifier,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async set(prefix: string, identifier: string, data: any, ttl: number = this.defaultTTL): Promise<boolean> {
    try {
      const key = this.generateKey(prefix, identifier);
      await this.redis.setex(key, ttl, JSON.stringify(data));
      return true;
    } catch (error) {
      logger.error("Cache set error", {
        prefix,
        identifier,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async delete(prefix: string, identifier: string): Promise<boolean> {
    try {
      const key = this.generateKey(prefix, identifier);
      await this.redis.del(key);
      return true;
    } catch (error) {
      logger.error("Cache delete error", {
        prefix,
        identifier,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  // async deletePattern(pattern: string): Promise<number> {
  //   try {
  //     const keys = await this.redis.keys(`${this.APP_NAME}:${pattern}`);
  //     if (keys.length === 0) return 0;

  //     const deleted = await this.redis.del(...keys);
  //     return deleted;
  //   } catch (error) {
  //     logger.error("Cache delete pattern error", {
  //       pattern,
  //       error: error instanceof Error ? error.message : String(error),
  //     });
  //     return 0;
  //   }
  // }

   async deletePattern(pattern: string): Promise<number> {
    try {
      // If pattern already starts with APP_NAME, use it as-is
      // Otherwise, prepend APP_NAME
      const fullPattern = pattern.startsWith(this.APP_NAME as string)
        ? pattern
        : `${this.APP_NAME}:${pattern}`;

      logger.debug("Deleting cache pattern", {
        originalPattern: pattern,
        fullPattern
      });

      const keys = await this.redis.keys(fullPattern);

      logger.debug("Found keys to delete", {
        pattern: fullPattern,
        count: keys.length,
        keys: keys.slice(0, 10) // Log first 10 for debugging
      });

      if (keys.length === 0) return 0;

      const deleted = await this.redis.del(...keys);

      logger.info("Cache keys deleted", {
        pattern: fullPattern,
        deleted
      });

      return deleted;
    } catch (error) {
      logger.error("Cache delete pattern error", {
        pattern,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  async exists(prefix: string, identifier: string): Promise<boolean> {
    try {
      const key = this.generateKey(prefix, identifier);
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error("Cache exists check error", {
        prefix,
        identifier,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async getOrSet<T>(prefix: string, identifier: string, fetcher: () => Promise<T>, ttl: number = this.defaultTTL): Promise<T> {
    try {
      // Try to get from cache
      const cached = await this.get<T>(prefix, identifier);
      if (cached !== null) {
        return cached;
      }
    } catch (error) {
      // Log cache read failure but continue to fetcher
      logger.warn("Cache read failed, falling back to source", {
        prefix,
        identifier,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      // Fetch from source
      const data = await fetcher();

      // Store in cache (don't await to avoid blocking)
      this.set(prefix, identifier, data, ttl).catch((err) => {
        logger.error("Background cache set failed", {
          prefix,
          identifier,
          error: err instanceof Error ? err.message : String(err),
        });
      });

      return data;
    } catch (error) {
      // Fetcher failed - this is the critical error to throw
      throw AppError.internal("Data fetch failed", error, "CacheService", {
        prefix,
        identifier,
      });
    }
  }
  async increment(prefix: string, identifier: string, ttl?: number): Promise<number> {
    try {
      const key = this.generateKey(prefix, identifier);
      const value = await this.redis.incr(key);

      if (ttl && value === 1) {
        await this.redis.expire(key, ttl);
      }

      return value;
    } catch (error) {
      logger.error("Cache increment error", {
        prefix,
        identifier,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  // async invalidateGroup(group: string): Promise<number> {
  //   return this.deletePattern(`${group}:*`);
  // }

  async invalidateGroup(group: string): Promise<number> {
    // group is like "alert:list" from CACHE_KEYS.ALERT.LIST
    // We want to delete all keys matching: "geo-alertgeoalert:alert:list:*"
    const pattern = `${group}:*`;
    return this.deletePattern(pattern);
  }
}


// Singleton instance
let cacheServiceInstance: CacheService | null = null;

export const initializeCacheService = (redisClient: Redis): CacheService => {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CacheService(redisClient);
    logger.info("Cache service initialized");
  }
  return cacheServiceInstance;
};

export const getCacheService = (): CacheService => {
  if (!cacheServiceInstance) {
    throw new Error("Cache service not initialized. Call initializeCacheService first.");
  }
  return cacheServiceInstance;
};
