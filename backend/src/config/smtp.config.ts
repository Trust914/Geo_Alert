import { checkIfDefined, getEnvVariable } from "../utils/env.utils.js";
import nodemailer from "nodemailer";
import { google } from "googleapis";

export const SMTP_SERVICE = checkIfDefined(getEnvVariable("SMTP_SERVICE"), "SMTP_SERVICE");
export const SMTP_PORT = checkIfDefined(getEnvVariable("SMTP_PORT"), "SMTP_PORT");
export const SMTP_SECURE = checkIfDefined(getEnvVariable("SMTP_SECURE"), "SMTP_SECURE");
export const SMTP_USER = checkIfDefined(getEnvVariable("SMTP_USER"), "SMTP_USER");
export const SMTP_CLIENT_ID = checkIfDefined(getEnvVariable("SMTP_CLIENT_ID"), "SMTP_CLIENT_ID");
export const SMTP_CLIENT_SECRET = checkIfDefined(getEnvVariable("SMTP_CLIENT_SECRET"), "SMTP_CLIENT_SECRET");
export const SMTP_REFRESH_TOKEN = checkIfDefined(getEnvVariable("SMTP_REFRESH_TOKEN"), "SMTP_REFRESH_TOKEN");

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
