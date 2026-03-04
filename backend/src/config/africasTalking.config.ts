import AfricasTalking from "africastalking";
import { checkIfDefined, chooseEnvValue, getEnvVariable, getSecret } from "../utils/env.utils.js";

// ── Non-sensitive config — plain env vars ────────────────────
export const USSD_ITEMS_PER_PAGE = Number(checkIfDefined(getEnvVariable("USSD_ITEMS_PER_PAGE"), "USSD_ITEMS_PER_PAGE"));
const AT_USERNAME_DEV = checkIfDefined(getEnvVariable("AT_USERNAME_DEV"), "AT_USERNAME_DEV");
const AT_USERNAME_PROD = checkIfDefined(getEnvVariable("AT_USERNAME_PROD"), "AT_USERNAME_PROD");
const AT_USERNAME = chooseEnvValue(AT_USERNAME_DEV, AT_USERNAME_PROD);
const AT_SENDER_ID_DEV = checkIfDefined(getEnvVariable("AT_SENDER_ID_DEV"), "AT_SENDER_ID_DEV");
const AT_SENDER_ID_PROD = checkIfDefined(getEnvVariable("AT_SENDER_ID_PROD"), "AT_SENDER_ID_PROD");
const AT_SENDER_ID = chooseEnvValue(AT_SENDER_ID_DEV, AT_SENDER_ID_PROD);
const AT_SHORT_CODE_DEV = checkIfDefined(getEnvVariable("AT_SHORT_CODE_DEV"), "AT_SHORT_CODE_DEV");
const AT_SHORT_CODE_PROD = checkIfDefined(getEnvVariable("AT_SHORT_CODE_PROD"), "AT_SHORT_CODE_PROD");
const AT_SHORT_CODE = chooseEnvValue(AT_SHORT_CODE_DEV, AT_SHORT_CODE_PROD);
const AT_USSD_CODE_DEV = checkIfDefined(getEnvVariable("AT_USSD_CODE_DEV"), "AT_USSD_CODE_DEV");
const AT_USSD_CODE_PROD = checkIfDefined(getEnvVariable("AT_USSD_CODE_PROD"), "AT_USSD_CODE_PROD");
const AT_USSD_CODE = chooseEnvValue(AT_USSD_CODE_DEV, AT_USSD_CODE_PROD);
const AT_MAX_BATCH = Number(checkIfDefined(getEnvVariable("AT_MAX_BATCH"), "AT_MAX_BATCH"));

// ── Sensitive secrets ─────────────────────────────────────────
// dev:              reads from .env (throws if missing)
// staging|prod:     reads from /run/secrets/<n> (throws if missing or empty)
const AT_API_KEY_DEV = getSecret("at_api_key_dev", "AT_API_KEY_DEV");
// const AT_API_KEY_PROD = getSecret("at_api_key_prod", "AT_API_KEY_PROD");
// const AT_API_KEY = chooseEnvValue(AT_API_KEY_DEV, AT_API_KEY_PROD);

// ── Initialize SDK ───────────────────────────────────────────
const africastalking = AfricasTalking({
  apiKey: AT_API_KEY_DEV,
  username: AT_USERNAME,
});

export const atSMS: any = africastalking.SMS;

export const AT_CONFIG = {
  apiKey: AT_API_KEY_DEV,
  username: AT_USERNAME,
  shortCode: AT_SHORT_CODE,
  senderId: AT_SENDER_ID,
  ussdCode: AT_USSD_CODE,
  maxBatch: AT_MAX_BATCH,
};