/**
 * useSessions Hook
 * React Query hooks for BFF session management
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { bffService } from "../services";
import { QUERY_KEYS } from "../../../lib/reactQuery";

export function useSessions() {
  return useQuery({
    queryKey: QUERY_KEYS.BFF_AUTH.SESSIONS,
    queryFn: bffService.getSessions,
  });
}

/**
 * useSessionStatus
 *
 * FIX: Removed `refetchInterval` here. The BFFProvider already polls
 * /bff/session/status on a 5-minute interval. Having a second independent
 * poller from React Query was causing duplicate requests and, worse, could
 * race with the provider's own refresh — producing a 401 mid-refresh that
 * the interceptor misread as a genuine session expiry, kicking the user out.
 *
 * If you need the latest session status in a component, either:
 *   a) Read `sessionStatus` directly from `useBFF()`, or
 *   b) Call `refreshSession()` from `useBFF()` imperatively.
 */
export function useSessionStatus() {
  return useQuery({
    queryKey: QUERY_KEYS.BFF_AUTH.SESSION_STATUS,
    queryFn: bffService.getSessionStatus,
    // No refetchInterval — BFFProvider owns the polling lifecycle.
    staleTime: 5 * 60 * 1000,
  });
}

interface RevokeSessionRequest {
  sessionId: string;
  twoFactorCode: string;
}

export function useRevokeSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, twoFactorCode }: RevokeSessionRequest) => bffService.revokeSession(sessionId, twoFactorCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BFF_AUTH.SESSIONS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BFF_AUTH.SESSION_STATUS });
      toast.success("Session revoked successfully");
    },
    onError: () => {
      toast.error("Failed to revoke session");
    },
  });
}
