import * as amqp from "amqplib";
import { checkIfDefined, chooseEnvValue, getEnvVariable } from "../utils/env.utils";

const RABBITMQ_PORT = Number(checkIfDefined(getEnvVariable("RABBITMQ_PORT"), "RABBITMQ_PORT"));
const RABBITMQ_DOCKER_HOST = checkIfDefined(getEnvVariable("RABBITMQ_DOCKER_HOST"), "RABBITMQ_DOCKER_HOST");
const RABBITMQ_DEV_HOST = checkIfDefined(getEnvVariable("RABBITMQ_DEV_HOST"), "RABBITMQ_DEV_HOST");
const RABBITMQ_HOST = chooseEnvValue(RABBITMQ_DEV_HOST, RABBITMQ_DOCKER_HOST);
const RABBITMQ_DEFAULT_USER = checkIfDefined(getEnvVariable("RABBITMQ_DEFAULT_USER"), "RABBITMQ_DEFAULT_USER");
const RABBITMQ_DEFAULT_PASS = checkIfDefined(getEnvVariable("RABBITMQ_DEFAULT_PASS"), "RABBITMQ_DEFAULT_PASS");

const PREPARE_RECIPIENTS_EVENT = checkIfDefined(getEnvVariable("PREPARE_RECIPIENTS_EVENT"), "PREPARE_RECIPIENTS_EVENT");
const PROCESS_BATCH_EVENT = checkIfDefined(getEnvVariable("PROCESS_BATCH_EVENT"), "PROCESS_BATCH_EVENT");
const PROCESS_DELIVERY_EVENT = checkIfDefined(getEnvVariable("PROCESS_DELIVERY_EVENT"), "PROCESS_DELIVERY_EVENT");
const SEND_EMAIL_EVENT = checkIfDefined(getEnvVariable("SEND_EMAIL_EVENT"), "SEND_EMAIL_EVENT");

const RABBITMQ_EXCHANGE = checkIfDefined(getEnvVariable("RABBITMQ_EXCHANGE"), "RABBITMQ_EXCHANGE");
const RABBITMQ_BATCH_SIZE = Number(checkIfDefined(getEnvVariable("RABBITMQ_BATCH_SIZE"), "RABBITMQ_BATCH_SIZE"));

export const rabbitmqConfig = {
  connection: {
    protocol: "amqp",
    hostname: RABBITMQ_HOST,
    port: RABBITMQ_PORT,
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
