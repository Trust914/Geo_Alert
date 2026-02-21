import { useNavigate } from "react-router-dom";
import { AlertTriangle, ChevronRight, MapPin, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import clsx from "clsx";
import { Card } from "../../../components/ui/";
import type { IRecentAlert } from "../types/";

interface RecentAlertsCardProps {
  alerts: IRecentAlert[];
  isLoading?: boolean;
}

export function RecentAlertsCard({ alerts, isLoading }: RecentAlertsCardProps) {
  const navigate = useNavigate();

  const getSeverityColor = (severity: IRecentAlert["severity"]) => {
    const colors = {
      critical: "bg-red-500",
      high: "bg-orange-500",
      medium: "bg-yellow-500",
      low: "bg-blue-500",
    };
    return colors[severity];
  };

  const getStatusBadge = (status: IRecentAlert["status"]) => {
    const styles = {
      active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
      resolved: "bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400",
      cancelled: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
    };
    return styles[status];
  };

  if (isLoading) {
    return (
      <Card className="lg:col-span-2 h-full">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-emerald-500" />
            Recent Broadcasts
          </h3>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded-xl" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="lg:col-span-2 h-full">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-emerald-500" />
          Recent Broadcasts
        </h3>
        <button
          onClick={() => navigate("/alerts")}
          className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 group"
        >
          View All
          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No recent alerts</p>
          <p className="text-sm mt-1">Your recent broadcasts will appear here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              onClick={() => navigate(`/alerts/${alert.id}`)}
              className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all cursor-pointer group"
            >
              <div className={clsx("w-2 h-14 rounded-full flex-shrink-0", getSeverityColor(alert.severity))} />

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2 mb-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {alert.title}
                  </h4>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                  </span>
                </div>

                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">
                  {alert.description}
                </p>

                <div className="flex items-center gap-3 text-xs">
                  <span className={clsx("px-2 py-1 rounded-full font-medium", getStatusBadge(alert.status))}>
                    {alert.status}
                  </span>
                  <span className="flex items-center gap-1 text-gray-500">
                    <MapPin className="w-3 h-3" />
                    {alert.location}
                  </span>
                  <span className="flex items-center gap-1 text-gray-500">
                    <Users className="w-3 h-3" />
                    {alert.recipientsCount.toLocaleString()} recipients
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}