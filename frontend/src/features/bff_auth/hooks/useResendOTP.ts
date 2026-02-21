/**
 * useResendOTP Hook
 * React Query mutation for resending OTP codes
 */

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { bffService } from "../services";

export function useResendLoginOTP() {
  return useMutation({
    mutationFn: bffService.resendLoginOTP,
    onSuccess: () => {
      toast.success("Verification code sent");
    },
    onError: () => {
      toast.error("Failed to resend code");
    },
  });
}