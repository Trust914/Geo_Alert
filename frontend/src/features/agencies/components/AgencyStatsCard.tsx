import { Users, Bell, Building2 } from "lucide-react";
import type { IAgencyDetailed } from "../types";

interface AgencyStatsCardsProps {
  agency: IAgencyDetailed;
}

export function AgencyStatsCards({ agency }: AgencyStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
        <div className="flex items-center justify-between mb-2">
          <Users className="w-8 h-8 text-blue-600" />
          <span className="text-3xl font-bold text-gray-900 dark:text-white">
            {agency._count?.users || 0}
          </span>
        </div>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
        <div className="flex items-center justify-between mb-2">
          <Bell className="w-8 h-8 text-orange-600" />
          <span className="text-3xl font-bold text-gray-900 dark:text-white">
            {agency._count?.alerts || 0}
          </span>
        </div>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Alerts Sent</p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
        <div className="flex items-center justify-between mb-2">
          <Building2 className="w-8 h-8 text-emerald-600" />
          <span className="text-3xl font-bold text-gray-900 dark:text-white">{agency.type}</span>
        </div>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Agency Type</p>
      </div>
    </div>
  );
}