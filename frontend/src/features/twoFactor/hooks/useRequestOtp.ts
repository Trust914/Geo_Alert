import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { twoFactorService } from '../services';

export function useRequestOtp() {
  return useMutation({
    mutationFn: twoFactorService.requestOTP,
    onSuccess: () => {
      toast.success('Verification code sent to your email');
    },
    onError: () => {
      toast.error('Failed to send verification code');
    },
  });
}