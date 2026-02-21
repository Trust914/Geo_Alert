import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form"; // 1. Import useWatch
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, CheckCircle } from "lucide-react";
import { authService } from "../services";
import { AuthLayout } from "../../../components/AuthLayout";
import { Alert } from "../../../components/ui/Alert/Alert";
import { Button } from "../../../components/ui/Button/Button";
import { Input } from "../../../components/ui/Input/Input";
import { PasswordStrengthMeter } from "../../../components/ui/PasswordStrengthMeter";
import type { AxiosError } from "axios";
import type { APIResponse } from "../../../types/common.types";

const activationSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type ActivationFormData = z.infer<typeof activationSchema>;

export default function ActivateAccountPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const token = searchParams.get("token");
  const userId = searchParams.get("userId");

  // 2. FIX: Determine validity immediately, before initializing state
  const isInvalidLink = !token || !userId;

  // 3. FIX: Initialize state correctly. No need to update it in useEffect later.
  const [isVerifying, setIsVerifying] = useState(!isInvalidLink);
  const [verificationError, setVerificationError] = useState<string | null>(isInvalidLink ? "Invalid activation link" : null);

  const {
    register,
    handleSubmit,
    control, // Destructure control for useWatch
    formState: { errors },
  } = useForm<ActivationFormData>({
    resolver: zodResolver(activationSchema),
  });

  // 4. FIX: Use useWatch instead of watch (Fixes "incompatible library" error)
  const password = useWatch({
    control,
    name: "password",
    defaultValue: "",
  });

  // Verify token on mount
  useEffect(() => {
    // 5. FIX: If link is invalid, state is already set correctly above. We just exit.
    if (!token || !userId) {
      return;
    }

    authService
      .verifyActivationToken(userId, token)
      .then((response) => {
        if (!response.valid) {
          setVerificationError("Invalid or expired activation link");
        }
        setIsVerifying(false);
      })
      .catch(() => {
        setVerificationError("Invalid or expired activation link");
        setIsVerifying(false);
      });
  }, [token, userId]);

  const activateMutation = useMutation({
    mutationFn: (data: ActivationFormData) =>
      authService.activateAccount({
        userId: userId!,
        token: token!,
        password: data.password,
      }),
    onSuccess: () => {
      toast.success("Account activated successfully! Please login.");
      navigate("/login");
    },
    onError: (error: AxiosError<APIResponse>) => {
      const message = error.response?.data?.message || "Activation failed";
      toast.error(message);
    },
  });

  const onSubmit = (data: ActivationFormData) => {
    activateMutation.mutate(data);
  };

  if (isVerifying) {
    return (
      <AuthLayout title="Activating Account" subtitle="Please wait...">
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      </AuthLayout>
    );
  }

  if (verificationError) {
    return (
      <AuthLayout title="Activation Failed" subtitle="Unable to activate your account">
        <Alert variant="error" className="mb-6">
          {verificationError}
        </Alert>
        <div className="space-y-3">
          <Button onClick={() => navigate("/login")} className="w-full" variant="secondary">
            Go to Login
          </Button>
          <p className="text-center text-sm text-gray-600">
            Need help?{" "}
            <a href="/support" className="text-primary-600 hover:text-primary-500">
              Contact Support
            </a>
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Activate Your Account" subtitle="Create your password to get started">
      <Alert variant="info" className="mb-6">
        <CheckCircle className="h-5 w-5" />
        <span>Your activation link is valid. Create a strong password to continue.</span>
      </Alert>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          {...register("password")}
          type={showPassword ? "text" : "password"}
          label="Create Password"
          placeholder="Enter a strong password"
          error={errors.password?.message}
          leftIcon={<Lock className="h-5 w-5 text-gray-400" />}
          rightIcon={
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-gray-400 hover:text-gray-600">
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          }
          disabled={activateMutation.isPending}
          required
        />

        {password && <PasswordStrengthMeter password={password} />}

        <Input
          {...register("confirmPassword")}
          type={showConfirm ? "text" : "password"}
          label="Confirm Password"
          placeholder="Re-enter your password"
          error={errors.confirmPassword?.message}
          leftIcon={<Lock className="h-5 w-5 text-gray-400" />}
          rightIcon={
            <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="text-gray-400 hover:text-gray-600">
              {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          }
          disabled={activateMutation.isPending}
          required
        />

        <Button type="submit" className="w-full" isLoading={activateMutation.isPending} disabled={activateMutation.isPending}>
          Activate Account
        </Button>
      </form>
    </AuthLayout>
  );
}
