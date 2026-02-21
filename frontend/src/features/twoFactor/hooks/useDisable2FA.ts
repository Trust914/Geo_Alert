import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { twoFactorService } from '../services';
import type { Disable2FARequest } from '../types';
import { QUERY_KEYS } from '../../../lib/reactQuery';
import type { APIResponse } from '../../../types/common.types';

export function useDisable2FA() {
  const queryClient = useQueryClient();

  return useMutation({
    // Updated to accept an object containing both password and code
    mutationFn: ({ password, code }: Disable2FARequest & { code?: string }) =>
      twoFactorService.disable2FA({ password }, code),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TWO_FACTOR.STATUS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUTH.ME });
      toast.success('Two-factor authentication disabled');
    },
    onError: (error: AxiosError<APIResponse>) => {
      const message = error.response?.data?.message || 'Failed to disable 2FA. Check your credentials.';
      toast.error(message);
    },
  });
}