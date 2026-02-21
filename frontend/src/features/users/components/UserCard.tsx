// src/features/users/components/UserCard.tsx
import { Shield, Mail, Calendar, MoreVertical, Edit, Power, KeyRound, Eye, Building2 } from "lucide-react";
import type { ISafeUser, IUserCardProps } from "../types/";
import {
  getUserFullName,
  getUserInitials,
  getRoleBadgeColor,
  getRoleDisplayName,
  getUserStatusBadge,
  formatLastLogin,
  getActivityIndicatorColor,
  isSuperAdmin
} from "../utils/";
import { useState, useRef, useEffect } from "react";
import clsx from "clsx";
import { useBFF } from "../../bff_auth/context";

export function UserCard({
  user,
  onEdit,
  onDeactivate,
  onReactivate,
  onResetPassword,
  onView
}: IUserCardProps) {
  const { user: currentUser } = useBFF();
  const [showActions, setShowActions] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const statusBadge = getUserStatusBadge(user);

  const isCurrentUser = user.id === currentUser?.id;
  const showAgencyInfo = currentUser ? isSuperAdmin(currentUser as ISafeUser) : false;

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowActions(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 hover:shadow-lg transition-all duration-200 hover:-translate-y-1">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
              {getUserInitials(user)}
            </div>
            {/* Activity Indicator */}
            <div
              className={clsx(
                "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900",
                getActivityIndicatorColor(user.lastLoginAt)
              )}
            />
          </div>

          {/* Name & Email */}
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              {getUserFullName(user)}
              {isCurrentUser && (
                <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 px-2 py-0.5 rounded">
                  You
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {user.email}
            </p>
          </div>
        </div>

        {/* Actions Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowActions(!showActions)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <MoreVertical className="w-5 h-5 text-gray-400" />
          </button>

          {showActions && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-10 animate-in fade-in slide-in-from-top-2 duration-200">
              <button
                onClick={() => {
                  onView(user.id);
                  setShowActions(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Eye className="w-4 h-4" />
                View Details
              </button>

              <button
                onClick={() => {
                  onEdit(user);
                  setShowActions(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Edit className="w-4 h-4" />
                Edit User
              </button>

              <button
                onClick={() => {
                  if (isCurrentUser) {
                    alert("You cannot reset your own password from here. Please use 'Change Password' in Settings.");
                    setShowActions(false);
                    return;
                  }
                  onResetPassword(user.id);
                  setShowActions(false);
                }}
                disabled={isCurrentUser}
                className={clsx(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-sm",
                  isCurrentUser
                    ? "text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                )}
                title={isCurrentUser ? "Use 'Change Password' in Settings instead" : "Reset Password"}
              >
                <KeyRound className="w-4 h-4" />
                Reset Password
              </button>

              <div className="border-t border-gray-200 dark:border-gray-700 my-1" />

              {user.isActive ? (
                <button
                  onClick={() => {
                    if (isCurrentUser) {
                      alert("You cannot deactivate your own account. Please contact another administrator.");
                      setShowActions(false);
                      return;
                    }
                    onDeactivate(user.id);
                    setShowActions(false);
                  }}
                  disabled={isCurrentUser}
                  className={clsx(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-sm",
                    isCurrentUser
                      ? "text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50"
                      : "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  )}
                  title={isCurrentUser ? "You cannot deactivate your own account" : "Deactivate User"}
                >
                  <Power className="w-4 h-4" />
                  Deactivate
                </button>
              ) : (
                <button
                  onClick={() => {
                    onReactivate(user.id);
                    setShowActions(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                >
                  <Power className="w-4 h-4" />
                  Reactivate
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Agency Info - Only for Super Admins */}
      {showAgencyInfo && user.agency && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Agency</span>
          </div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">{user.agency.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {user.agency.type} • {user.agency.jurisdictionLevel}
          </p>
        </div>
      )}

      {/* Badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Role Badge */}
        <span
          className={clsx(
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold",
            getRoleBadgeColor(user.role)
          )}
        >
          <Shield className="w-3 h-3" />
          {getRoleDisplayName(user.role)}
        </span>

        {/* Status Badge */}
        <span className={clsx("px-3 py-1 rounded-full text-xs font-semibold", statusBadge.color)}>
          {statusBadge.icon} {statusBadge.text}
        </span>

        {/* 2FA Badge */}
        {user.isTwoFactorEnabled && (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">
            🔒 2FA
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          Last login: {formatLastLogin(user.lastLoginAt)}
        </span>
      </div>
    </div>
  );
}