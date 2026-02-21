import argon2 from "argon2";
import { checkIfDefined, getEnvVariable } from "../utils/env.utils";

export const ARGON2_HASH_MEMORY_COST = Number(checkIfDefined(getEnvVariable("ARGON2_HASH_MEMORY_COST"), "ARGON2_HASH_MEMORY_COST"));
export const ARGON2_HASH_TIME_COST = Number(checkIfDefined(getEnvVariable("ARGON2_HASH_TIME_COST"), "ARGON2_HASH_TIME_COST"));
export const ARGON2_HASH_PARALLELISM = Number(checkIfDefined(getEnvVariable("ARGON2_HASH_PARALLELISM"), "ARGON2_HASH_PARALLELISM"));
export const ARGON2_HASH_SALT_LENGTH = Number(checkIfDefined(getEnvVariable("ARGON2_HASH_SALT_LENGTH"), "ARGON2_HASH_SALT_LENGTH"));
export const ARGON2_HASH_LENGTH = Number(checkIfDefined(getEnvVariable("ARGON2_HASH_LENGTH"), "ARGON2_HASH_LENGTH"));

export const argon2Config = {
  options: {
    type: argon2.argon2id,
    memoryCost: ARGON2_HASH_MEMORY_COST,
    timeCost: ARGON2_HASH_TIME_COST,
    parallelism: ARGON2_HASH_PARALLELISM,
    hashLength: ARGON2_HASH_LENGTH,
    saltLength: ARGON2_HASH_SALT_LENGTH,
  } as argon2.Options,

  constants: {
    memoryCost: ARGON2_HASH_MEMORY_COST,
    timeCost: ARGON2_HASH_TIME_COST,
    parallelism: ARGON2_HASH_PARALLELISM,
    saltLength: ARGON2_HASH_SALT_LENGTH,
    hashLength: ARGON2_HASH_LENGTH,
  },
};
