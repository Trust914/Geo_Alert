import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, Loader2, AlertCircle, Eye, EyeOff, ShieldCheck, Mail, ArrowRight } from "lucide-react";
import clsx from "clsx";

import { PasswordStrengthIndicator } from "../components/";
import { useCompleteActivation, useVerifyToken, useResendActivation } from "../hooks/";
import type { ActivationFormData, ActivationState } from "../types/";
import { AuthLayout } from "../../../components/AuthLayout";
import { bffAxiosInstance } from "../../../lib/axios";

// Validation schema matching backend
const activationSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .refine(
        (password) => {
          const hasUpperCase = /[A-Z]/.test(password);
          const hasLowerCase = /[a-z]/.test(password);
          const hasNumbers = /\d/.test(password);
          const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

          const criteriaMet = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(Boolean).length;

          return criteriaMet >= 3;
        },
        {
          message: "Password must contain at least 3 of: uppercase, lowercase, numbers, special characters",
        },
      ),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export default function ActivateAccountPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token");
  const userId = searchParams.get("userId");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [state, setState] = useState<ActivationState>({
    step: "verifying",
  });

  const verifyToken = useVerifyToken();
  const completeActivation = useCompleteActivation();
  const resendActivation = useResendActivation();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ActivationFormData>({
    resolver: zodResolver(activationSchema),
  });

  const password = watch("password");

  // Verify token on mount
  useEffect(() => {
    if (!token || !userId) {
      setState({
        step: "error",
        error: "Invalid activation link. Token or User ID is missing.",
      });
      return;
    }

    verifyToken.mutate(
      { token, userId },
      {
        onSuccess: (data) => {
          setState({
            step: "form",
            email: data.data.email,
            accountType: data.data.accountType,
          });
        },
        onError: (error: any) => {
          console.error("Verification Error:", error);
          const errorMessage = error.response?.data?.message || "Invalid or expired activation link";
          setState({
            step: "error",
            error: errorMessage,
          });
          toast.error(errorMessage);
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, userId]);

  const onSubmit = async (data: ActivationFormData) => {
    if (!token || !userId) {
      toast.error("Invalid activation parameters");
      return;
    }

    completeActivation.mutate(
      {
        userId,
        token,
        password: data.password,
        confirmPassword: data.confirmPassword,
      },
      {
        // onSuccess: () => {
        //   setState({ step: "success" });
        //   toast.success("Account activated successfully! Redirecting to login...");

        //   setTimeout(() => {
        //     navigate("/login", { replace: true });
        //   }, 3000);
        // },
        onSuccess: async () => {
          setState({ step: "success" });
          toast.success("Account activated! Redirecting to login...");

          setTimeout(async () => {
            try {
              // Clear any existing session before redirecting
              await bffAxiosInstance.post("/bff/logout");
            } catch {
              // Ignore errors — session may already be invalid
            } finally {
              navigate("/login", { replace: true });
            }
          }, 3000);
        },
        onError: (error: any) => {
          const errorMessage = error.response?.data?.message || "Failed to activate account";
          toast.error(errorMessage);
        },
      },
    );
  };

  const handleResendEmail = async () => {
    if (!userId) {
      toast.error("User ID is missing");
      return;
    }

    resendActivation.mutate(
      { userId },
      {
        onSuccess: () => {
          toast.success("Activation email sent! Please check your inbox.");
        },
        onError: (error: any) => {
          const errorMessage = error.response?.data?.message || "Failed to resend activation email";
          toast.error(errorMessage);
        },
      },
    );
  };

  // LOADING STATE
  if (state.step === "verifying") {
    return (
      <AuthLayout>
        <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 sm:p-10">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20">
              <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Verifying Your Link</h2>
              <p className="text-gray-500 dark:text-gray-400 mt-2">Please wait while we verify your activation link...</p>
            </div>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // ERROR STATE
  if (state.step === "error") {
    return (
      <AuthLayout>
        <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 sm:p-10">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/20">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Activation Failed</h2>
              <p className="text-gray-500 dark:text-gray-400 mt-2">{state.error}</p>
            </div>

            <div className="space-y-3">
              <button onClick={handleResendEmail} disabled={resendActivation.isPending} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {resendActivation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Resend Activation Email
                  </>
                )}
              </button>

              <Link to="/login" className="block w-full text-center px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // SUCCESS STATE
  if (state.step === "success") {
    return (
      <AuthLayout>
        <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 sm:p-10">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Account Activated!</h2>
              <p className="text-gray-500 dark:text-gray-400 mt-2">Your account has been successfully activated. Redirecting to login...</p>
            </div>
            <div className="flex justify-center">
              <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
            </div>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // FORM STATE
  return (
    <AuthLayout>
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 sm:p-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 mb-4">
            <ShieldCheck className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Activate Your Account</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Set up a secure password for <span className="font-medium text-emerald-600 dark:text-emerald-400">{state.email}</span>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                {...register("password")}
                type={showPassword ? "text" : "password"}
                id="password"
                className={clsx(
                  "w-full px-4 py-3 rounded-xl border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20",
                  errors.password ? "border-red-300 dark:border-red-500/50" : "border-gray-300 dark:border-gray-700",
                )}
                placeholder="Enter secure password"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.password.message}</p>}
          </div>

          {/* Password Strength Indicator */}
          {password && <PasswordStrengthIndicator password={password} />}

          {/* Confirm Password Field */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <input
                {...register("confirmPassword")}
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                className={clsx(
                  "w-full px-4 py-3 rounded-xl border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20",
                  errors.confirmPassword ? "border-red-300 dark:border-red-500/50" : "border-gray-300 dark:border-gray-700",
                )}
                placeholder="Re-enter password"
              />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.confirmPassword && <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.confirmPassword.message}</p>}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || completeActivation.isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            {isSubmitting || completeActivation.isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Activating Account...
              </>
            ) : (
              <>
                Activate Account
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* Footer Note */}
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <p className="text-xs text-gray-600 dark:text-gray-400 text-center">🔒 Your password is encrypted end-to-end. We never store passwords in plain text.</p>
        </div>
      </div>
    </AuthLayout>
  );
}
