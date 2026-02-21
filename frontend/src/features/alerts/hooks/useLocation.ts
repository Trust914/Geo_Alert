import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "../../../lib/reactQuery";
import type { APIResponse } from "../../../types/";
import { API_ENDPOINTS } from "../../../utils/";
import type { AdminArea } from "../types/";
import { bffAxiosInstance } from "../../../lib/axios";

// 24 Hours in milliseconds
const REFERENCE_DATA_GC_TIME = 1000 * 60 * 60 * 24;
//

export function useStates() {
  return useQuery({
    queryKey: QUERY_KEYS.LOCATIONS.STATES,
    queryFn: async () => {
      const { data } = await bffAxiosInstance.get<APIResponse<AdminArea[]>>(API_ENDPOINTS.LOCATIONS.STATES);
      return data.data;
    },
    staleTime: Infinity,
    gcTime: REFERENCE_DATA_GC_TIME, // Reference data doesn't change during a session
  });
}

export function useLGAs(stateId?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.LOCATIONS.LGAS(stateId || ""),
    queryFn: async () => {
      if (!stateId) return [];
      const { data } = await bffAxiosInstance.get<APIResponse<AdminArea[]>>(API_ENDPOINTS.LOCATIONS.LGAS(stateId));
      return data.data;
    },
    enabled: !!stateId,
    staleTime: Infinity,
    gcTime: REFERENCE_DATA_GC_TIME,
  });
}

export function useWards(lgaId?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.LOCATIONS.WARDS(lgaId || ""),
    queryFn: async () => {
      if (!lgaId) return [];
      const { data } = await bffAxiosInstance.get<APIResponse<AdminArea[]>>(API_ENDPOINTS.LOCATIONS.WARDS(lgaId));
      return data.data;
    },
    enabled: !!lgaId,
    staleTime: Infinity,
    gcTime: REFERENCE_DATA_GC_TIME,
  });
}
