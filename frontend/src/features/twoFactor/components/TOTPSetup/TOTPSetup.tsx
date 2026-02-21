import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Smartphone, Copy, Check } from "lucide-react";
import type { TOTPSetupData } from "../../types";
import { useTOTPSetup, useVerifyTOTP } from "../../hooks";
import { Card } from "../../../../components/ui/Card/Card";
import { Button } from "../../../../components/ui/Button/Button";
import { Alert } from "../../../../components/ui/Alert/Alert";
import { Input } from "../../../../components/ui/Input/Input";

const verifySchema = z.object({
  token: z.string().length(6, "Token must be 6 digits").regex(/^\d+$/, "Token must be numeric"),
});

type VerifyFormData = z.infer<typeof verifySchema>;

interface TOTPSetupProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function TOTPSetup({ onSuccess, onCancel }: TOTPSetupProps) {
  const [setupData, setSetupData] = useState<TOTPSetupData | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCode, setCopiedCode] = useState<number | null>(null);

  const { mutate: setupTOTP, isPending: isSetupPending } = useTOTPSetup();
  const { mutate: verifyTOTP, isPending: isVerifyPending } = useVerifyTOTP();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VerifyFormData>({
    resolver: zodResolver(verifySchema),
  });

  // const handleSetup = () => {
  //   setupTOTP(undefined, {
  //     onSuccess: (data ) => {
  //       setSetupData(data);
  //     },
  //   });
  // };

  const handleSetup = () => {
    setupTOTP(undefined, {
      // ✅ FIX 3: Safe cast the response
      onSuccess: (data: unknown) => {
        setSetupData(data as TOTPSetupData);
      },
    });
  };

  const onSubmit = (data: VerifyFormData) => {
    verifyTOTP(
      { token: data.token },
      {
        onSuccess: () => {
          onSuccess?.();
        },
      },
    );
  };

  const copyToClipboard = async (text: string, type: "secret" | "code", index?: number) => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "secret") {
        setCopiedSecret(true);
        setTimeout(() => setCopiedSecret(false), 2000);
      } else if (typeof index === "number") {
        setCopiedCode(index);
        setTimeout(() => setCopiedCode(null), 2000);
      }
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (!setupData) {
    return (
      <Card>
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center">
            <div className="rounded-full bg-primary-100 p-4">
              <Smartphone className="h-8 w-8 text-primary-600" />
            </div>
          </div>

          <h3 className="text-lg font-semibold text-gray-900">Setup Authenticator App</h3>

          <p className="text-sm text-gray-600">Use Google Authenticator, Microsoft Authenticator, or any compatible TOTP app to generate verification codes.</p>

          <div className="flex gap-3">
            <Button onClick={handleSetup} isLoading={isSetupPending} disabled={isSetupPending} className="flex-1">
              Begin Setup
            </Button>
            {onCancel && (
              <Button variant="secondary" onClick={onCancel} className="flex-1">
                Cancel
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Scan QR Code */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Step 1: Scan QR Code</h3>

        <div className="flex justify-center mb-4">
          <img src={setupData.qrCodeUrl} alt="QR Code" className="w-48 h-48 border-2 border-gray-200 rounded-lg" />
        </div>

        <Alert variant="info">Scan this QR code with your authenticator app</Alert>
      </Card>

      {/* Step 2: Manual Entry (Alternative) */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Alternative: Manual Entry</h3>

        <p className="text-sm text-gray-600 mb-3">If you can't scan the QR code, enter this secret key manually:</p>

        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg font-mono text-sm">
          <code className="flex-1 break-all">{setupData.secret}</code>
          <button onClick={() => copyToClipboard(setupData.secret, "secret")} className="text-gray-500 hover:text-gray-700 flex-shrink-0">
            {copiedSecret ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
          </button>
        </div>
      </Card>

      {/* Step 3: Verify Code */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Step 2: Verify Setup</h3>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input {...register("token")} type="text" label="Enter Code from App" placeholder="000000" error={errors.token?.message} maxLength={6} autoComplete="off" disabled={isVerifyPending} required />

          <Button type="submit" className="w-full" isLoading={isVerifyPending} disabled={isVerifyPending}>
            Verify & Enable
          </Button>
        </form>
      </Card>

      {/* Backup Codes */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Emergency Backup Codes</h3>

        <Alert variant="warning" title="Save These Codes" className="mb-4">
          Store these backup codes in a safe place. Each code can only be used once.
        </Alert>

        <div className="grid grid-cols-2 gap-2">
          {setupData.backupCodes.map((code, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded font-mono text-sm">
              <span>{code}</span>
              <button type="button" onClick={() => copyToClipboard(code, "code", index)} className="text-gray-500 hover:text-gray-700">
                {copiedCode === index ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
