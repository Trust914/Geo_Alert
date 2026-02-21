import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, Shield } from "lucide-react";

import { authService } from "../services";
import type { AxiosError } from "axios";
import type { APIResponse } from "../../../types/common.types";
import { AuthLayout } from "../../../components/AuthLayout";
import { Alert } from "../../../components/ui/Alert/Alert";
import { Button } from "../../../components/ui/Button/Button";
import { Input } from "../../../components/ui/Input/Input";
import { PasswordStrengthMeter } from "../../../components/ui/PasswordStrengthMeter";
import type { VerificationResponse } from "../types";

const resetSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
    confirmPassword: z.string(),
    totpCode: z.string().optional(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type ResetFormData = z.infer<typeof resetSchema>;

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const token = searchParams.get("token");
  const userId = searchParams.get("userId");
  const isInvalidLink = !token || !userId;
  const [isVerifying, setIsVerifying] = useState(!isInvalidLink);
  const [verificationData, setVerificationData] = useState<VerificationResponse | null>(null);

  const [verificationError, setVerificationError] = useState<string | null>(isInvalidLink ? "Invalid reset link" : null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    setError,
  } = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
  });

  const newPassword = useWatch({ control, name: "newPassword", defaultValue: "" });

  // Verify token on mount
  useEffect(() => {
    // If link is invalid, state is already set correctly above. We just exit.
    if (isInvalidLink || !userId || !token) {
      return;
    }

    authService
      .verifyResetToken(userId, token)
      .then((response) => {
        if (!response.valid) {
          setVerificationError("Invalid or expired reset link");
        } else {
          // Safe to cast here because service returns this shape
          setVerificationData(response as VerificationResponse);
        }
        setIsVerifying(false);
      })
      .catch(() => {
        setVerificationError("Invalid or expired reset link");
        setIsVerifying(false);
      });
  }, [token, userId, isInvalidLink]);

  const resetMutation = useMutation({
    mutationFn: (data: ResetFormData) =>
      authService.completePasswordReset({
        userId: userId!,
        token: token!,
        newPassword: data.newPassword,
        totpCode: data.totpCode,
      }),
    onSuccess: () => {
      toast.success("Password reset successfully! Please login with your new password.");
      navigate("/login");
    },
    onError: (error: AxiosError<APIResponse>) => {
      // ✅ 5. FIX: Safe access to custom error properties
      // We explicitly tell TS that 'data' might have a 'code' property
      const errorData = error.response?.data as (APIResponse & { code?: string }) | undefined;

      // Check if 2FA code is required but missing
      if (errorData?.code === "2FA_REQUIRED") {
        setError("totpCode", {
          message: "Verification code is required",
        });
        toast.error("Please enter your verification code");
      } else if (errorData?.code === "2FA_INVALID") {
        setError("totpCode", {
          message: "Invalid verification code",
        });
      } else {
        const message = errorData?.message || "Password reset failed";
        toast.error(message);
      }
    },
  });

  const onSubmit = (data: ResetFormData) => {
    // Validate 2FA code if required
    if (verificationData?.requiresTwoFactor && !data.totpCode) {
      setError("totpCode", {
        message: "Verification code is required",
      });
      return;
    }

    resetMutation.mutate(data);
  };

  if (isVerifying) {
    return (
      <AuthLayout title="Verifying Link" subtitle="Please wait...">
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      </AuthLayout>
    );
  }

  if (verificationError) {
    return (
      <AuthLayout title="Reset Failed" subtitle="Unable to reset your password">
        <Alert variant="error" className="mb-6">
          {verificationError}
        </Alert>
        <div className="space-y-3">
          <Button onClick={() => navigate("/login")} className="w-full" variant="secondary">
            Go to Login
          </Button>
          <p className="text-center text-sm text-gray-600">
            Need a new link?{" "}
            <a href="/forgot-password" className="text-primary-600 hover:text-primary-500">
              Request Password Reset
            </a>
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Reset Your Password" subtitle="Create a new secure password">
      {verificationData?.requiresTwoFactor && (
        <Alert variant="info" className="mb-6">
          <Shield className="h-5 w-5" />
          <span>You'll need your {verificationData.twoFactorMethod === "EMAIL" ? "email" : "authenticator app"} verification code to complete this reset.</span>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          {...register("newPassword")}
          type={showPassword ? "text" : "password"}
          label="New Password"
          placeholder="Enter new password"
          error={errors.newPassword?.message}
          leftIcon={<Lock className="h-5 w-5 text-gray-400" />}
          rightIcon={
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-gray-400 hover:text-gray-600">
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          }
          disabled={resetMutation.isPending}
          required
        />

        {newPassword && <PasswordStrengthMeter password={newPassword} />}

        <Input
          {...register("confirmPassword")}
          type={showConfirm ? "text" : "password"}
          label="Confirm New Password"
          placeholder="Re-enter new password"
          error={errors.confirmPassword?.message}
          leftIcon={<Lock className="h-5 w-5 text-gray-400" />}
          rightIcon={
            <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="text-gray-400 hover:text-gray-600">
              {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          }
          disabled={resetMutation.isPending}
          required
        />

        {verificationData?.requiresTwoFactor && (
          <Input
            {...register("totpCode")}
            type="text"
            label="Verification Code"
            placeholder="Enter 6-digit code"
            error={errors.totpCode?.message}
            maxLength={6}
            autoComplete="one-time-code"
            disabled={resetMutation.isPending}
            helperText={verificationData.twoFactorMethod === "EMAIL" ? "Check your email for the verification code" : "Enter the code from your authenticator app"}
            required
          />
        )}

        <Button type="submit" className="w-full" isLoading={resetMutation.isPending} disabled={resetMutation.isPending}>
          Reset Password
        </Button>
      </form>

      <div className="mt-6 text-center">
        <button type="button" onClick={() => navigate("/login")} className="text-sm text-gray-600 hover:text-gray-900">
          Back to login
        </button>
      </div>
    </AuthLayout>
  );
}
