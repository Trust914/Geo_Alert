import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { twoFactorService } from '../services';
import type { TOTPVerifyRequest } from '../types';
import { QUERY_KEYS } from '../../../lib/reactQuery';

export function useTOTPSetup() {
  return useMutation({
    mutationFn: twoFactorService.setupTOTP,
    onError: () => {
      toast.error('Failed to setup authenticator');
    },
  });
}

export function useVerifyTOTP() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: TOTPVerifyRequest) => twoFactorService.verifyTOTP(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TWO_FACTOR.STATUS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUTH.ME });
      toast.success('Two-factor authentication enabled successfully');
    },
    onError: () => {
      toast.error('Invalid verification code');
    },
  });
}