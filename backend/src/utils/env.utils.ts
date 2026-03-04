import { readFileSync } from "fs";
import statusCodes from "http-status";
import { AppError } from "./error.util.js";

const nodeEnv = process.env.NODE_ENV;

export const getEnvVariable = (key: string): string | undefined => {
  const value = process.env[key];
  if (value === undefined) {
    console.warn(`Environment variable ${key} is not defined and no default value provided`);
  }
  return value;
};

export const getSecret = (secretName: string, envKey: string): string => {


  if (nodeEnv === "development") {
    const value = process.env[envKey];
    if (!value) {
      throw new AppError({
        name: "ConfigurationError",
        message: `[DEV] Environment variable "${envKey}" is required but not set`,
        statusCode: statusCodes.INTERNAL_SERVER_ERROR,
        handler: "getSecret",
        isOperational: false,
        details: { envKey },
      });
    }
    return value;
  }

  // staging | production — read from Docker secret file
  const secretPath = `/run/secrets/${secretName}`;
  try {
    const value = readFileSync(secretPath, "utf-8").trim();
    if (!value) {
      throw new AppError({
        name: "ConfigurationError",
        message: `[${nodeEnv}] Secret file "${secretPath}" exists but is empty`,
        statusCode: statusCodes.INTERNAL_SERVER_ERROR,
        handler: "GetSecretUtil",
        isOperational: false,
        details: { secretPath },
      });
    }
    return value;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError({
      name: "ConfigurationError",
      message: `[${nodeEnv}] Secret file "${secretPath}" could not be read — is it mounted?`,
      statusCode: statusCodes.INTERNAL_SERVER_ERROR,
      handler: "GetSecretUtil",
      isOperational: false,
      details: { secretPath, cause: (err as NodeJS.ErrnoException).code },
    });
  }
};

export const chooseEnvValue = (devValue: string, prodValue: string): string => {
  const nodeEnv = getEnvVariable("NODE_ENV");
  return nodeEnv === "development" ? devValue : prodValue;
};

export const checkIfDefined = <T>(val: T | undefined, name: string): T => {
  if (val === undefined || val == null) {
    throw new AppError({
      name: "ConfigurationError",
      message: `[${nodeEnv}] Configuration value "${name}" is required but is undefined`,
      statusCode: statusCodes.BAD_REQUEST,
      handler: "CheckIfDefinedUtil",
      isOperational: true,
      details: { val },
    });
  }
  return val;
};