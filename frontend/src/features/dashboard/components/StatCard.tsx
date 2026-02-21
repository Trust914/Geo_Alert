import { type LucideIcon } from "lucide-react";
import clsx from "clsx";

interface StatCardProps {
  name: string;
  value: string | number;
  icon: LucideIcon;
  change?: string;
  trend?: "up" | "down" | "neutral";
  color: string;
  bg: string;
  border: string;
}

export function StatCard({ name, value, icon: Icon, change, trend = "neutral", color, bg, border }: StatCardProps) {
  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-2xl p-6 border transition-all duration-200 hover:-translate-y-1 hover:shadow-lg",
        "bg-white dark:bg-gray-900",
        border
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{name}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{value}</p>
        </div>
        <div className={clsx("p-3 rounded-xl", bg)}>
          <Icon className={clsx("w-6 h-6", color)} />
        </div>
      </div>

      {change && (
        <div className="mt-4 flex items-center gap-2">
          <span
            className={clsx(
              "text-xs font-semibold px-2 py-1 rounded-full",
              trend === "up"
                ? "text-emerald-700 bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-400"
                : trend === "down"
                ? "text-red-700 bg-red-100 dark:bg-red-500/20 dark:text-red-400"
                : "text-gray-600 bg-gray-100 dark:bg-gray-800"
            )}
          >
            {change}
          </span>
          <span className="text-xs text-gray-400">vs last month</span>
        </div>
      )}
    </div>
  );
}