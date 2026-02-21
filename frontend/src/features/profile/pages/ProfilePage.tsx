import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Mail, Shield, Building2, Clock, Activity, CheckCircle2, Save, Loader2, X, Edit2, Info } from "lucide-react";
import clsx from "clsx";

// import { useAuth } from "../../../features/auth/hooks";
import { useUserById, useUpdateOwnProfile } from "../../../features/users/hooks";
import { getUserFullName, getUserInitials, getRoleBadgeColor, getRoleDisplayName, getUserStatusBadge, formatLastLogin, getActivityIndicatorColor } from "../../../features/users/utils";
import { UserRole } from "../../../types/enums.types";
import { useBFF } from "../../bff_auth/context";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user: currentUser } = useBFF();

  // Fetch the full user record (includes agency relation)
  const { data: user, isLoading } = useUserById(currentUser?.id || null);
  const updateProfile = useUpdateOwnProfile();

  // Is this user an admin? Only admins can edit their own name.
  const isAdmin = currentUser?.role === UserRole.ADMIN;

  // ---------------------------------------------------------------------------
  // Edit state — only relevant for admins
  // ---------------------------------------------------------------------------
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ firstName: "", lastName: "" });

  // Sync edit fields whenever the user record loads/changes
  useEffect(() => {
    if (user) {
      setEditData({ firstName: user.firstName, lastName: user.lastName });
    }
  }, [user]);

  const handleEditStart = () => {
    if (user) {
      setEditData({ firstName: user.firstName, lastName: user.lastName });
    }
    setIsEditing(true);
  };

  const handleEditCancel = () => setIsEditing(false);

  const handleEditSave = () => {
    if (!currentUser?.id) return;

    updateProfile.mutate({ userId: currentUser.id, data: editData }, { onSuccess: () => setIsEditing(false) });
  };

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading your profile…</p>
        </div>
      </div>
    );
  }

  const statusBadge = getUserStatusBadge(user);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate("/settings")} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white">My Profile</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">View your account information</p>
        </div>
      </div>

      {/* Contextual info banner */}
      {isAdmin ? (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-4">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-emerald-900 dark:text-emerald-300 mb-1">Administrator Profile</h3>
              <p className="text-sm text-emerald-700 dark:text-emerald-400">As an administrator you can update your first and last name. All other fields are managed by the system.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">Read-Only Profile</h3>
              <p className="text-sm text-blue-700 dark:text-blue-400">Your profile information is managed by your agency administrator. Please contact them if any details need to be changed.</p>
            </div>
          </div>
        </div>
      )}

      {/* Avatar + badges row */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg">{getUserInitials(user)}</div>
            <div className={clsx("absolute bottom-0 right-0 w-5 h-5 rounded-full border-2 border-white dark:border-gray-900", getActivityIndicatorColor(user.lastLoginAt))} />
          </div>

          {/* Name + email + badges */}
          <div className="flex-1">
            <h2 className="text-2xl font-black text-gray-900 dark:text-white">{getUserFullName(user)}</h2>
            <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1">
              <Mail className="w-4 h-4" />
              {user.email}
              {user.emailVerified && <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />}
            </p>

            <div className="flex flex-wrap gap-2 mt-3">
              <span className={clsx("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold", getRoleBadgeColor(user.role))}>
                <Shield className="w-3.5 h-3.5" />
                {getRoleDisplayName(user.role)}
              </span>
              <span className={clsx("inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold", statusBadge.color)}>
                {statusBadge.icon} {statusBadge.text}
              </span>
              {user.isTwoFactorEnabled && <span className="px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">🔐 2FA Enabled</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — personal + agency info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information card */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            {/* Card header with optional edit button */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Personal Information
              </h3>

              {/* Admin-only edit controls */}
              {isAdmin && !isEditing && (
                <button onClick={handleEditStart} className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
                  <Edit2 className="w-4 h-4" />
                  Edit Name
                </button>
              )}
              {isAdmin && isEditing && (
                <div className="flex items-center gap-2">
                  <button onClick={handleEditCancel} disabled={updateProfile.isPending} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors disabled:opacity-50">
                    <X className="w-4 h-4" />
                  </button>
                  <button onClick={handleEditSave} disabled={updateProfile.isPending} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {updateProfile.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {updateProfile.isPending ? "Saving…" : "Save"}
                  </button>
                </div>
              )}
            </div>

            {/* Card body */}
            <div className="p-6 space-y-5">
              {/* Name row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">First Name</p>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.firstName}
                      onChange={(e) => setEditData({ ...editData, firstName: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  ) : (
                    <p className="text-base font-semibold text-gray-900 dark:text-white">{user.firstName}</p>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Last Name</p>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.lastName}
                      onChange={(e) => setEditData({ ...editData, lastName: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  ) : (
                    <p className="text-base font-semibold text-gray-900 dark:text-white">{user.lastName}</p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Email Address</p>
                <p className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  {user.email}
                  {user.emailVerified && <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Email cannot be changed</p>
              </div>

              {/* Role */}
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Role</p>
                <p className="text-base font-semibold text-gray-900 dark:text-white">{getRoleDisplayName(user.role)}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Role is managed by your administrator</p>
              </div>
            </div>
          </div>

          {/* Agency Information card */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Agency Information
              </h3>
            </div>

            <div className="p-6">
              {user.agency ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Agency Name</p>
                    <p className="text-base font-semibold text-gray-900 dark:text-white">{user.agency.name}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Agency Type</p>
                      <p className="text-base font-semibold text-gray-900 dark:text-white uppercase">{user.agency.type}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Status</p>
                      <span className={clsx("inline-flex px-3 py-1 rounded-full text-sm font-semibold", user.agency.status === "ACTIVE" ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400")}>
                        {user.agency.status}
                      </span>
                    </div>
                  </div>

                  {user.agency.jurisdictionLevel && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Jurisdiction Level</p>
                      <p className="text-base font-semibold text-gray-900 dark:text-white capitalize">{user.agency.jurisdictionLevel}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Building2 className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No agency information available</p>
                </div>
              )}
            </div>
          </div>

          {/* Security status card */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                Security Status
              </h3>
            </div>

            <div className="p-6 space-y-3">
              {/* 2FA */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">Two-Factor Authentication</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{user.isTwoFactorEnabled ? `Method: ${user.twoFactorMethod || "Authenticator App"}` : "Not enabled"}</p>
                </div>
                <span className={clsx("px-2.5 py-0.5 rounded-full text-xs font-semibold", user.isTwoFactorEnabled ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400" : "bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400")}>
                  {user.isTwoFactorEnabled ? "Active" : "Inactive"}
                </span>
              </div>

              {/* Email verification */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">Email Verification</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{user.emailVerified ? "Email has been verified" : "Verification pending"}</p>
                </div>
                <span className={clsx("px-2.5 py-0.5 rounded-full text-xs font-semibold", user.emailVerified ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400")}>
                  {user.emailVerified ? "Verified" : "Pending"}
                </span>
              </div>

              {/* Password status */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">Password Status</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{user.mustChangePassword ? "Password change required on next login" : "Password is up to date"}</p>
                </div>
                <span className={clsx("px-2.5 py-0.5 rounded-full text-xs font-semibold", user.mustChangePassword ? "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400" : "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400")}>
                  {user.mustChangePassword ? "Action Required" : "OK"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right column — timeline */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                Account Timeline
              </h3>
            </div>

            <div className="p-6 space-y-5">
              {/* Last Login */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Last Login</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{formatLastLogin(user.lastLoginAt)}</p>
                  {user.lastLoginAt && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{new Date(user.lastLoginAt).toLocaleString()}</p>}
                </div>
              </div>

              {/* Account Created */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Account Created</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{new Date(user.createdAt).toLocaleDateString()}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{new Date(user.createdAt).toLocaleString()}</p>
                </div>
              </div>

              {/* Last Updated */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Last Updated</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{new Date(user.updatedAt).toLocaleDateString()}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{new Date(user.updatedAt).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
