import { Redis } from "ioredis";
import type { IReqMetaData, IUser } from "./interfaces.types";

declare global {
  namespace Express {
    interface Request {
      redisClient?: Redis;
      user?: IUser
    }
  }
}

export {};