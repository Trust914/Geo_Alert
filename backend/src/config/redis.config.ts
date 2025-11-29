import type { RedisOptions } from "ioredis";
import {
  checkIfDefined,
  chooseEnvValue,
  getEnvVariable,
} from "../utils/app.utils.js";

const REDIS_DEV_HOST = checkIfDefined(
  getEnvVariable("REDIS_DEV_HOST"),
  "REDIS_DEV_HOST"
);
const REDIS_DOCKER_HOST = checkIfDefined(
  getEnvVariable("REDIS_DOCKER_HOST"),
  "REDIS_DOCKER_HOST"
);
const REDIS_HOST = chooseEnvValue(REDIS_DEV_HOST, REDIS_DOCKER_HOST);
const REDIS_PORT = Number(
  checkIfDefined(getEnvVariable("REDIS_PORT"), "REDIS_PORT")
);
const REDIS_PASSWORD = checkIfDefined(
  getEnvVariable("REDIS_PASSWORD"),
  "REDIS_PASSWORD"
);


export const REDIS_CONN_CONFIG: RedisOptions = {
  port: REDIS_PORT,
  host: REDIS_HOST,
  password: REDIS_PASSWORD,
  db: 0,
  keyPrefix: "geo-alert",
};
