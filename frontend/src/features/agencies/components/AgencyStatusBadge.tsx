import clsx from "clsx";
import { AgencyStatus } from "../types";

interface AgencyStatusBadgeProps {
  status: AgencyStatus;
  className?: string;
}

export function AgencyStatusBadge({ status, className }: AgencyStatusBadgeProps) {
  const styles = {
    ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
    SUSPENDED: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
    INACTIVE: "bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400",
  };

  return (
    <span
      className={clsx(
        "inline-flex px-3 py-1 rounded-full text-xs font-semibold",
        styles[status] || styles.INACTIVE,
        className
      )}
    >
      {status}
    </span>
  );
}