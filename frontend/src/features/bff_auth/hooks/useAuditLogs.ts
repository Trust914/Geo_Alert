/**
 * useAuditLogs Hook
 * React Query hooks for BFF audit logs
 */

import { useQuery } from "@tanstack/react-query";
import { bffService } from "../services";
import type { AuditLogFilters } from "../types";
import { QUERY_KEYS } from "../../../lib/reactQuery";

export function useAuditLogs(filters?: AuditLogFilters) {
  return useQuery({
    queryKey: QUERY_KEYS.BFF_AUTH.AUDIT_LOGS(filters),
    queryFn: () => bffService.getAuditLogs(filters),
  });
}

export function useAgencyAuditLogs(filters?: AuditLogFilters) {
  return useQuery({
    queryKey: QUERY_KEYS.BFF_AUTH.AGENCY_AUDIT_LOGS(filters),
    queryFn: () => bffService.getAgencyAuditLogs(filters),
  });
}