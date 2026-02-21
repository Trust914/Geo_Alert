/**
 * useLogin Hook
 * React Query mutation for BFF login flow
 */

import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { APIResponse } from "../../../types/common.types";
import { TwoFactorMethod } from "../../../types/enums.types";
import { useBFF } from "../context";
import { bffService } from "../services";
import { API_ENDPOINTS } from "../../../utils";

export function useLogin() {
  const navigate = useNavigate();
  const { setAuth } = useBFF();

  return useMutation({
    mutationFn: bffService.login,
    onSuccess: (data) => {
      console.log('✅ Login response:', {
        requiresTwoFactor: data.requiresTwoFactor,
        hasAccessToken: !!data.accessToken,
        hasUser: !!data.user,
        method: data.twoFactorMethod
      });

      // Check if 2FA is required
      if (data.requiresTwoFactor) {
        // Store pre-auth token if present
        navigate(API_ENDPOINTS.BFF_ENDPOINTS.VERIFY_2FA, {
          state: {
            email: data.user?.email,
            method: data.twoFactorMethod || TwoFactorMethod.GOOGLE_AUTHENTICATOR,
            preAuthToken: data.preAuthToken,
          },
          replace: true
        });
        toast.info("Please enter your verification code");
      } else if (data.user) {
        // Full Login Success (No 2FA required)
        console.log('✅ Login successful, setting auth...');
        setAuth(data.user);

        // Small delay to ensure state is updated
        setTimeout(() => {
          if (data.user?.mustChangePassword) {
            navigate(API_ENDPOINTS.BFF_ENDPOINTS.CHANGE_PASSWORD, { replace: true });
            toast.warning("Please change your password");
          } else {
            navigate("/dashboard", { replace: true });
            toast.success(`Welcome back, ${data.user?.firstName}!`);
          }
        }, 100);
      } else {
        // Unexpected response
        console.error('Unexpected login response:', data);
        toast.error("Login failed: Invalid response from server");
      }
    },
    onError: (error: AxiosError<APIResponse>) => {
      console.error('Login error:', error);
      const message =
        error.response?.data?.message || error.message || "Login failed";
      toast.error(message);
    },
  });
}