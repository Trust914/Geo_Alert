import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { authService } from '../services';
import type { ChangePasswordRequest } from '../types';
import type { APIResponse } from '../../../types/common.types';

export function useChangePassword() {
  return useMutation({
    mutationFn: (request: ChangePasswordRequest) => authService.changePassword(request),
    onSuccess: () => {
      toast.success('Password changed successfully. Please login again.');
    },
    onError: (error: AxiosError<APIResponse>) => {
      const message = error.response?.data?.message || 'Failed to change password';
      toast.error(message);
    },
  });
}