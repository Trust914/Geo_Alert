import { Redis } from "ioredis";
import type { IPagination, ISortOptions } from "./common.types";
import type { IReqMetaData, IUser } from "./interfaces.types";

declare global {
  namespace Express {
    interface Request {
      redisClient?: Redis;
      user?: Partial<IUser>;
      pagination?: IPagination;
      sort?: ISortOptions;
    }
  }
}

export {};
