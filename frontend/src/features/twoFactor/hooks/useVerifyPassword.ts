// features/auth/hooks/useVerifyPassword.ts

import { useMutation } from '@tanstack/react-query';
import { twoFactorService } from '../services';
import { toast } from 'sonner';

export function useVerifyPassword() {
  return useMutation({
    mutationFn: (password: string) => twoFactorService.verifyPassword(password),
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Password verification failed';
      toast.error(message);
    },
  });
}