import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/useAuth';

export function useLogout() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await logout();
    },
    onSuccess: () => {
      // Clear all cached data
      queryClient.clear();
      navigate('/login', { replace: true });
      toast.success('Logged out successfully');
    },
    onError: () => {
      // Still logout locally even if server call fails
      queryClient.clear();
      navigate('/login', { replace: true });
    },
  });
}