import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { authService } from '../services';
import { QUERY_KEYS } from '../../../lib/reactQuery';

export function useSessions() {
  return useQuery({
    queryKey: QUERY_KEYS.AUTH.SESSIONS,
    queryFn: authService.getSessions,
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => authService.revokeSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUTH.SESSIONS });
      toast.success('Session revoked successfully');
    },
    onError: () => {
      toast.error('Failed to revoke session');
    },
  });
}