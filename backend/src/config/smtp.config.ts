import { checkIfDefined, getEnvVariable, getSecret } from "../utils/env.utils.js";
import nodemailer from "nodemailer";
import { google } from "googleapis";

// ── Non-sensitive config — plain env vars ────────────────────
export const SMTP_SERVICE = checkIfDefined(getEnvVariable("SMTP_SERVICE"), "SMTP_SERVICE");
export const SMTP_PORT = checkIfDefined(getEnvVariable("SMTP_PORT"), "SMTP_PORT");
export const SMTP_SECURE = checkIfDefined(getEnvVariable("SMTP_SECURE"), "SMTP_SECURE");

// ── Sensitive secrets ─────────────────────────────────────────
// dev:          reads from .env  (throws if missing)
// staging|prod: reads from /run/secrets/smtp_client_secret|smtp_refresh_token  (throws if missing or empty)
export const SMTP_CLIENT_SECRET = getSecret("smtp_client_secret", "SMTP_CLIENT_SECRET");
export const SMTP_REFRESH_TOKEN = getSecret("smtp_refresh_token", "SMTP_REFRESH_TOKEN");
export const SMTP_USER = getSecret("smtp_user", "SMTP_USER");
export const SMTP_CLIENT_ID = getSecret("smtp_client_id", "SMTP_CLIENT_ID");

export const oAuth2Client = new google.auth.OAuth2(SMTP_CLIENT_ID, SMTP_CLIENT_SECRET, "https://developers.google.com/oauthplayground");

oAuth2Client.setCredentials({
  refresh_token: SMTP_REFRESH_TOKEN,
});

export const transporter = nodemailer.createTransport({
  service: SMTP_SERVICE,
  port: parseInt(SMTP_PORT),
  secure: SMTP_SECURE === "true",
  auth: {
    type: "OAuth2",
    user: SMTP_USER,
    clientId: SMTP_CLIENT_ID,
    clientSecret: SMTP_CLIENT_SECRET,
    refreshToken: SMTP_REFRESH_TOKEN,
  },
});
