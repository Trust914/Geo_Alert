"use client";

import { useState } from "react";
import { Shield, Smartphone, Mail, Key, AlertTriangle, ArrowRight } from "lucide-react";
import { TOTPSetup } from "../TOTPSetup";
import { EmailSetup } from "../EmailSetup";
// import { useAuth } from "../../../auth/context";
import type { TwoFactorMethod } from "../../../../types/enums.types";
import { use2FAStatus, useDisable2FA, useRegenerateBackupCodes, useRequestOtp } from "../../hooks";
import { useVerifyPassword } from "../../hooks/useVerifyPassword";
import { Card } from "../../../../components/ui/Card/Card";
import { Button } from "../../../../components/ui/Button/Button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "../../../../components/ui/InputOTP";
import { Input } from "../../../../components/ui/Input/Input";
import { useBFF } from "../../../bff_auth/context";

export function TwoFactorSettings() {
  const { user } = useBFF();

  // --- Queries & Mutations ---
  const { data: status, isLoading } = use2FAStatus();
  const { mutate: disable2FA, isPending: isDisabling } = useDisable2FA();
  const { mutate: regenerateCodes, isPending: isRegenerating } = useRegenerateBackupCodes();
  const { mutate: requestOtp, isPending: isRequestingOtp } = useRequestOtp();
  const { mutateAsync: verifyPassword, isPending: isVerifyingPwd } = useVerifyPassword();

  // --- Local State ---
  const [setupMethod, setSetupMethod] = useState<TwoFactorMethod | null>(null);

  // Disable 2FA State
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [disableStep, setDisableStep] = useState<"PASSWORD" | "OTP">("PASSWORD");

  // Regenerate Codes State
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  // Form Inputs
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newBackupCodes, setNewBackupCodes] = useState<string[]>([]);

  // --- Handlers ---
  const resetForms = () => {
    setShowDisableConfirm(false);
    setShowRegenerateConfirm(false);
    setDisableStep("PASSWORD");
    setPassword("");
    setOtpCode("");
  };

  const handleVerifyPasswordForDisable = async () => {
    try {
      if (!password) return;
      await verifyPassword(password);
      setDisableStep("OTP");
      if (status?.method === "EMAIL") {
        requestOtp();
      }
    } catch (error) {
      console.error("Password verification failed", error);
    }
  };

  const handleDisable2FA = () => {
    if (!password || !otpCode) return;

    disable2FA(
      { password, code: otpCode },
      {
        onSuccess: () => {
          resetForms();
        },
      },
    );
  };

  const handleRegenerateCodes = () => {
    if (!otpCode) return;

    regenerateCodes(otpCode, {
      onSuccess: (data) => {
        setNewBackupCodes(data.backupCodes);
        resetForms();
      },
    });
  };

  const handleRequestOtp = () => {
    requestOtp();
  };

  // --- Render Components ---
  const renderOtpInput = () => (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-sm text-gray-600 mb-2">
          Enter the 6-digit code from your {status?.method === "GOOGLE_AUTHENTICATOR" ? "authenticator app" : "email"}
        </p>
        <InputOTP
          maxLength={6}
          value={otpCode}
          onChange={setOtpCode}
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
      </div>

      {status?.method === "EMAIL" && (
        <div className="text-center">
          <button
            type="button"
            onClick={handleRequestOtp}
            disabled={isRequestingOtp}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {isRequestingOtp ? "Sending code..." : "Resend code"}
          </button>
        </div>
      )}
    </div>
  );

  // --- Main Render ---
  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading 2FA settings...</p>
      </div>
    );
  }

  // Setup Wizards
  if (setupMethod === "GOOGLE_AUTHENTICATOR") {
    return <TOTPSetup onSuccess={() => setSetupMethod(null)} onCancel={() => setSetupMethod(null)} />;
  }

  if (setupMethod === "EMAIL" && user) {
    return <EmailSetup userEmail={user.email} onSuccess={() => setSetupMethod(null)} onCancel={() => setSetupMethod(null)} />;
  }

  // New Backup Codes Display
  if (newBackupCodes.length > 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">New Backup Codes Generated</h3>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2 mt-0.5" />
            <div>
              <p className="text-sm text-yellow-800 font-medium mb-1">Important</p>
              <p className="text-sm text-yellow-700">
                Your old backup codes are now invalid. Save these new codes in a safe place.
              </p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {newBackupCodes.map((code, index) => (
            <div
              key={index}
              className="p-3 bg-gray-50 rounded-lg border border-gray-200 font-mono text-sm text-center"
            >
              {code}
            </div>
          ))}
        </div>
        <Button onClick={() => setNewBackupCodes([])} className="w-full">
          I've Saved These Codes
        </Button>
      </Card>
    );
  }

  // Main Settings
  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`rounded-full p-2 ${status?.enabled ? "bg-green-100" : "bg-gray-100"}`}>
              <Shield className={`h-5 w-5 ${status?.enabled ? "text-green-600" : "text-gray-400"}`} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Two-Factor Authentication</h3>
              <p className="text-sm text-gray-600">
                {status?.enabled
                  ? `Enabled via ${status.method === "GOOGLE_AUTHENTICATOR" ? "Authenticator App" : "Email"}`
                  : "Not enabled"
                }
              </p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${status?.enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
            {status?.enabled ? "Active" : "Inactive"}
          </span>
        </div>

        {!status?.enabled && (
          <div className="mt-4 space-y-3">
            <Button
              onClick={() => setSetupMethod("GOOGLE_AUTHENTICATOR")}
              className="w-full justify-start"
              variant="outline"
            >
              <Smartphone className="h-4 w-4 mr-2" />
              Set up with Authenticator App
            </Button>
            <Button
              onClick={() => setSetupMethod("EMAIL")}
              className="w-full justify-start"
              variant="outline"
            >
              <Mail className="h-4 w-4 mr-2" />
              Set up with Email
            </Button>
          </div>
        )}
      </Card>

      {/* Backup Codes */}
      {status?.enabled && (
        <Card className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <Key className="h-5 w-5 text-gray-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Backup Codes</h3>
              <p className="text-sm text-gray-600 mb-2">
                Emergency codes to access your account if you lose your 2FA device.
              </p>
              {status.backupCodesRemaining !== undefined && (
                <p className="text-sm font-medium text-blue-600">
                  {status.backupCodesRemaining} codes remaining
                </p>
              )}
            </div>
          </div>

          {!showRegenerateConfirm ? (
            <Button
              onClick={() => setShowRegenerateConfirm(true)}
              variant="outline"
              className="w-full"
            >
              Generate New Backup Codes
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2 mt-0.5" />
                  <p className="text-sm text-yellow-800">
                    Generating new codes will invalidate your existing backup codes.
                  </p>
                </div>
              </div>

              {renderOtpInput()}

              <div className="flex gap-3">
                <Button
                  onClick={handleRegenerateCodes}
                  isLoading={isRegenerating}
                  disabled={otpCode.length !== 6 || isRegenerating}
                  className="flex-1"
                >
                  Generate New Codes
                </Button>
                <Button onClick={resetForms} variant="outline" className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Disable 2FA */}
      {status?.enabled && (
        <Card className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Disable 2FA</h3>
              <p className="text-sm text-gray-600">
                This will make your account less secure.
              </p>
            </div>
          </div>

          {!showDisableConfirm ? (
            <Button
              onClick={() => setShowDisableConfirm(true)}
              variant="outline"
              className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              Disable Two-Factor Authentication
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  {disableStep === "PASSWORD"
                    ? "For security, verify your password first."
                    : "Enter your 2FA code to confirm."
                  }
                </p>
              </div>

              {disableStep === "PASSWORD" ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Current Password
                    </label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full"
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={handleVerifyPasswordForDisable}
                      isLoading={isVerifyingPwd}
                      disabled={!password || isVerifyingPwd}
                      className="flex-1"
                    >
                      Verify Password
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <Button onClick={resetForms} variant="outline" className="flex-1">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {renderOtpInput()}

                  <div className="flex gap-3">
                    <Button
                      onClick={handleDisable2FA}
                      isLoading={isDisabling}
                      disabled={otpCode.length !== 6 || isDisabling}
                      className="flex-1 bg-red-600 hover:bg-red-700"
                    >
                      Confirm Disable
                    </Button>
                    <Button onClick={resetForms} variant="outline" className="flex-1">
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}