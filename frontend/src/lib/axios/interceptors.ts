/**
 * Axios Interceptors - BFF ONLY VERSION
 *
 * CRITICAL: This file sets up interceptors for BFF authentication pattern ONLY.
 * - NO JWT token management
 * - NO manual token refresh
 * - Cookies handle everything
 */

import type { AxiosError } from "axios";
import { bffAxiosInstance } from "./axiosInstance";
import { ENV } from "../../config";

// ============================================================================
// REQUEST INTERCEPTOR - BFF Pattern
// ============================================================================

bffAxiosInstance.interceptors.request.use(
  (config) => {
    // NO TOKEN INJECTION!
    // Browser automatically sends HttpOnly session cookie

    if (ENV.IS_DEV) {
      console.log(`🌐 BFF ${config.method?.toUpperCase()} ${config.url}`);
    }

    return config;
  },
  (error) => {
    console.error("❌ BFF Request error:", error);
    return Promise.reject(error);
  },
);

// ============================================================================
// RESPONSE INTERCEPTOR - BFF Pattern
// ============================================================================

bffAxiosInstance.interceptors.response.use(
  (response) => {
    if (ENV.IS_DEV && response.config.url) {
      console.log(`✅ BFF ${response.config.method?.toUpperCase()} ${response.config.url} → ${response.status}`);
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    // Handle 401 Unauthorized
    // interceptors.ts
    if (status === 401) {
      console.log("🔒 401 - Session expired or invalid");
      window.dispatchEvent(new Event("auth:logout"));

      const publicPaths = ["/login", "/activate-account", "/reset-password", "/bff/verify-2fa"];
      const isOnPublicPath = publicPaths.some((p) => window.location.pathname.includes(p));

      if (!isOnPublicPath) {
        // Use replace to avoid history pollution, no setTimeout race
        window.location.replace("/login");
      }

      return Promise.reject(error);
    }

    // Handle 428 Precondition Required (step-up 2FA)
    if (status === 428) {
      console.log("🔐 428 - Step-up 2FA required");
      // Component will handle by showing modal
    }

    // Handle 403 Forbidden
    if (status === 403) {
      const data = error.response?.data as any;

      if (data?.requiresPasswordChange) {
        console.log("🔑 Password change required");
        if (!window.location.pathname.includes("/change-password")) {
          window.location.href = "/auth/change-password";
        }
      }
    }

    // Handle 429 Too Many Requests
    if (status === 429) {
      console.error("⚠️ 429 - Too many requests. Rate limited!");
      const retryAfter = error.response?.headers?.["retry-after"];
      if (retryAfter) {
        console.log(`Please wait ${retryAfter} seconds before retrying`);
      }
    }

    if (ENV.IS_DEV) {
      console.error(`❌ BFF ${originalRequest.method?.toUpperCase()} ${originalRequest.url} → ${status}`, error.response?.data);
    }

    return Promise.reject(error);
  },
);

export default bffAxiosInstance;
