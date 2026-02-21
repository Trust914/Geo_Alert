
export interface IDashboardStats {
  alerts: {
    total: number;
    active: number;
    resolved: number;
    change: number;
  };
  citizens: {
    total: number;
    reached: number;
    change: number;
  };
  agencies: {
    total: number;
    active: number;
    change: number;
  };
  system: {
    uptime: number;
    status: "optimal" | "degraded" | "down";
  };
}

export interface IRecentAlert {
  id: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  location: string;
  createdAt: string;
  status: "active" | "resolved" | "cancelled";
  recipientsCount: number;
}

export interface IActiveRegion {
  id: string;
  name: string;
  alertCount: number;
  lastAlertTime: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export interface IActivityLog {
  id: string;
  type: "alert_sent" | "user_created" | "agency_added" | "system_event";
  description: string;
  userId?: string;
  userName?: string;
  timestamp: string;
}

export interface IDashboardData {
  stats: IDashboardStats;
  recentAlerts: IRecentAlert[];
  activeRegions: IActiveRegion[];
  activityLog: IActivityLog[];
}