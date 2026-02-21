import { Activity, Bell, Users, Building2, Settings } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import clsx from "clsx";
import { Card } from "../../../components/ui/";
import type { IActivityLog } from "../types/";

interface ActivityFeedProps {
  activities: IActivityLog[];
  isLoading?: boolean;
}

export function ActivityFeed({ activities, isLoading }: ActivityFeedProps) {
  const getActivityIcon = (type: IActivityLog["type"]) => {
    const icons = {
      alert_sent: Bell,
      user_created: Users,
      agency_added: Building2,
      system_event: Settings,
    };
    return icons[type] || Activity;
  };

  const getActivityColor = (type: IActivityLog["type"]) => {
    const colors = {
      alert_sent: "text-emerald-600 bg-emerald-100 dark:bg-emerald-500/20",
      user_created: "text-blue-600 bg-blue-100 dark:bg-blue-500/20",
      agency_added: "text-purple-600 bg-purple-100 dark:bg-purple-500/20",
      system_event: "text-gray-600 bg-gray-100 dark:bg-gray-500/20",
    };
    return colors[type] || colors.system_event;
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-500" />
            Activity Feed
          </h3>
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse flex gap-3">
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-800 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
                <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-500" />
          Activity Feed
        </h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">Last 24 hours</span>
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No recent activity</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {activities.map((activity) => {
            const Icon = getActivityIcon(activity.type);
            return (
              <div key={activity.id} className="flex gap-3">
                <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0", getActivityColor(activity.type))}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white font-medium">{activity.description}</p>
                  {activity.userName && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">by {activity.userName}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}