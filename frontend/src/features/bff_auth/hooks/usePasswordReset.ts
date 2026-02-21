/**
 * usePasswordReset Hook
 * React Query hooks for BFF password reset flow
 */

import { useQuery, useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { toast } from "sonner";
import type { APIResponse } from "../../../types/common.types";
import { bffService } from "../services";
import type {
  VerifyResetTokenRequest,
  CompletePasswordResetRequest,
  ResendPasswordResetOTPRequest,
} from "../types";

export function useVerifyResetToken(params: VerifyResetTokenRequest) {
  return useQuery({
    queryKey: ["bff", "reset-password", "verify", params.userId, params.token],
    queryFn: () => bffService.verifyResetToken(params),
    enabled: !!params.userId && !!params.token,
    retry: false,
  });
}

export function useCompletePasswordReset() {
  return useMutation({
    mutationFn: (request: CompletePasswordResetRequest) =>
      bffService.completePasswordReset(request),
    onSuccess: () => {
      toast.success(
        "Password reset successfully! Please login with your new password."
      );
    },
    onError: (error: AxiosError<APIResponse>) => {
      const errorData = error.response?.data as
        | (APIResponse & { code?: string })
        | undefined;

      if (errorData?.code === "2FA_REQUIRED") {
        toast.error("Please enter your verification code");
      } else if (errorData?.code === "2FA_INVALID") {
        toast.error("Invalid verification code");
      } else {
        const message = errorData?.message || "Password reset failed";
        toast.error(message);
      }
    },
  });
}

export function useResendPasswordResetOTP() {
  return useMutation({
    mutationFn: (request: ResendPasswordResetOTPRequest) =>
      bffService.resendPasswordResetOTP(request),
    onSuccess: () => {
      toast.success("Verification code sent to your email");
    },
    onError: () => {
      toast.error("Failed to send verification code");
    },
  });
}