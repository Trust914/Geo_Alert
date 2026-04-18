import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus, Users, Shield } from "lucide-react";

import {
  useAllUsers, // NEW: For super admins
  useUsersByAgency, // Existing: For regular admins
  useDeactivateUser,
  useReactivateUser,
  useResetUserPassword,
} from "../hooks";
import type { ISafeUser, IUser, IUserFilters } from "../types/";
import { TwoFactorModal, UserCard, UserFilter, UserTable } from "../components";
import { ConfirmationModal } from "../components/";
import { useBFF } from "../../bff_auth/context";
import { isSuperAdmin } from "../utils/";
import { Card } from "../../../components/ui/Card/Card";
import { Button } from "../../../components/ui/Button/Button";

export default function UserManagementPage() {
  const { user: currentUser } = useBFF();
  const navigate = useNavigate();

  // Check if current user is super admin
  const isCurrentUserSuperAdmin = currentUser ? isSuperAdmin(currentUser as ISafeUser) : false;

  // Filter state
  const [filters, setFilters] = useState<IUserFilters>({
    currentPage: 1,
    limit: 20,
  });

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: "deactivate" | "reactivate" | "reset-password" | null;
    userId: string | null;
    userName: string;
  }>({
    isOpen: false,
    type: null,
    userId: null,
    userName: "",
  });

  // 2FA State
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [pending2FAAction, setPending2FAAction] = useState<{
    type: "deactivate" | "reset-password";
    userId: string;
  } | null>(null);

  // ---------------------------------------------------------------------------
  // CONDITIONAL QUERY: Super Admin sees ALL users, Regular Admin sees their agency
  // ---------------------------------------------------------------------------
  const allUsersQuery = useAllUsers(filters);
  const agencyUsersQuery = useUsersByAgency(currentUser?.agencyId || "", filters);

  // Select the appropriate query based on user role
  const { data, isLoading, refetch } = isCurrentUserSuperAdmin ? allUsersQuery : agencyUsersQuery;
  console.log("Fetched users:", data);

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------
  const deactivateMutation = useDeactivateUser();
  const reactivateMutation = useReactivateUser();
  const resetPasswordMutation = useResetUserPassword();

  // ---------------------------------------------------------------------------
  // Navigation handlers
  // ---------------------------------------------------------------------------
  const handleCreateUser = () => navigate("/users/create");
  const handleEditUser = (user: IUser) => navigate(`/users/${user.id}/edit`);
  const handleViewUser = (userId: string) => navigate(`/users/${userId}`);

  // ---------------------------------------------------------------------------
  // Action handlers → open confirmation modal
  // ---------------------------------------------------------------------------
  const handleDeactivateUser = (userId: string) => {
    if (userId === currentUser?.id) return; // guard: can't self-deactivate

    const user = data?.data?.find((u: IUser) => u.id === userId);
    setConfirmModal({
      isOpen: true,
      type: "deactivate",
      userId,
      userName: user ? `${user.firstName} ${user.lastName}` : "this user",
    });
  };

  const handleReactivateUser = (userId: string) => {
    const user = data?.data?.find((u: IUser) => u.id === userId);
    setConfirmModal({
      isOpen: true,
      type: "reactivate",
      userId,
      userName: user ? `${user.firstName} ${user.lastName}` : "this user",
    });
  };

  const handleResetPassword = (userId: string) => {
    const user = data?.data?.find((u: IUser) => u.id === userId);
    setConfirmModal({
      isOpen: true,
      type: "reset-password",
      userId,
      userName: user ? `${user.firstName} ${user.lastName}` : "this user",
    });
  };

  // ---------------------------------------------------------------------------
  // Execute confirmed action
  // ---------------------------------------------------------------------------
  const executeAction = () => {
    if (!confirmModal.userId || !confirmModal.type) return;

    const { userId, type } = confirmModal;
    const closeModal = () => setConfirmModal({ isOpen: false, type: null, userId: null, userName: "" });

    if (type === "deactivate") {
      deactivateMutation.mutate(
        { userId },
        {
          onSuccess: () => {
            refetch();
            closeModal();
          },
        },
      );
    } else if (type === "reactivate") {
      reactivateMutation.mutate(userId, {
        onSuccess: () => {
          refetch();
          closeModal();
        },
      });
    } else if (type === "reset-password") {
      resetPasswordMutation.mutate(
        { userId },
        {
          onSuccess: () => {
            refetch();
            closeModal();
          },
        },
      );
    }
  };

  // ---------------------------------------------------------------------------
  // 2FA verification handler
  // ---------------------------------------------------------------------------
  const handle2FAVerification = (code: string) => {
    if (!pending2FAAction) return;

    const { type, userId } = pending2FAAction;
    const close2FA = () => {
      setShow2FAModal(false);
      setPending2FAAction(null);
    };

    if (type === "deactivate") {
      deactivateMutation.mutate(
        { userId, twoFactorCode: code },
        {
          onSuccess: () => {
            refetch();
            close2FA();
          },
          onError: () => {
            close2FA();
          },
        },
      );
    } else if (type === "reset-password") {
      resetPasswordMutation.mutate(
        { userId, twoFactorCode: code },
        {
          onSuccess: () => {
            refetch();
            close2FA();
          },
          onError: () => {
            close2FA();
          },
        },
      );
    }
  };

  // ---------------------------------------------------------------------------
  // Detect 2FA challenges from mutation hooks
  // ---------------------------------------------------------------------------
  if (deactivateMutation.pending2FA && !show2FAModal) {
    setShow2FAModal(true);
    setPending2FAAction({ type: "deactivate", userId: confirmModal.userId || "" });
    setConfirmModal({ isOpen: false, type: null, userId: null, userName: "" });
  }

  if (resetPasswordMutation.pending2FA && !show2FAModal) {
    setShow2FAModal(true);
    setPending2FAAction({ type: "reset-password", userId: confirmModal.userId || "" });
    setConfirmModal({ isOpen: false, type: null, userId: null, userName: "" });
  }

  // ---------------------------------------------------------------------------
  // Filter handlers
  // ---------------------------------------------------------------------------
  const handleFilterChange = (newFilters: IUserFilters) => {
    setFilters(newFilters);
  };

  const handleResetFilters = () => {
    setFilters({
      currentPage: 1,
      limit: 20,
    });
  };

  // ---------------------------------------------------------------------------
  // View mode toggle
  // ---------------------------------------------------------------------------
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4 flex-1">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
            <Users className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-black text-gray-900 dark:text-white">
              User Management
              {isCurrentUserSuperAdmin && <span className="ml-3 text-sm font-semibold bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400 px-3 py-1 rounded-full">Super Admin</span>}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">{isCurrentUserSuperAdmin ? "Manage users across all agencies in the system" : "Manage staff members and their permissions"}</p>
          </div>
        </div>

        <Button variant="default" onClick={handleCreateUser} leftIcon={<UserPlus className="w-5 h-5" />} className="bg-emerald-600 hover:bg-emerald-700">
          Add User
        </Button>
      </div>

      {/* Super Admin Context Banner */}
      {isCurrentUserSuperAdmin && (
        <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
          <div className="flex gap-3 p-4">
            <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-purple-900 dark:text-purple-300 mb-1">Viewing All Users</h3>
              <p className="text-sm text-purple-700 dark:text-purple-400">
                You are viewing users from <strong>all agencies</strong> in the system. Use filters to narrow down by specific agency, role, or status.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Users</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{data?.pagination?.total || 0}</div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">Active</div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{data?.data?.filter((u: IUser) => u.isActive).length || 0}</div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">Inactive</div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{data?.data?.filter((u: IUser) => !u.isActive).length || 0}</div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">2FA Enabled</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{data?.data?.filter((u: IUser) => u.isTwoFactorEnabled).length || 0}</div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <UserFilter filters={filters} onFilterChange={handleFilterChange} onReset={handleResetFilters} />

      {/* View Mode Toggle */}
      <div className="flex justify-end gap-2">
        <Button variant={viewMode === "table" ? "default" : "outline"} size="sm" onClick={() => setViewMode("table")}>
          Table View
        </Button>
        <Button variant={viewMode === "cards" ? "default" : "outline"} size="sm" onClick={() => setViewMode("cards")}>
          Card View
        </Button>
      </div>

      {/* User List */}
      {viewMode === "table" ? (
        <UserTable users={data?.data || []} isLoading={isLoading} onEdit={handleEditUser} onDeactivate={handleDeactivateUser} onReactivate={handleReactivateUser} onResetPassword={handleResetPassword} onView={handleViewUser} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.data?.map((user: IUser) => (
            <UserCard key={user.id} user={user} onEdit={handleEditUser} onDeactivate={handleDeactivateUser} onReactivate={handleReactivateUser} onResetPassword={handleResetPassword} onView={handleViewUser} />
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, type: null, userId: null, userName: "" })}
        onConfirm={executeAction}
        title={confirmModal.type === "deactivate" ? "Deactivate User" : confirmModal.type === "reactivate" ? "Reactivate User" : "Reset Password"}
        message={
          confirmModal.type === "deactivate"
            ? `Are you sure you want to deactivate ${confirmModal.userName}? They will lose access to the system immediately.`
            : confirmModal.type === "reactivate"
              ? `Are you sure you want to reactivate ${confirmModal.userName}? They will regain access to the system.`
              : `Are you sure you want to reset the password for ${confirmModal.userName}? They will receive an email with reset instructions.`
        }
        confirmText={confirmModal.type === "deactivate" ? "Deactivate" : confirmModal.type === "reactivate" ? "Reactivate" : "Send Reset Email"}
        confirmButtonClass={confirmModal.type === "deactivate" ? "bg-red-600 hover:bg-red-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"}
        isLoading={deactivateMutation.isPending || reactivateMutation.isPending || resetPasswordMutation.isPending}
      />

      {/* 2FA Modal */}
      <TwoFactorModal
        isOpen={show2FAModal}
        onClose={() => {
          setShow2FAModal(false);
          setPending2FAAction(null);
          if (deactivateMutation.pending2FA) deactivateMutation.clearPending2FA();
          if (resetPasswordMutation.pending2FA) resetPasswordMutation.clearPending2FA();
        }}
        onVerify={handle2FAVerification}
        isPending={deactivateMutation.isPending || resetPasswordMutation.isPending}
        title="2FA Verification Required"
        description="Enter your 2FA code to complete this action"
      />
    </div>
  );
}
