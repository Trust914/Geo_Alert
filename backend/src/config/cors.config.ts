import statusCodes from "http-status";
import { AppError } from "../utils/error.util.js";

export const corsConfig = (allowedUrls: Array<string>): Record<string, any> => {
  return {
    origin: (origin: string | undefined | null, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || allowedUrls.indexOf(origin) !== -1) {
        return callback(null, true);
      } else {
        const originError = new AppError({
          name: `InvalidOriginError`,
          message: `The origin ${origin} is not allowed by CORS`,
          statusCode: statusCodes.FORBIDDEN,
          handler: "CORSConfig",
          isOperational: true,
        });
        return callback(originError);
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept-Version", "x-user-id", "x-session-id", "x-authenticated", "x-user-role", "x-2fa-code", "ngrok-skip-browser-warning", "Ngrok-Skip-Browser-Warning", "Bypass-Tunnel-Reminder", "bypass-Tunnel-Reminder"],
    exposedHeaders: ["Content-Range", "X-Content-Range", "x-user-id", "x-session-id", "x-authenticated", "x-user-role"],
    credentials: true,
    maxAge: 600, // (600/60)=10 mins
    preflightContinue: false, // Controls whether the Express server should process preflight OPTIONS requests
    optionsSuccessStatus: statusCodes.NO_CONTENT, // Sets the HTTP status code for successful preflight requests.
  };
};
