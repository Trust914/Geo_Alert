import * as amqp from "amqplib";
import { checkIfDefined, chooseEnvValue, getEnvVariable, getSecret } from "../utils/env.utils.js";

// ── Non-sensitive config — plain env vars ────────────────────
const RABBITMQ_DEV_PORT = Number(checkIfDefined(getEnvVariable("RABBITMQ_DEV_PORT"), "RABBITMQ_DEV_PORT"));
const RABBITMQ_DOCKER_PORT = Number(checkIfDefined(getEnvVariable("RABBITMQ_DOCKER_PORT"), "RABBITMQ_DOCKER_PORT"));
const RABBITMQ_PORT = chooseEnvValue(RABBITMQ_DEV_PORT.toString(), RABBITMQ_DOCKER_PORT.toString());

const RABBITMQ_DOCKER_HOST = checkIfDefined(getEnvVariable("RABBITMQ_DOCKER_HOST"), "RABBITMQ_DOCKER_HOST");
const RABBITMQ_DEV_HOST = checkIfDefined(getEnvVariable("RABBITMQ_DEV_HOST"), "RABBITMQ_DEV_HOST");
const RABBITMQ_HOST = chooseEnvValue(RABBITMQ_DEV_HOST, RABBITMQ_DOCKER_HOST);

const PREPARE_RECIPIENTS_EVENT = checkIfDefined(getEnvVariable("PREPARE_RECIPIENTS_EVENT"), "PREPARE_RECIPIENTS_EVENT");
const PROCESS_BATCH_EVENT = checkIfDefined(getEnvVariable("PROCESS_BATCH_EVENT"), "PROCESS_BATCH_EVENT");
const PROCESS_DELIVERY_EVENT = checkIfDefined(getEnvVariable("PROCESS_DELIVERY_EVENT"), "PROCESS_DELIVERY_EVENT");
const SEND_EMAIL_EVENT = checkIfDefined(getEnvVariable("SEND_EMAIL_EVENT"), "SEND_EMAIL_EVENT");
const RABBITMQ_EXCHANGE = checkIfDefined(getEnvVariable("RABBITMQ_EXCHANGE"), "RABBITMQ_EXCHANGE");
const RABBITMQ_BATCH_SIZE = Number(checkIfDefined(getEnvVariable("RABBITMQ_BATCH_SIZE"), "RABBITMQ_BATCH_SIZE"));

// ── Sensitive secrets ─────────────────────────────────────────
// dev:          reads from .env  (throws if missing)
// staging|prod: reads from /run/secrets/rabbitmq_user|rabbitmq_password  (throws if missing or empty)
const RABBITMQ_DEFAULT_USER = getSecret("rabbitmq_user", "RABBITMQ_DEFAULT_USER");
const RABBITMQ_DEFAULT_PASS = getSecret("rabbitmq_password", "RABBITMQ_DEFAULT_PASS");

export const rabbitmqConfig = {
  connection: {
    protocol: "amqp",
    hostname: RABBITMQ_HOST,
    port: Number(RABBITMQ_PORT),
    username: RABBITMQ_DEFAULT_USER,
    password: RABBITMQ_DEFAULT_PASS,
  } as amqp.Options.Connect,

  events: {
    PREPARE_RECIPIENTS_EVENT,
    PROCESS_BATCH_EVENT,
    PROCESS_DELIVERY_EVENT,
    SEND_EMAIL_EVENT,
  },

  jobActions: {
    PREPARE_RECIPIENTS: "PREPARE_RECIPIENTS",
    PROCESS_BATCH: "PROCESS_BATCH",
    PROCESS_DELIVERY: "PROCESS_DELIVERY",
    SEND_EMAIL: "SEND_EMAIL",
  },

  constants: {
    exchange: RABBITMQ_EXCHANGE,
    batchSize: RABBITMQ_BATCH_SIZE,
  },
};
