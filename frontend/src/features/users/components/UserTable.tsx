// src/features/users/components/UserTable.tsx
import { Shield, Edit, Power, KeyRound, Eye, ChevronDown, ChevronUp, Building2 } from "lucide-react";
import type { ISafeUser, IUserTableProps } from "../types/";
import { useState } from "react";
import clsx from "clsx";
import {
  formatLastLogin,
  getActivityIndicatorColor,
  getRoleBadgeColor,
  getRoleDisplayName,
  getUserFullName,
  getUserInitials,
  getUserStatusBadge,
  isSuperAdmin
} from "../utils";
import { useBFF } from "../../bff_auth/context";

type SortField = "name" | "email" | "role" | "agency" | "lastLogin";
type SortOrder = "asc" | "desc";

export function UserTable({
  users,
  isLoading,
  onEdit,
  onDeactivate,
  onReactivate,
  onResetPassword,
  onView
}: IUserTableProps) {
  const { user: currentUser } = useBFF();
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Check if current user is super admin to show agency column
  const showAgencyColumn = currentUser ? isSuperAdmin(currentUser as ISafeUser) : false;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sortedUsers = [...users].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case "name":
        comparison = getUserFullName(a).localeCompare(getUserFullName(b));
        break;
      case "email":
        comparison = a.email.localeCompare(b.email);
        break;
      case "role":
        comparison = a.role.localeCompare(b.role);
        break;
      case "agency":
        comparison = (a.agency?.name || "").localeCompare(b.agency?.name || "");
        break;
      case "lastLogin":
        comparison = (a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0) -
                    (b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0);
        break;
    }

    return sortOrder === "asc" ? comparison : -comparison;
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto" />
        <p className="text-gray-500 dark:text-gray-400 mt-4">Loading users...</p>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-12 text-center">
        <Shield className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No users found</h3>
        <p className="text-gray-500 dark:text-gray-400">Try adjusting your filters or create a new user</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-6 py-4 text-left">
                <button
                  onClick={() => handleSort("name")}
                  className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-900 dark:hover:text-gray-200"
                >
                  User
                  <SortIcon field="name" />
                </button>
              </th>
              <th className="px-6 py-4 text-left">
                <button
                  onClick={() => handleSort("email")}
                  className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-900 dark:hover:text-gray-200"
                >
                  Email
                  <SortIcon field="email" />
                </button>
              </th>

              {/* Agency Column - Only for Super Admins */}
              {showAgencyColumn && (
                <th className="px-6 py-4 text-left">
                  <button
                    onClick={() => handleSort("agency")}
                    className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-900 dark:hover:text-gray-200"
                  >
                    Agency
                    <SortIcon field="agency" />
                  </button>
                </th>
              )}

              <th className="px-6 py-4 text-left">
                <button
                  onClick={() => handleSort("role")}
                  className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-900 dark:hover:text-gray-200"
                >
                  Role
                  <SortIcon field="role" />
                </button>
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-4 text-left">
                <button
                  onClick={() => handleSort("lastLogin")}
                  className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-900 dark:hover:text-gray-200"
                >
                  Last Login
                  <SortIcon field="lastLogin" />
                </button>
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {sortedUsers.map((user) => {
              const statusBadge = getUserStatusBadge(user);
              const isCurrentUser = user.id === currentUser?.id;

              return (
                <tr
                  key={user.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  {/* User Column */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white font-bold text-sm">
                          {getUserInitials(user)}
                        </div>
                        <div
                          className={clsx(
                            "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-900",
                            getActivityIndicatorColor(user.lastLoginAt)
                          )}
                        />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          {getUserFullName(user)}
                          {isCurrentUser && (
                            <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 px-2 py-0.5 rounded">
                              You
                            </span>
                          )}
                        </p>
                        {user.isTwoFactorEnabled && (
                          <span className="text-xs text-blue-600 dark:text-blue-400">🔒 2FA</span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Email Column */}
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
                  </td>

                  {/* Agency Column - Only for Super Admins */}
                  {showAgencyColumn && (
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {user.agency?.name || "Unknown"}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {user.agency?.type} • {user.agency?.jurisdictionLevel}
                          </p>
                        </div>
                      </div>
                    </td>
                  )}

                  {/* Role Column */}
                  <td className="px-6 py-4">
                    <span
                      className={clsx(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold",
                        getRoleBadgeColor(user.role)
                      )}
                    >
                      <Shield className="w-3 h-3" />
                      {getRoleDisplayName(user.role)}
                    </span>
                  </td>

                  {/* Status Column */}
                  <td className="px-6 py-4">
                    <span
                      className={clsx(
                        "inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold",
                        statusBadge.color
                      )}
                    >
                      {statusBadge.icon} {statusBadge.text}
                    </span>
                  </td>

                  {/* Last Login Column */}
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {formatLastLogin(user.lastLoginAt)}
                    </p>
                  </td>

                  {/* Actions Column */}
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onView(user.id)}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => onEdit(user)}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                        title="Edit User"
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          if (isCurrentUser) {
                            alert("You cannot reset your own password from here. Please use 'Change Password' in Settings.");
                            return;
                          }
                          onResetPassword(user.id);
                        }}
                        disabled={isCurrentUser}
                        className={clsx(
                          "p-2 rounded-lg transition-colors",
                          isCurrentUser
                            ? "text-gray-300 dark:text-gray-700 cursor-not-allowed opacity-50"
                            : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                        )}
                        title={isCurrentUser ? "Use 'Change Password' in Settings instead" : "Reset Password"}
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>

                      {user.isActive ? (
                        <button
                          onClick={() => {
                            if (isCurrentUser) {
                              alert("You cannot deactivate your own account. Please contact another administrator.");
                              return;
                            }
                            onDeactivate(user.id);
                          }}
                          disabled={isCurrentUser}
                          className={clsx(
                            "p-2 rounded-lg transition-colors",
                            isCurrentUser
                              ? "text-gray-300 dark:text-gray-700 cursor-not-allowed opacity-50"
                              : "hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                          )}
                          title={isCurrentUser ? "You cannot deactivate your own account" : "Deactivate User"}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => onReactivate(user.id)}
                          className="p-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors text-emerald-600 dark:text-emerald-400"
                          title="Reactivate User"
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}