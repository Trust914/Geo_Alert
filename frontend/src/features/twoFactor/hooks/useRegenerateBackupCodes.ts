import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { twoFactorService } from '../services';
import type { APIResponse } from '../../../types/common.types';

export function useRegenerateBackupCodes() {
  return useMutation({
    // Updated to accept code
    mutationFn: (code?: string) => twoFactorService.regenerateBackupCodes(code),
    onSuccess: () => {
      toast.success('New backup codes generated');
    },
    onError: (error: AxiosError<APIResponse>) => {
      const message = error.response?.data?.message || 'Failed to regenerate backup codes';
      toast.error(message);
    },
  });
}