/**
 * BFF Two-Factor Verification Component
 * 2FA code verification for BFF authentication
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { RefreshCw, CheckCircle2, Loader2, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import type { TwoFactorMethod } from "../../../types/enums.types";
import { useVerify2FA, useResendLoginOTP } from "../hooks";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "../../../components/ui/";
import { Button } from "../../../components/ui/";

const twoFactorSchema = z.object({
  code: z
    .string()
    .length(6, "Code must be exactly 6 digits")
    .regex(/^[0-9]+$/, "Code must contain only numbers"),
});

type TwoFactorFormData = z.infer<typeof twoFactorSchema>;

interface LocationState {
  email: string;
  method: TwoFactorMethod;
  preAuthToken?: string;
}

export function TwoFactorVerification() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;

  const [countdown, setCountdown] = useState(0);
  const [code, setCode] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const verifyMutation = useVerify2FA();
  const resendMutation = useResendLoginOTP();

  const {
    handleSubmit,
    setValue,
    clearErrors,
    formState: { errors },
  } = useForm<TwoFactorFormData>({
    resolver: zodResolver(twoFactorSchema),
  });

  // Redirect if no state
  useEffect(() => {
    if (!state?.email || !state?.method) {
      navigate("/login", { replace: true });
    }
  }, [state, navigate]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Update form value when code changes
  useEffect(() => {
    setValue("code", code);
    if (code.length === 6) {
      clearErrors("code");
    }
  }, [code, setValue, clearErrors]);

  // Track verification success
  useEffect(() => {
    if (verifyMutation.isSuccess) {
      setIsSuccess(true);
    }
  }, [verifyMutation.isSuccess]);

  const onSubmit = (data: TwoFactorFormData) => {
    verifyMutation.mutate({ code: data.code });
  };

  const handleResend = () => {
    if (countdown === 0 && !resendMutation.isPending) {
      resendMutation.mutate(undefined, {
        onSuccess: () => {
          setCountdown(60);
        },
      });
    }
  };

  const handleChange = (value: string) => {
    setCode(value);
    // Auto-submit when 6 digits are entered
    if (value.length === 6) {
      handleSubmit(onSubmit)();
    }
  };

  const handleBack = () => {
    navigate("/login", { replace: true });
  };

  const maskEmail = (email: string) => {
    const [localPart, domain] = email.split("@");
    if (localPart.length <= 2) return email;
    return `${localPart[0]}${"*".repeat(Math.min(localPart.length - 2, 4))}${
      localPart[localPart.length - 1]
    }@${domain}`;
  };

  const getMethodLabel = () => {
    switch (state?.method) {
      case "EMAIL":
        return "Email";
      case "GOOGLE_AUTHENTICATOR":
        return "Authenticator App";
      default:
        return "Two-Factor";
    }
  };

  // Don't render if no state
  if (!state?.email) {
    return null;
  }

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-primary" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-lg font-semibold text-foreground">
            Verified Successfully
          </p>
          <p className="text-sm text-muted-foreground">Redirecting you now...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-center space-y-2">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-foreground">
            {getMethodLabel()} Verification
          </p>
          <p className="text-xs text-muted-foreground">
            {state.method === "EMAIL"
              ? `We sent a code to ${maskEmail(state.email)}`
              : "Enter the code from your authenticator app"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* OTP Input */}
        <div className="flex flex-col items-center space-y-4">
          <div className="space-y-3">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={handleChange}
              disabled={verifyMutation.isPending}
              autoFocus
            >
              <InputOTPGroup className="gap-2 sm:gap-3">
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>

            {errors.code && (
              <p className="text-sm text-destructive text-center" role="alert">
                {errors.code.message}
              </p>
            )}
          </div>
        </div>

        {/* Verify Button */}
        <Button
          type="submit"
          className="w-full h-11"
          disabled={code.length !== 6 || verifyMutation.isPending}
        >
          {verifyMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Verifying...
            </>
          ) : (
            "Verify Code"
          )}
        </Button>
      </form>

      {/* Resend Code - only for EMAIL method */}
      {state.method === "EMAIL" && (
        <div className="text-center">
          <button
            type="button"
            onClick={handleResend}
            disabled={countdown > 0 || resendMutation.isPending}
            className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            <RefreshCw
              className={`h-4 w-4 ${resendMutation.isPending ? "animate-spin" : ""}`}
            />
            {resendMutation.isPending
              ? "Sending..."
              : countdown > 0
                ? `Resend code in ${countdown}s`
                : "Resend code"}
          </button>
        </div>
      )}

      {/* Back to Login */}
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={handleBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Back to login
        </button>
      </div>
    </div>
  );
}