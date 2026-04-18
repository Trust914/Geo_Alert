/**
 * useVerify2FA Hook
 * React Query mutation for completing 2FA verification
 */

import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { APIResponse } from "../../../types/common.types";
import { useBFF } from "../context";
import { bffService } from "../services";
import type { TwoFactorVerifyRequest } from "../types";
import { API_ENDPOINTS } from "../../../utils";

export function useVerify2FA() {
  const navigate = useNavigate();
  const { setAuth } = useBFF();

  return useMutation({
    mutationFn: (request: TwoFactorVerifyRequest) => bffService.verify2FA(request),
    onSuccess: (data) => {
      setAuth(data.user);

      // Small delay to show success state
      setTimeout(() => {
        if (data.user.mustChangePassword) {
          navigate(API_ENDPOINTS.BFF_ENDPOINTS.CHANGE_PASSWORD, { replace: true });
          toast.warning("Please change your password");
        } else {
          navigate("/dashboard", { replace: true });
          toast.success("Login successful");
        }
      }, 1000);
    },
    onError: (error: AxiosError<APIResponse>) => {
      const message = error.response?.data?.message || "Invalid verification code. Please try again.";
      toast.error(message);
    },
  });
}
