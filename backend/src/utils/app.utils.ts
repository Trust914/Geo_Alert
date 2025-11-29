import { AppError } from "./error.util";
import statusCodes from "http-status";

export const getEnvVariable = (key: string) => {
  const value = process.env[key];
  if (value === undefined) {
    console.warn(
      `Environment variable ${key} is not defined and no default value provided`
    );
  }
  return value;
};


export const chooseEnvValue = (devValue: string, prodValue: string): string => {
  const nodeEnv = getEnvVariable("NODE_ENV");
  return nodeEnv === "development" ? devValue : prodValue;
};

export const checkIfDefined = <T>(val: T | undefined, name: string): T => {
  if (val === undefined || val == null) {
    throw new AppError({
      name: "ParameterError",
      message: `Parameter :${name} is required but is undefined`,
      statusCode: statusCodes.BAD_REQUEST,
      handler: "CheckIfDefinedUtil",
      isOperational: true,
      details: { val },
    });
  }
  return val;
};