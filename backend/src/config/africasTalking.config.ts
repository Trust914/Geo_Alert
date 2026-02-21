import AfricasTalking from "africastalking";
import { checkIfDefined, chooseEnvValue, getEnvVariable } from "../utils/env.utils";
import { logger } from "../utils/logger.util";

export const USSD_ITEMS_PER_PAGE = Number(checkIfDefined(getEnvVariable("USSD_ITEMS_PER_PAGE"), "USSD_ITEMS_PER_PAGE"));
const AT_API_KEY_PROD = checkIfDefined(getEnvVariable("AT_API_KEY_PROD"), "AT_API_KEY_PROD");
const AT_API_KEY_DEV = checkIfDefined(getEnvVariable("AT_API_KEY_DEV"), "AT_API_KEY_DEV");
const AT_API_KEY = chooseEnvValue(AT_API_KEY_DEV, AT_API_KEY_PROD);

const AT_USERNAME_PROD = checkIfDefined(getEnvVariable("AT_USERNAME_PROD"), "AT_USERNAME_PROD");
const AT_USERNAME_DEV = checkIfDefined(getEnvVariable("AT_USERNAME_DEV"), "AT_USERNAME_DEV");
const AT_USERNAME = chooseEnvValue(AT_USERNAME_DEV, AT_USERNAME_PROD);

const AT_SENDER_ID_PROD = checkIfDefined(getEnvVariable("AT_SENDER_ID_PROD"), "AT_SENDER_ID_PROD");
const AT_SENDER_ID_DEV = checkIfDefined(getEnvVariable("AT_SENDER_ID_DEV"), "AT_SENDER_ID_DEV");
const AT_SENDER_ID = chooseEnvValue(AT_SENDER_ID_DEV, AT_SENDER_ID_PROD);

const AT_SHORT_CODE_PROD = checkIfDefined(getEnvVariable("AT_SHORT_CODE_PROD"), "AT_SHORT_CODE_PROD");
const AT_SHORT_CODE_DEV = checkIfDefined(getEnvVariable("AT_SHORT_CODE_DEV"), "AT_SHORT_CODE_DEV");
const AT_SHORT_CODE = chooseEnvValue(AT_SHORT_CODE_DEV, AT_SHORT_CODE_PROD);

const AT_USSD_CODE_PROD = checkIfDefined(getEnvVariable("AT_USSD_CODE_PROD"), "AT_USSD_CODE_PROD");
const AT_USSD_CODE_DEV = checkIfDefined(getEnvVariable("AT_USSD_CODE_DEV"), "AT_USSD_CODE_DEV");
const AT_USSD_CODE = chooseEnvValue(AT_USSD_CODE_DEV, AT_USSD_CODE_PROD);

const AT_MAX_BATCH = Number(checkIfDefined(getEnvVariable("AT_MAX_BATCH"), "AT_MAX_BATCH"));
// Initialize SDK
const africastalking = AfricasTalking({
  apiKey: AT_API_KEY,
  username: AT_USERNAME,
});

export const atSMS: any = africastalking.SMS;

export const AT_CONFIG = {
  apiKey: AT_API_KEY,
  username: AT_USERNAME,
  shortCode: AT_SHORT_CODE,
  senderId: AT_SENDER_ID,
  ussdCode: AT_USSD_CODE,
  maxBatch: AT_MAX_BATCH,
};

logger.debug("Africa's Talking configuration loaded successfully", AT_CONFIG);