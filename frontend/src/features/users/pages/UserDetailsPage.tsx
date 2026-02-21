import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, Calendar, Shield, Building2, CheckCircle2, XCircle, Loader2, Edit, Power, KeyRound, Clock, User as UserIcon, Activity } from "lucide-react";
import clsx from "clsx";

import { useUserById, useDeactivateUser, useReactivateUser, useResetUserPassword } from "../hooks";
import { TwoFactorModal } from "../components";
import { Button } from "../../../components/ui/Button/Button";
import { Card } from "../../../components/ui/Card/Card";
import { getUserFullName, getUserInitials, getRoleBadgeColor, getRoleDisplayName, getUserStatusBadge, formatLastLogin, getActivityIndicatorColor } from "../utils";
// import { useAuth } from "../../auth/hooks";
import { useBFF } from "../../bff_auth/context";

export default function UserDetailsPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useBFF();

  // Check if viewing own profile
  const isOwnProfile = userId === currentUser?.id;

  // State
  // const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [pending2FAAction, setPending2FAAction] = useState<{ type: "deactivate" | "reset-password"; userId: string } | null>(null);

  // Queries
  const { data: user, isLoading, error, refetch } = useUserById(userId || null);
  // console.log("current user:", user);

  // Mutations
  const deactivateMutation = useDeactivateUser();
  const reactivateMutation = useReactivateUser();
  const resetPasswordMutation = useResetUserPassword();

  // Handlers
  const handleBack = () => {
    navigate("/users");
  };

  const handleEdit = () => {
    navigate(`/users/${userId}/edit`);
  };

  const handleDeactivate = () => {
    if (!user) return;

    // Prevent self-deactivation
    if (isOwnProfile) {
      alert("You cannot deactivate your own account. Please contact another administrator.");
      return;
    }

    if (confirm("Are you sure you want to deactivate this user? They will lose access to the system.")) {
      deactivateMutation.mutate(
        { userId: user.id },
        {
          onSuccess: () => {
            refetch();
          },
        },
      );
    }
  };

  const handleReactivate = () => {
    if (!user) return;

    if (confirm("Are you sure you want to reactivate this user?")) {
      reactivateMutation.mutate(user.id, {
        onSuccess: () => {
          refetch();
        },
      });
    }
  };

  const handleResetPassword = () => {
    if (!user) return;

    // Prevent self password reset (admin forced reset)
    if (isOwnProfile) {
      alert("You cannot reset your own password from here. Please use the 'Change Password' option in Settings.");
      return;
    }

    if (confirm("Are you sure you want to reset this user's password? They will receive an email with reset instructions.")) {
      resetPasswordMutation.mutate(
        { userId: user.id },
        {
          onSuccess: () => {
            refetch();
          },
        },
      );
    }
  };

  // 2FA Handlers
  const handle2FAVerification = (code: string) => {
    if (!pending2FAAction) return;

    const { type, userId } = pending2FAAction;

    if (type === "deactivate") {
      deactivateMutation.mutate(
        { userId, twoFactorCode: code },
        {
          onSuccess: () => {
            refetch();
            setShow2FAModal(false);
            setPending2FAAction(null);
          },
        },
      );
    } else if (type === "reset-password") {
      resetPasswordMutation.mutate(
        { userId, twoFactorCode: code },
        {
          onSuccess: () => {
            refetch();
            setShow2FAModal(false);
            setPending2FAAction(null);
          },
        },
      );
    }
  };

  // Check for 2FA requirements
  if (deactivateMutation.pending2FA && !show2FAModal) {
    setShow2FAModal(true);
    setPending2FAAction({ type: "deactivate", userId: userId! });
  }

  if (resetPasswordMutation.pending2FA && !show2FAModal) {
    setShow2FAModal(true);
    setPending2FAAction({ type: "reset-password", userId: userId! });
  }

  // Loading State
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading user details...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">User Not Found</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">The user you're looking for doesn't exist or has been removed.</p>
          <Button variant="outline" onClick={handleBack} leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Back to Users
          </Button>
        </div>
      </div>
    );
  }

  const statusBadge = getUserStatusBadge(user);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4 flex-1">
          <Button variant="ghost" size="sm" onClick={handleBack} leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Back
          </Button>

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg">{getUserInitials(user)}</div>
                <div className={clsx("absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white dark:border-gray-900", getActivityIndicatorColor(user.lastLoginAt))} />
              </div>

              <div>
                <h1 className="text-3xl font-black text-gray-900 dark:text-white">{getUserFullName(user)}</h1>
                <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1">
                  <Mail className="w-4 h-4" />
                  {user.email}
                </p>
              </div>
            </div>

            {/* Self Profile Badge */}
            {isOwnProfile && (
              <div className="mt-3">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 text-sm font-medium">
                  <UserIcon className="w-4 h-4" />
                  This is your profile
                </span>
              </div>
            )}

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mt-3">
              <span className={clsx("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold", getRoleBadgeColor(user.role))}>
                <Shield className="w-4 h-4" />
                {getRoleDisplayName(user.role)}
              </span>

              <span className={clsx("inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold", statusBadge.color)}>
                {statusBadge.icon} {statusBadge.text}
              </span>

              {user.isTwoFactorEnabled && <span className="px-3 py-1.5 rounded-full text-sm font-semibold bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">🔐 2FA Enabled</span>}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleEdit} leftIcon={<Edit className="w-4 h-4" />}>
            Edit User
          </Button>

          {/* Reset Password - Disabled for self */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetPassword}
            leftIcon={<KeyRound className="w-4 h-4" />}
            isLoading={resetPasswordMutation.isPending}
            disabled={isOwnProfile || resetPasswordMutation.isPending}
            title={isOwnProfile ? "You cannot reset your own password from here" : "Reset Password"}
            className={clsx(isOwnProfile && "opacity-50 cursor-not-allowed hover:bg-white dark:hover:bg-gray-900")}
          >
            Reset Password
          </Button>

          {/* Deactivate/Reactivate - Disabled for self */}
          {user.isActive ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeactivate}
              leftIcon={<Power className="w-4 h-4" />}
              className={clsx("border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20", isOwnProfile && "opacity-50 cursor-not-allowed hover:bg-white dark:hover:bg-gray-900")}
              isLoading={deactivateMutation.isPending}
              disabled={isOwnProfile || deactivateMutation.isPending}
              title={isOwnProfile ? "You cannot deactivate your own account" : "Deactivate Account"}
            >
              Deactivate
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleReactivate} leftIcon={<Power className="w-4 h-4" />} className="border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900/20" isLoading={reactivateMutation.isPending}>
              Reactivate
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <Card>
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Personal Information
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">First Name</p>
                  <p className="text-base font-semibold text-gray-900 dark:text-white">{user.firstName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Last Name</p>
                  <p className="text-base font-semibold text-gray-900 dark:text-white">{user.lastName}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Email Address</p>
                <p className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  {user.email}
                  {user.emailVerified && <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">User Role</p>
                <p className="text-base font-semibold text-gray-900 dark:text-white">{getRoleDisplayName(user.role)}</p>
              </div>
            </div>
          </Card>

          {/* Agency Information */}
          <Card>
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Agency Information
              </h2>
            </div>
            <div className="p-6 space-y-4">
              {user.agency ? (
                <>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Agency Name</p>
                    <p className="text-base font-semibold text-gray-900 dark:text-white">{user.agency.name}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Agency Type</p>
                      <p className="text-base font-semibold text-gray-900 dark:text-white uppercase">{user.agency.type}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Status</p>
                      <span className={clsx("inline-flex px-3 py-1 rounded-full text-sm font-semibold", user.agency.status === "ACTIVE" ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400")}>
                        {user.agency.status}
                      </span>
                    </div>
                  </div>

                  {user.agency.jurisdictionLevel && (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Jurisdiction Level</p>
                      <p className="text-base font-semibold text-gray-900 dark:text-white capitalize">{user.agency.jurisdictionLevel}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <Building2 className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No agency information available</p>
                </div>
              )}
            </div>
          </Card>

          {/* Security Settings */}
          <Card>
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                Security Settings
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Two-Factor Authentication</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{user.isTwoFactorEnabled ? `Method: ${user.twoFactorMethod || "Authenticator App"}` : "Not enabled"}</p>
                </div>
                <span className={clsx("px-3 py-1 rounded-full text-xs font-semibold", user.isTwoFactorEnabled ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400" : "bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400")}>
                  {user.isTwoFactorEnabled ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Email Verification</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{user.emailVerified ? "Email has been verified" : "Email verification pending"}</p>
                </div>
                <span className={clsx("px-3 py-1 rounded-full text-xs font-semibold", user.emailVerified ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400")}>
                  {user.emailVerified ? "Verified" : "Pending"}
                </span>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Password Status</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{user.mustChangePassword ? "Password change required on next login" : "Password is up to date"}</p>
                </div>
                <span className={clsx("px-3 py-1 rounded-full text-xs font-semibold", user.mustChangePassword ? "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400" : "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400")}>
                  {user.mustChangePassword ? "Action Required" : "OK"}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column - Timeline & Activity */}
        <div className="space-y-6">
          {/* Account Timeline */}
          <Card>
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                Account Timeline
              </h2>
            </div>
            <div className="p-6 space-y-4">
              {/* Last Login */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Last Login</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{formatLastLogin(user.lastLoginAt)}</p>
                  {user.lastLoginAt && <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{new Date(user.lastLoginAt).toLocaleString()}</p>}
                </div>
              </div>

              {/* Account Created */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Account Created</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{new Date(user.createdAt).toLocaleDateString()}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{new Date(user.createdAt).toLocaleString()}</p>
                </div>
              </div>

              {/* Last Updated */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Last Updated</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{new Date(user.updatedAt).toLocaleDateString()}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{new Date(user.updatedAt).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Account Status Summary */}
          <Card>
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Status Summary</h2>
            </div>
            <div className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Account Status</span>
                <span className={clsx("px-3 py-1 rounded-full text-xs font-semibold", user.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400")}>{user.isActive ? "Active" : "Inactive"}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Role</span>
                <span className={clsx("px-3 py-1 rounded-full text-xs font-semibold", getRoleBadgeColor(user.role))}>{getRoleDisplayName(user.role)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">2FA Status</span>
                <span className={clsx("px-3 py-1 rounded-full text-xs font-semibold", user.isTwoFactorEnabled ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400" : "bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400")}>
                  {user.isTwoFactorEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Email Verification</span>
                <span className={clsx("px-3 py-1 rounded-full text-xs font-semibold", user.emailVerified ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400")}>
                  {user.emailVerified ? "Verified" : "Pending"}
                </span>
              </div>
            </div>
          </Card>

          {/* Quick Actions */}
          <Card>
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Quick Actions</h2>
            </div>
            <div className="p-6 space-y-2">
              <Button variant="outline" className="w-full justify-start" size="sm" onClick={handleEdit} leftIcon={<Edit className="w-4 h-4" />}>
                Edit User Details
              </Button>

              <Button
                variant="outline"
                className={clsx("w-full justify-start", isOwnProfile && "opacity-50 cursor-not-allowed")}
                size="sm"
                onClick={handleResetPassword}
                leftIcon={<KeyRound className="w-4 h-4" />}
                isLoading={resetPasswordMutation.isPending}
                disabled={isOwnProfile || resetPasswordMutation.isPending}
                title={isOwnProfile ? "Use 'Change Password' in Settings instead" : undefined}
              >
                Reset Password
              </Button>

              {user.isActive ? (
                <Button
                  variant="outline"
                  className={clsx("w-full justify-start border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20", isOwnProfile && "opacity-50 cursor-not-allowed hover:bg-white dark:hover:bg-gray-900")}
                  size="sm"
                  onClick={handleDeactivate}
                  leftIcon={<Power className="w-4 h-4" />}
                  isLoading={deactivateMutation.isPending}
                  disabled={isOwnProfile || deactivateMutation.isPending}
                  title={isOwnProfile ? "You cannot deactivate your own account" : undefined}
                >
                  Deactivate Account
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="w-full justify-start border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                  size="sm"
                  onClick={handleReactivate}
                  leftIcon={<Power className="w-4 h-4" />}
                  isLoading={reactivateMutation.isPending}
                >
                  Reactivate Account
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* 2FA Modal */}
      <TwoFactorModal
        isOpen={show2FAModal}
        onClose={() => {
          setShow2FAModal(false);
          setPending2FAAction(null);
          deactivateMutation.clearPending2FA();
          resetPasswordMutation.clearPending2FA();
        }}
        onVerify={handle2FAVerification}
        isPending={deactivateMutation.isPending || resetPasswordMutation.isPending}
        title="2FA Verification Required"
        description="Enter your 2FA code to continue"
      />
    </div>
  );
}
