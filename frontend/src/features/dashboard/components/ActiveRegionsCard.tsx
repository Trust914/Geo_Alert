import { MapPin, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Card } from "../../../components/ui/";
import type { IActiveRegion } from "../types/";

interface ActiveRegionsCardProps {
  regions: IActiveRegion[];
  isLoading?: boolean;
}

export function ActiveRegionsCard({ regions, isLoading }: ActiveRegionsCardProps) {
  if (isLoading) {
    return (
      <Card className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-500" />
            Active Regions
          </h3>
        </div>
        <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-500" />
          Active Regions
        </h3>
        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
          <Activity className="w-3 h-3" />
          Live
        </span>
      </div>

      {regions.length === 0 ? (
        <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center min-h-[300px] border-2 border-dashed border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <MapPin className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-400 font-medium">No active regions</p>
            <p className="text-sm text-gray-500 mt-1">Active alert regions will appear here</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {regions.map((region) => (
            <div
              key={region.id}
              className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-500" />
                  <h4 className="font-semibold text-gray-900 dark:text-white">{region.name}</h4>
                </div>
                <span className="text-xs bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 px-2 py-1 rounded-full font-medium">
                  {region.alertCount} alerts
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Last alert {formatDistanceToNow(new Date(region.lastAlertTime), { addSuffix: true })}
              </p>
            </div>
          ))}

          {/* Map Placeholder */}
          <div className="mt-4 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center h-[200px] border-2 border-dashed border-gray-200 dark:border-gray-700">
            <p className="text-gray-400 font-medium text-sm">Interactive Map</p>
          </div>
        </div>
      )}
    </Card>
  );
}