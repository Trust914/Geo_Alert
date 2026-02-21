import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Loader2, Shield, User, Mail, Info } from "lucide-react";
// import { useAuth } from "../../auth/hooks";
import { useUserById, useUpdateUser } from "../hooks";
import type { IUpdateUserDTO } from "../types/";
import { UserRole } from "../../../types/enums.types";
import clsx from "clsx";
import { RoleSelector } from "../components/RoleSelector";
import { useBFF } from "../../bff_auth/context";

export default function UpdateUserPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useBFF();

  // Derived: is the admin editing their own account?
  const isOwnProfile = userId === currentUser?.id;

  // Queries & Mutations
  const { data: user, isLoading: isLoadingUser } = useUserById(userId || null);
  const updateMutation = useUpdateUser();

  // Form State
  const [formData, setFormData] = useState<IUpdateUserDTO>({
    firstName: "",
    lastName: "",
    role: UserRole.VIEWER,
    isActive: true,
  });

  // Initialize form when user data loads
  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    // When editing own profile, strip role & isActive so they are never sent —
    // even if the form state somehow changed.  Defence in depth.
    const payload: IUpdateUserDTO = isOwnProfile ? { firstName: formData.firstName, lastName: formData.lastName } : formData;

    updateMutation.mutate(
      { userId, data: payload },
      {
        onSuccess: () => {
          navigate(`/users/${userId}`);
        },
      },
    );
  };

  const handleCancel = () => {
    navigate(-1);
  };

  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------

  if (isLoadingUser) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading user details...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 text-lg">User not found</p>
          <button onClick={() => navigate("/users")} className="mt-4 text-emerald-600 hover:text-emerald-700">
            Return to User Management
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white">Edit User</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Update information for {user.firstName} {user.lastName}
            {isOwnProfile && <span className="ml-2 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded">You</span>}
          </p>
        </div>
      </div>

      {/* Context Banner — adapts based on whether editing own or another user */}
      {isOwnProfile ? (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <Info className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-300 mb-1">Editing Your Own Account</h3>
              <p className="text-sm text-amber-700 dark:text-amber-400">You can update your first and last name. Your role and account status cannot be changed by yourself — contact another administrator if those need to be modified.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">Administrator Access</h3>
              <p className="text-sm text-blue-700 dark:text-blue-400">As an administrator, you can update this user's personal information, role, and account status. Changes take effect immediately.</p>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-6">
        {/* Current Email (read-only) */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <Mail className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Email</span>
          </div>
          <p className="text-gray-900 dark:text-white font-medium">{user.email}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Email cannot be changed</p>
        </div>

        {/* Personal Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <User className="w-5 h-5" />
            Personal Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                placeholder="Enter first name"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                placeholder="Enter last name"
              />
            </div>
          </div>
        </div>

        {/* Role Selection */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Role & Permissions
          </h3>

          {isOwnProfile && <p className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2">You cannot change your own role. Contact another administrator if this needs to be updated.</p>}

          <RoleSelector selectedRole={formData.role!} onRoleChange={(role) => setFormData({ ...formData, role })} disabled={isOwnProfile} />
        </div>

        {/* Account Status */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Account Status</h3>

          {isOwnProfile && <p className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2">You cannot change your own account status. Contact another administrator if needed.</p>}

          <div className={clsx("flex items-center gap-4", isOwnProfile && "opacity-50 pointer-events-none")}>
            {/* Active */}
            <button
              type="button"
              onClick={() => setFormData({ ...formData, isActive: true })}
              disabled={isOwnProfile}
              className={clsx("flex-1 p-4 rounded-xl border-2 transition-all", formData.isActive ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10" : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600", isOwnProfile && "cursor-not-allowed")}
            >
              <div className="flex items-center gap-3">
                <div className={clsx("w-5 h-5 rounded-full border-2 flex items-center justify-center", formData.isActive ? "border-emerald-500 bg-emerald-500" : "border-gray-300 dark:border-gray-600")}>{formData.isActive && <div className="w-2 h-2 rounded-full bg-white" />}</div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900 dark:text-white">Active</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">User can access the system</p>
                </div>
              </div>
            </button>

            {/* Inactive */}
            <button
              type="button"
              onClick={() => setFormData({ ...formData, isActive: false })}
              disabled={isOwnProfile}
              className={clsx("flex-1 p-4 rounded-xl border-2 transition-all", !formData.isActive ? "border-red-500 bg-red-50 dark:bg-red-500/10" : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600", isOwnProfile && "cursor-not-allowed")}
            >
              <div className="flex items-center gap-3">
                <div className={clsx("w-5 h-5 rounded-full border-2 flex items-center justify-center", !formData.isActive ? "border-red-500 bg-red-500" : "border-gray-300 dark:border-gray-600")}>{!formData.isActive && <div className="w-2 h-2 rounded-full bg-white" />}</div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900 dark:text-white">Inactive</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">User cannot access the system</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={handleCancel}
            disabled={updateMutation.isPending}
            className="flex-1 px-6 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
