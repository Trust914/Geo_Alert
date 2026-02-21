import { Shield, UserCog, Users as UsersIcon, Eye, Check } from "lucide-react";
import { UserRole } from "../../../types/enums.types";
import clsx from "clsx";

interface RoleSelectorProps {
  selectedRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  disabled?: boolean;
}

const ROLE_OPTIONS = [
  {
    value: UserRole.VIEWER,
    label: "Viewer",
    description: "Read-only access to alerts and reports",
    icon: Eye,
  },
  {
    value: UserRole.OPERATOR,
    label: "Operator",
    description: "Create and dispatch alerts",
    icon: UsersIcon,
  },
  {
    value: UserRole.COORDINATOR,
    label: "Coordinator",
    description: "Manage alerts and citizen data",
    icon: UserCog,
  },
  {
    value: UserRole.ADMIN,
    label: "Administrator",
    description: "Full agency control, including users",
    icon: Shield,
  },
] as const;

export function RoleSelector({ selectedRole, onRoleChange, disabled = false }: RoleSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
        User Role <span className="text-red-500">*</span>
      </label>

      {/* 2×2 grid on md+, single column on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ROLE_OPTIONS.map((role) => {
          const Icon = role.icon;
          const isSelected = selectedRole === role.value;

          return (
            <button
              key={role.value}
              type="button"
              onClick={() => !disabled && onRoleChange(role.value)}
              disabled={disabled}
              className={clsx(
                // Base
                "relative w-full text-left p-4 rounded-xl border transition-all duration-150",
                // Selected state — subtle emerald tint, stronger border
                isSelected ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600",
                // Disabled
                disabled && "opacity-50 cursor-not-allowed hover:border-gray-200 dark:hover:border-gray-700",
              )}
            >
              {/* Check badge — top-right corner when selected */}
              {isSelected && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </div>
              )}

              <div className="flex items-start gap-3">
                {/* Icon container */}
                <div className={clsx("flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center", isSelected ? "bg-emerald-100 dark:bg-emerald-500/20" : "bg-gray-100 dark:bg-gray-700")}>
                  <Icon className={clsx("w-5 h-5", isSelected ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400")} />
                </div>

                {/* Label + description */}
                <div className="flex-1 min-w-0 pr-5">
                  <p className={clsx("font-semibold text-sm", isSelected ? "text-emerald-900 dark:text-emerald-100" : "text-gray-900 dark:text-white")}>{role.label}</p>
                  <p className={clsx("text-xs mt-0.5 leading-snug", isSelected ? "text-emerald-600 dark:text-emerald-300" : "text-gray-500 dark:text-gray-400")}>{role.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Role hierarchy footnote — clean, single-line */}
      <p className="text-xs text-gray-500 dark:text-gray-500 pt-1">Role hierarchy: Viewer → Operator → Coordinator → Administrator</p>
    </div>
  );
}
