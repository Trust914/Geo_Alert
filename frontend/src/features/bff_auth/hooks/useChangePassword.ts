/**
 * useChangePassword Hook
 * React Query mutation for BFF password change (requires step-up 2FA)
 */

import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { toast } from "sonner";
import type { APIResponse } from "../../../types/common.types";
import { bffService } from "../services";
import type { ChangePasswordRequest } from "../types";

interface ChangePasswordWithCodeRequest extends ChangePasswordRequest {
  twoFactorCode: string;
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ twoFactorCode, ...request }: ChangePasswordWithCodeRequest) =>
      bffService.changePassword(request, twoFactorCode),
    onSuccess: () => {
      toast.success("Password changed successfully. Please login again.");
    },
    onError: (error: AxiosError<APIResponse>) => {
      const message =
        error.response?.data?.message || "Failed to change password";
      toast.error(message);
    },
  });
}