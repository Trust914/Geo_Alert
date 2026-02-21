import { useMutation } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import type { CompleteActivationRequest, CompleteActivationResponse, ResendActivationRequest, ResendActivationResponse, VerifyTokenRequest, VerifyTokenResponse } from "../types/activation.types";
import type { APIResponse } from "../../../types/";
import { activationService } from "../services/";

/**
 * Hook to verify activation token
 */
export function useVerifyToken() {
  return useMutation<VerifyTokenResponse, AxiosError<APIResponse>, VerifyTokenRequest>({
    mutationFn: activationService.verifyToken,
  });
}

/**
 * Hook to complete account activation
 */
export function useCompleteActivation() {
  return useMutation<CompleteActivationResponse, AxiosError<APIResponse>, CompleteActivationRequest>({
    mutationFn: activationService.completeActivation,
  });
}

/**
 * Hook to resend activation email
 */
export function useResendActivation() {
  return useMutation<ResendActivationResponse, AxiosError<APIResponse>, ResendActivationRequest>({
    mutationFn: activationService.resendActivationEmail,
  });
}
