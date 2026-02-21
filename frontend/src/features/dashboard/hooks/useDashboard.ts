import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../services/";

/**
 * Hook to fetch full dashboard data
 */
export function useDashboardData() {
  return useQuery({
    queryKey: ["dashboard", "overview"],
    queryFn: () => dashboardApi.getDashboardData(),
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchInterval: 1000 * 60 * 5, // Auto-refetch every 5 minutes
  });
}

/**
 * Hook to fetch dashboard statistics
 */
export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: () => dashboardApi.getDashboardStats(),
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 5,
  });
}

/**
 * Hook to fetch recent alerts
 */
export function useRecentAlerts(limit: number = 5) {
  return useQuery({
    queryKey: ["dashboard", "alerts", "recent", limit],
    queryFn: () => dashboardApi.getRecentAlerts(limit),
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook to fetch active regions
 */
export function useActiveRegions() {
  return useQuery({
    queryKey: ["dashboard", "regions", "active"],
    queryFn: () => dashboardApi.getActiveRegions(),
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook to fetch activity log
 */
export function useActivityLog(limit: number = 10) {
  return useQuery({
    queryKey: ["dashboard", "activity", limit],
    queryFn: () => dashboardApi.getActivityLog(limit),
    staleTime: 1000 * 30, // 30 seconds
  });
}