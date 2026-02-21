import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { twoFactorService } from '../services';
import type { EmailVerifyRequest } from '../types';
import { QUERY_KEYS } from '../../../lib/reactQuery';

export function useInitiateEmailSetup() {
  return useMutation({
    mutationFn: twoFactorService.initiateEmailSetup,
    onSuccess: (data) => {
      toast.success(`Verification code sent. Expires in ${data.expiresInMinutes} minutes.`);
    },
    onError: () => {
      toast.error('Failed to send verification code');
    },
  });
}

export function useVerifyEmail2FA() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: EmailVerifyRequest) => twoFactorService.verifyAndEnableEmail(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TWO_FACTOR.STATUS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUTH.ME });
      toast.success('Email two-factor authentication enabled');
    },
    onError: () => {
      toast.error('Invalid or expired verification code');
    },
  });
}