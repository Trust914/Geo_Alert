import { getEnvVariable } from "../utils/app.utils";

const PG_DB_USER = getEnvVariable("PG_DB_USER");
const PG_DB_PASSWORD = getEnvVariable("PG_DB_PASSWORD");
const PG_DB_HOST = getEnvVariable("PG_DB_HOST");
const PG_DB_PORT = getEnvVariable("PG_DB_PORT");
const PG_DB_NAME = getEnvVariable("PG_DB_NAME");

export const PG_DATABASE_CONNECTION = `postgresql://${PG_DB_USER}:${PG_DB_PASSWORD}@${PG_DB_HOST}:${PG_DB_PORT}/${PG_DB_NAME}?schema=public`;
