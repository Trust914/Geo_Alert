import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { agencyApi } from "../services/agency.api";
import type {
  ICreateAgencyDTO,
  IUpdateAgencyDTO,
  IAgencyFilters,
} from "../types/agency.types";
import { toast } from "sonner";
import { QUERY_KEYS } from "../../../lib/reactQuery";


/**
 * Hook to fetch all agencies with filters
 */
export function useAgencies(filters?: IAgencyFilters) {
  return useQuery({
    queryKey: QUERY_KEYS.AGENCIES.LIST(filters),
    queryFn: () => agencyApi.getAllAgencies(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch a single agency by ID
 */
export function useAgencyById(id: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.AGENCIES.BY_ID(id!),
    queryFn: () => agencyApi.getAgencyById(id!),
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch agency statistics
 */
export function useAgencyStats() {
  return useQuery({
    queryKey: QUERY_KEYS.AGENCIES.STATS,
    queryFn: () => agencyApi.getAgencyStats(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to create a new agency
 */
export function useCreateAgency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ICreateAgencyDTO) => agencyApi.createAgency(data),
    onSuccess: (response) => {
      // Invalidate all agency lists and stats
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AGENCIES.ALL });

      toast.success(response.message || "Agency created successfully");
    },
    onError: (error: any) => {
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Failed to create agency";
      toast.error(errorMessage);
    },
  });
}

/**
 * Hook to update an agency
 */
export function useUpdateAgency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agencyId,
      data,
      twoFactorCode,
    }: {
      agencyId: string;
      data: IUpdateAgencyDTO;
      twoFactorCode?: string;
    }) => agencyApi.updateAgency(agencyId, data, twoFactorCode),
    onSuccess: (response, variables) => {
      // Invalidate specific agency detail
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.AGENCIES.BY_ID(variables.agencyId),
      });
      // Invalidate all agency lists and stats
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AGENCIES.ALL });

      toast.success(response.message || "Agency updated successfully");
    },
    onError: (error: any) => {
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Failed to update agency";
      toast.error(errorMessage);
    },
  });
}

/**
 * Hook to delete (deactivate) an agency
 */
export function useDeleteAgency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agencyId,
      twoFactorCode,
    }: {
      agencyId: string;
      twoFactorCode?: string;
    }) => agencyApi.deleteAgency(agencyId, twoFactorCode),
    onSuccess: (response, variables) => {
      // Invalidate specific agency detail
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.AGENCIES.BY_ID(variables.agencyId),
      });
      // Invalidate all agency lists and stats
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AGENCIES.ALL });

      toast.success(response.message || "Agency deleted successfully");
    },
    onError: (error: any) => {
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Failed to delete agency";
      toast.error(errorMessage);
    },
  });
}

/**
 * Hook to reactivate an agency
 */
export function useReactivateAgency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (agencyId: string) => agencyApi.reactivateAgency(agencyId),
    onSuccess: (response, agencyId) => {
      // Invalidate specific agency detail
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.AGENCIES.BY_ID(agencyId),
      });
      // Invalidate all agency lists and stats
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AGENCIES.ALL });

      toast.success(response.message || "Agency reactivated successfully");
    },
    onError: (error: any) => {
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Failed to reactivate agency";
      toast.error(errorMessage);
    },
  });
}