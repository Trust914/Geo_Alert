import { bffAxiosInstance } from "../../../lib/axios";
import { API_ENDPOINTS } from "../../../utils";
import type { IDashboardData, IDashboardStats } from "../types/";

/**
 * Dashboard API service that aggregates data from existing endpoints
 * since there are no dedicated dashboard endpoints yet
 */
export const dashboardApi = {
  /**
   * Get dashboard statistics by aggregating data from multiple endpoints
   */
  getDashboardStats: async (): Promise<{ success: boolean; data: IDashboardStats }> => {
    try {
      // Fetch data from existing endpoints in parallel
      const [agencyStats, alertsResponse] = await Promise.all([
        bffAxiosInstance.get(API_ENDPOINTS.AGENCIES.STATS).catch(() => ({ data: { data: null } })),
        bffAxiosInstance.get("/alert?currentPage=1&limit=1").catch(() => ({ data: { pagination: { total: 0 } } })),
        bffAxiosInstance.get("/user/agency/current?currentPage=1&limit=1").catch(() => ({ data: { pagination: { total: 0 } } })),
      ]);

      // Aggregate the stats
      const stats: IDashboardStats = {
        alerts: {
          total: alertsResponse.data.pagination?.total || 0,
          active: 0, // Will be calculated from alerts
          resolved: 0,
          change: 0,
        },
        citizens: {
          total: 0, // No endpoint available yet
          reached: 0,
          change: 0,
        },
        agencies: {
          total: agencyStats.data.data?.total || 0,
          active: agencyStats.data.data?.active || 0,
          change: 0,
        },
        system: {
          uptime: 99.9,
          status: "optimal",
        },
      };

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      throw error;
    }
  },

  /**
   * Get recent alerts for dashboard
   * Uses existing alert endpoint with filters
   */
  getRecentAlerts: async (limit: number = 5) => {
    try {
      const response = await bffAxiosInstance.get(`/alert?currentPage=1&limit=${limit}&sortBy=createdAt&sortOrder=desc`);

      // Transform alert data to match dashboard format
      const alerts = response.data.data?.map((alert: any) => ({
        id: alert.id,
        title: alert.headline,
        description: alert.description,
        severity: alert.severity,
        location: alert.area || "Multiple Locations",
        createdAt: alert.createdAt,
        status: alert.status,
        recipientsCount: alert.recipientsCount || 0,
      })) || [];

      return {
        success: true,
        data: alerts,
      };
    } catch (error) {
      console.error("Error fetching recent alerts:", error);
      return {
        success: true,
        data: [],
      };
    }
  },

  /**
   * Get active regions data
   * For now, returns mock data until region endpoint is available
   */
  getActiveRegions: async () => {
    try {
      // TODO: Replace with actual endpoint when available
      // For now, return empty array or fetch from alerts with location data
      const response = await bffAxiosInstance.get("/alert?status=SENT&currentPage=1&limit=10");

      // Extract unique regions from alerts
      const regions = new Map();
      response.data.data?.forEach((alert: any) => {
        if (alert.area) {
          const existing = regions.get(alert.area);
          if (existing) {
            existing.alertCount++;
            existing.lastAlertTime = new Date(alert.createdAt) > new Date(existing.lastAlertTime)
              ? alert.createdAt
              : existing.lastAlertTime;
          } else {
            regions.set(alert.area, {
              id: alert.area.toLowerCase().replace(/\s+/g, '-'),
              name: alert.area,
              alertCount: 1,
              lastAlertTime: alert.createdAt,
              coordinates: { lat: 0, lng: 0 }, // Will need proper geo data
            });
          }
        }
      });

      return {
        success: true,
        data: Array.from(regions.values()),
      };
    } catch (error) {
      console.error("Error fetching active regions:", error);
      return {
        success: true,
        data: [],
      };
    }
  },

  /**
   * Get activity log
   * For now, returns recent alerts and user activities
   */
  getActivityLog: async (limit: number = 10) => {
    try {
      // Fetch recent alerts to build activity log
      const alertsResponse = await bffAxiosInstance.get(`/alert?currentPage=1&limit=${limit}&sortBy=createdAt&sortOrder=desc`);

      const activities = alertsResponse.data.data?.map((alert: any) => ({
        id: alert.id,
        type: "alert_sent",
        description: `Alert "${alert.headline}" sent to ${alert.recipientsCount || 0} citizens`,
        userId: alert.createdBy,
        userName: alert.createdByUser?.firstName && alert.createdByUser?.lastName
          ? `${alert.createdByUser.firstName} ${alert.createdByUser.lastName}`
          : undefined,
        timestamp: alert.createdAt,
      })) || [];

      return {
        success: true,
        data: activities,
      };
    } catch (error) {
      console.error("Error fetching activity log:", error);
      return {
        success: true,
        data: [],
      };
    }
  },

  /**
   * Get complete dashboard data
   * Aggregates all dashboard sections
   */
  getDashboardData: async (): Promise<{ success: boolean; data: IDashboardData }> => {
    try {
      const [stats, recentAlerts, activeRegions, activityLog] = await Promise.all([
        dashboardApi.getDashboardStats(),
        dashboardApi.getRecentAlerts(5),
        dashboardApi.getActiveRegions(),
        dashboardApi.getActivityLog(10),
      ]);

      return {
        success: true,
        data: {
          stats: stats.data,
          recentAlerts: recentAlerts.data,
          activeRegions: activeRegions.data,
          activityLog: activityLog.data,
        },
      };
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      throw error;
    }
  },
};