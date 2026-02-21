import { Bell, Building2, Activity, AlertCircle, RefreshCw } from "lucide-react";
// import { useAuth } from "../../auth/context";
import { useDashboardStats, useRecentAlerts, useActiveRegions, useActivityLog } from "../hooks/";
import { StatCard, RecentAlertsCard, ActiveRegionsCard, ActivityFeed, QuickActions } from "../components/";
import { useBFF } from "../../bff_auth/context";

export default function DashboardPage() {
  // const { user } = useAuth();

  const { user } = useBFF();

  // Fetch dashboard data
  const { data: statsData, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useDashboardStats();
  const { data: alertsData, isLoading: alertsLoading, error: alertsError } = useRecentAlerts(5);
  const { data: regionsData, isLoading: regionsLoading } = useActiveRegions();
  const { data: activityData, isLoading: activityLoading } = useActivityLog(10);

  const stats = statsData?.data;
  const recentAlerts = alertsData?.data || [];
  const activeRegions = regionsData?.data || [];
  const activities = activityData?.data || [];

  // Define stats configuration
  const statsConfig = [
    {
      name: "Active Alerts",
      value: stats?.alerts.active.toString() || "0",
      icon: Bell,
      change: stats?.alerts.change ? `${stats.alerts.change > 0 ? "+" : ""}${stats.alerts.change}` : undefined,
      trend: stats?.alerts.change ? (stats.alerts.change > 0 ? "up" : stats.alerts.change < 0 ? "down" : "neutral") : "neutral",
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-500/10",
      border: "border-emerald-100 dark:border-emerald-500/20",
    },
    {
      name: "Total Alerts",
      value: stats?.alerts.total.toString() || "0",
      icon: Bell,
      change: undefined,
      trend: "neutral" as const,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-500/10",
      border: "border-blue-100 dark:border-blue-500/20",
    },
    {
      name: "Active Agencies",
      value: stats?.agencies.active.toString() || "0",
      icon: Building2,
      change: stats?.agencies.change ? `${stats.agencies.change > 0 ? "+" : ""}${stats.agencies.change}` : "Stable",
      trend: stats?.agencies.change ? (stats.agencies.change > 0 ? "up" : stats.agencies.change < 0 ? "down" : "neutral") : "neutral",
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-500/10",
      border: "border-purple-100 dark:border-purple-500/20",
    },
    {
      name: "System Status",
      value: stats?.system.uptime ? `${stats.system.uptime.toFixed(1)}%` : "99.9%",
      icon: Activity,
      change: stats?.system.status === "optimal" ? "Optimal" : stats?.system.status === "degraded" ? "Degraded" : "Down",
      trend: stats?.system.status === "optimal" ? "up" : stats?.system.status === "degraded" ? "neutral" : "down",
      color: "text-indigo-600",
      bg: "bg-indigo-50 dark:bg-indigo-500/10",
      border: "border-indigo-100 dark:border-indigo-500/20",
    },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Overview</h1>
          <p className="text-gray-500 dark:text-gray-400">Welcome back, {user?.firstName || "User"}</p>
        </div>
        <QuickActions />
      </div>

      {/* Stats Grid */}
      {statsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : statsError ? (
        <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
              <p className="text-sm text-yellow-800 dark:text-yellow-300">Unable to load dashboard statistics. Some data may be unavailable.</p>
            </div>
            <button onClick={() => refetchStats()} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-500/20 rounded-lg transition-colors">
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statsConfig.map((stat) => (
            <StatCard key={stat.name} {...stat} />
          ))}
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Alerts (Takes 2 columns on large screens) */}
        <RecentAlertsCard alerts={recentAlerts} isLoading={alertsLoading} />

        {/* Active Regions (Takes 1 column) */}
        <ActiveRegionsCard regions={activeRegions} isLoading={regionsLoading} />
      </div>

      {/* Activity Feed */}
      <ActivityFeed activities={activities} isLoading={activityLoading} />
    </div>
  );
}