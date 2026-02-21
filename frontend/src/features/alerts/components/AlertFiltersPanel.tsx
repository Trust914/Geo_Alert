import { Button } from "../../../components/ui/";
import { Input } from "../../../components/ui/";
import {
  AlertCategory,
  AlertSeverity,
  AlertStatus,
  type AlertFilters,
} from "../types/";

interface AlertFiltersPanelProps {
  filters: AlertFilters;
  onFilterChange: (filters: Partial<AlertFilters>) => void;
}

export function AlertFiltersPanel({
  filters,
  onFilterChange,
}: AlertFiltersPanelProps) {
  const handleReset = () => {
    onFilterChange({
      category: undefined,
      severity: undefined,
      status: undefined,
      startDate: undefined,
      endDate: undefined,
    });
  };

  const hasActiveFilters =
    filters.category ||
    filters.severity ||
    filters.status ||
    filters.startDate ||
    filters.endDate;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Category Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Category
          </label>
          <select
            value={filters.category || ""}
            onChange={(e) =>
              onFilterChange({
                category: e.target.value ? (e.target.value as AlertCategory) : undefined,
              })
            }
            className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Categories</option>
            <option value={AlertCategory.WEATHER}>Weather</option>
            <option value={AlertCategory.GEO}>Geological</option>
            <option value={AlertCategory.MET}>Meteorological</option>
            <option value={AlertCategory.SAFETY}>Public Safety</option>
            <option value={AlertCategory.SECURITY}>Security</option>
            <option value={AlertCategory.RESCUE}>Rescue</option>
            <option value={AlertCategory.HEALTH}>Health</option>
            <option value={AlertCategory.FIRE}>Fire</option>
            <option value={AlertCategory.TRANSPORT}>Transport</option>
            <option value={AlertCategory.ENVIRONMENTAL}>Environmental</option>
            <option value={AlertCategory.INFRASTRUCTURE}>Infrastructure</option>
            <option value={AlertCategory.OTHER}>Other</option>
          </select>
        </div>

        {/* Severity Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Severity
          </label>
          <select
            value={filters.severity || ""}
            onChange={(e) =>
              onFilterChange({
                severity: e.target.value ? (e.target.value as AlertSeverity) : undefined,
              })
            }
            className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Severities</option>
            <option value={AlertSeverity.EXTREME}>Extreme</option>
            <option value={AlertSeverity.SEVERE}>Severe</option>
            <option value={AlertSeverity.MODERATE}>Moderate</option>
            <option value={AlertSeverity.MINOR}>Minor</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Status
          </label>
          <select
            value={filters.status || ""}
            onChange={(e) =>
              onFilterChange({
                status: e.target.value ? (e.target.value as AlertStatus) : undefined,
              })
            }
            className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Statuses</option>
            <option value={AlertStatus.DRAFT}>Draft</option>
            <option value={AlertStatus.PENDING}>Pending</option>
            <option value={AlertStatus.SENT}>Sending</option>
            <option value={AlertStatus.DELIVERED}>Delivered</option>
            <option value={AlertStatus.FAILED}>Failed</option>
            <option value={AlertStatus.CANCELLED}>Cancelled</option>
            <option value={AlertStatus.EXPIRED}>Expired</option>
          </select>
        </div>

        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Start Date
          </label>
          <Input
            type="date"
            value={filters.startDate || ""}
            onChange={(e) => onFilterChange({ startDate: e.target.value })}
            className="w-full"
          />
        </div>
      </div>

      {/* Reset Button */}
      {hasActiveFilters && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            Reset Filters
          </Button>
        </div>
      )}
    </div>
  );
}