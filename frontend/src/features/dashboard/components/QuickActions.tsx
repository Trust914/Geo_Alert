import { useNavigate } from "react-router-dom";
import { Zap, TrendingUp, Download, Settings } from "lucide-react";

export function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    {
      label: "Quick Alert",
      icon: Zap,
      onClick: () => navigate("/alerts/create"),
      variant: "primary" as const,
    },
    {
      label: "Reports",
      icon: TrendingUp,
      onClick: () => navigate("/reports"),
      variant: "secondary" as const,
    },
    {
      label: "Export Data",
      icon: Download,
      onClick: () => console.log("Export"),
      variant: "secondary" as const,
    },
    {
      label: "Settings",
      icon: Settings,
      onClick: () => navigate("/settings"),
      variant: "secondary" as const,
    },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            onClick={action.onClick}
            className={
              action.variant === "primary"
                ? "inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-all"
                : "inline-flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            }
          >
            <Icon className="w-4 h-4" />
            <span>{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}