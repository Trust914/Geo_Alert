/**
 * BFF Change Password Form
 * Password change form with step-up 2FA requirement
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Eye, EyeOff, Lock, X } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "../../../components/ui/";
import { Input } from "../../../components/ui/";
import { useChangePassword, useLogout } from "../hooks";
import { StepUp2FAModal } from "./StepUp2FAModal";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(
        /[^A-Za-z0-9]/,
        "Password must contain at least one special character"
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type PasswordFormData = z.infer<typeof passwordSchema>;

export function ChangePasswordForm() {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [pendingPasswordData, setPendingPasswordData] =
    useState<PasswordFormData | null>(null);

  const { mutate: changePassword, isPending } = useChangePassword();
  const { mutate: logout } = useLogout();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const newPassword = useWatch({
    control,
    name: "newPassword",
    defaultValue: "",
  });

  const passwordRequirements = [
    { label: "At least 8 characters", met: newPassword.length >= 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(newPassword) },
    { label: "One lowercase letter", met: /[a-z]/.test(newPassword) },
    { label: "One number", met: /[0-9]/.test(newPassword) },
    { label: "One special character", met: /[^A-Za-z0-9]/.test(newPassword) },
  ];

  const onSubmit = (data: PasswordFormData) => {
    // Store the data and show 2FA modal
    setPendingPasswordData(data);
    setShow2FAModal(true);
  };

  const handleConfirm2FA = (code: string) => {
    if (!pendingPasswordData) return;

    changePassword(
      {
        currentPassword: pendingPasswordData.currentPassword,
        newPassword: pendingPasswordData.newPassword,
        twoFactorCode: code,
      },
      {
        onSuccess: () => {
          setShow2FAModal(false);
          setPendingPasswordData(null);
          // Logout after password change
          setTimeout(() => {
            logout();
          }, 2000);
        },
        onError: () => {
          // Keep modal open on error so user can retry
        },
      }
    );
  };

  return (
    <>
      <div className="space-y-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            {...register("currentPassword")}
            type={showCurrent ? "text" : "password"}
            label="Current Password"
            placeholder="Enter current password"
            error={errors.currentPassword?.message}
            leftIcon={<Lock className="h-5 w-5 text-gray-400" />}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="text-gray-400 hover:text-gray-600"
              >
                {showCurrent ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            }
            disabled={isPending}
            required
          />

          <Input
            {...register("newPassword")}
            type={showNew ? "text" : "password"}
            label="New Password"
            placeholder="Enter new password"
            error={errors.newPassword?.message}
            leftIcon={<Lock className="h-5 w-5 text-gray-400" />}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="text-gray-400 hover:text-gray-600"
              >
                {showNew ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            }
            disabled={isPending}
            required
          />

          {/* Password Requirements */}
          {newPassword && (
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Password Requirements:
              </p>
              <ul className="space-y-1">
                {passwordRequirements.map((req, index) => (
                  <li key={index} className="flex items-center text-sm">
                    {req.met ? (
                      <Check className="h-4 w-4 text-green-500 mr-2" />
                    ) : (
                      <X className="h-4 w-4 text-gray-400 mr-2" />
                    )}
                    <span className={req.met ? "text-green-700" : "text-gray-600"}>
                      {req.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Input
            {...register("confirmPassword")}
            type={showConfirm ? "text" : "password"}
            label="Confirm New Password"
            placeholder="Re-enter new password"
            error={errors.confirmPassword?.message}
            leftIcon={<Lock className="h-5 w-5 text-gray-400" />}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="text-gray-400 hover:text-gray-600"
              >
                {showConfirm ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            }
            disabled={isPending}
            required
          />

          <Button
            type="submit"
            className="w-full"
            isLoading={isPending}
            disabled={isPending}
          >
            Change Password
          </Button>
        </form>
      </div>

      <StepUp2FAModal
        isOpen={show2FAModal}
        onClose={() => {
          setShow2FAModal(false);
          setPendingPasswordData(null);
        }}
        onConfirm={handleConfirm2FA}
        isLoading={isPending}
        title="Verify Your Identity"
        description="For security, please enter your 2FA code to change your password."
      />
    </>
  );
}