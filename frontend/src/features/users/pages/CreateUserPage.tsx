import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus, Mail, User as UserIcon, Shield, ArrowLeft, AlertCircle, Building2 } from "lucide-react";
import clsx from "clsx";

import type { ICreateUserForm, ISafeUser } from "../types/";
import { useCreateUser, useAgencies } from "../hooks/";
import { isValidEmail, isValidName, isSuperAdmin } from "../utils/";
import { UserRole } from "../../../types/enums.types";
import { Button } from "../../../components/ui/Button/Button";
import { Card } from "../../../components/ui/Card/Card";
import { useBFF } from "../../bff_auth/context";
import { RoleSelector } from "../components/RoleSelector";
import type {  IAgencyOption } from "../../agencies/types";

export default function CreateUserPage() {
  const navigate = useNavigate();
  const { user: currentUser } = useBFF();
  const { mutate: createUser, isPending } = useCreateUser();

  // Check if current user is super admin
  const isCurrentUserSuperAdmin = currentUser ? isSuperAdmin(currentUser as ISafeUser) : false;

  // Fetch agencies list (only for super admins)
  const { data: agencies, isLoading: isLoadingAgencies } = useAgencies();

  const [formData, setFormData] = useState<ICreateUserForm>({
    email: "",
    firstName: "",
    lastName: "",
    role: UserRole.OPERATOR,
    // For regular admins, auto-populate their agency
    // For super admins, leave empty until they select one
    agencyId: isCurrentUserSuperAdmin ? "" : (currentUser?.agencyId || ""),
  });

  const [errors, setErrors] = useState<Partial<Record<keyof ICreateUserForm, string>>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof ICreateUserForm, string>> = {};

    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!isValidEmail(formData.email)) {
      newErrors.email = "Invalid email format";
    }

    if (!formData.firstName) {
      newErrors.firstName = "First name is required";
    } else if (!isValidName(formData.firstName)) {
      newErrors.firstName = "First name must be 2-50 characters";
    }

    if (!formData.lastName) {
      newErrors.lastName = "Last name is required";
    } else if (!isValidName(formData.lastName)) {
      newErrors.lastName = "Last name must be 2-50 characters";
    }

    if (!formData.role) {
      newErrors.role = "Role is required";
    }

    // For super admins, agency selection is required
    if (isCurrentUserSuperAdmin && !formData.agencyId) {
      newErrors.agencyId = "Please select an agency";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    createUser(formData, {
      onSuccess: () => {
        navigate("/users");
      },
    });
  };

  const handleCancel = () => {
    navigate("/users");
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4 flex-1">
          <Button variant="ghost" size="sm" onClick={handleCancel} leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Back
          </Button>

          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-900 dark:text-white">Create New User</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {isCurrentUserSuperAdmin
                    ? "Add a new user to any agency"
                    : "Add a new staff member to your agency"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Super Admin Notice */}
      {isCurrentUserSuperAdmin && (
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <div className="flex gap-3 p-4">
            <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">Super Administrator</h3>
              <p className="text-sm text-blue-700 dark:text-blue-400">
                You can create users for any agency in the system. Please select the target agency below.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-4xl">
        <Card>
          <div className="p-6 space-y-6">
            {/* Agency Selection (Super Admin Only) */}
            {isCurrentUserSuperAdmin && (
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Target Agency <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  <select
                    value={formData.agencyId}
                    onChange={(e) => {
                      setFormData({ ...formData, agencyId: e.target.value });
                      if (errors.agencyId) setErrors({ ...errors, agencyId: undefined });
                    }}
                    disabled={isLoadingAgencies}
                    className={clsx(
                      "w-full pl-10 pr-4 py-3 rounded-xl border transition-all appearance-none",
                      "bg-white dark:bg-gray-800 text-gray-900 dark:text-white",
                      errors.agencyId
                        ? "border-red-300 dark:border-red-500/50 bg-red-50 dark:bg-red-900/10"
                        : "border-gray-200 dark:border-gray-700",
                      "focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    <option value="">
                      {isLoadingAgencies ? "Loading agencies..." : "Select an agency..."}
                    </option>
                    {agencies?.map((agency: IAgencyOption) => (
                      <option key={agency.id} value={agency.id}>
                        {agency.name} ({agency.type} - {agency.jurisdictionLevel})
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {errors.agencyId && (
                  <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.agencyId}
                  </p>
                )}
              </div>
            )}

            {/* Email */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    if (errors.email) setErrors({ ...errors, email: undefined });
                  }}
                  placeholder="user@agency.gov"
                  className={clsx(
                    "w-full pl-10 pr-4 py-3 rounded-xl border transition-all",
                    "bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400",
                    errors.email
                      ? "border-red-300 dark:border-red-500/50 bg-red-50 dark:bg-red-900/10"
                      : "border-gray-200 dark:border-gray-700",
                    "focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  )}
                />
              </div>
              {errors.email && (
                <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.email}
                </p>
              )}
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* First Name */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  First Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => {
                      setFormData({ ...formData, firstName: e.target.value });
                      if (errors.firstName) setErrors({ ...errors, firstName: undefined });
                    }}
                    placeholder="John"
                    className={clsx(
                      "w-full pl-10 pr-4 py-3 rounded-xl border transition-all",
                      "bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400",
                      errors.firstName
                        ? "border-red-300 dark:border-red-500/50 bg-red-50 dark:bg-red-900/10"
                        : "border-gray-200 dark:border-gray-700",
                      "focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    )}
                  />
                </div>
                {errors.firstName && (
                  <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.firstName}
                  </p>
                )}
              </div>

              {/* Last Name */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => {
                      setFormData({ ...formData, lastName: e.target.value });
                      if (errors.lastName) setErrors({ ...errors, lastName: undefined });
                    }}
                    placeholder="Doe"
                    className={clsx(
                      "w-full pl-10 pr-4 py-3 rounded-xl border transition-all",
                      "bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400",
                      errors.lastName
                        ? "border-red-300 dark:border-red-500/50 bg-red-50 dark:bg-red-900/10"
                        : "border-gray-200 dark:border-gray-700",
                      "focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    )}
                  />
                </div>
                {errors.lastName && (
                  <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.lastName}
                  </p>
                )}
              </div>
            </div>

            {/* Role Selection */}
            <RoleSelector
              selectedRole={formData.role}
              onRoleChange={(role) => {
                setFormData({ ...formData, role });
                if (errors.role) setErrors({ ...errors, role: undefined });
              }}
            />
            {errors.role && (
              <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1 -mt-2">
                <AlertCircle className="w-4 h-4" />
                {errors.role}
              </p>
            )}

            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-700 dark:text-blue-400">
                  <p className="font-semibold mb-1">Activation Required</p>
                  <p>
                    An activation email will be sent to <strong>{formData.email || "the user"}</strong>.
                    They must verify their email and set a password before accessing the system.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isPending}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="default"
                disabled={isPending}
                isLoading={isPending}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                leftIcon={<UserPlus className="w-5 h-5" />}
              >
                {isPending ? "Creating User..." : "Create User"}
              </Button>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
}