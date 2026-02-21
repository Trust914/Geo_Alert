import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, Copy, Check } from "lucide-react";
import { useInitiateEmailSetup, useVerifyEmail2FA } from "../../hooks";
import { Card } from "../../../../components/ui/Card/Card";
import { Alert } from "../../../../components/ui/Alert/Alert";
import { Button } from "../../../../components/ui/Button/Button";
import { Input } from "../../../../components/ui/Input/Input";

const verifySchema = z.object({
  code: z.string().length(6, "Code must be 6 digits").regex(/^\d+$/, "Code must be numeric"),
});

type VerifyFormData = z.infer<typeof verifySchema>;

interface EmailSetupProps {
  userEmail: string;
  onSuccess?: (backupCodes: string[]) => void;
  onCancel?: () => void;
}

export function EmailSetup({ userEmail, onSuccess, onCancel }: EmailSetupProps) {
  const [setupInitiated, setSetupInitiated] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedCode, setCopiedCode] = useState<number | null>(null);

  const { mutate: initiateSetup, isPending: isInitiatePending } = useInitiateEmailSetup();
  const { mutate: verifyEmail, isPending: isVerifyPending } = useVerifyEmail2FA();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VerifyFormData>({
    resolver: zodResolver(verifySchema),
  });

  const handleInitiate = () => {
    initiateSetup(undefined, {
      onSuccess: () => {
        setSetupInitiated(true);
      },
    });
  };

  const onSubmit = (data: VerifyFormData) => {
    verifyEmail(
      { code: data.code },
      {
        onSuccess: (response) => {
          setBackupCodes(response.backupCodes);
          onSuccess?.(response.backupCodes);
        },
      },
    );
  };

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(index);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Show backup codes after successful verification
  if (backupCodes.length > 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Email 2FA Enabled Successfully!</h3>

        <Alert variant="warning" title="Save These Backup Codes" className="mb-4">
          Store these backup codes in a safe place. Each code can only be used once if you lose access to your email.
        </Alert>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {backupCodes.map((code, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded font-mono text-sm">
              <span>{code}</span>
              <button type="button" onClick={() => copyToClipboard(code, index)} className="text-gray-500 hover:text-gray-700">
                {copiedCode === index ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          ))}
        </div>

        <Button onClick={() => window.location.reload()} className="w-full">
          Done
        </Button>
      </Card>
    );
  }

  if (!setupInitiated) {
    return (
      <Card>
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center">
            <div className="rounded-full bg-primary-100 p-4">
              <Mail className="h-8 w-8 text-primary-600" />
            </div>
          </div>

          <h3 className="text-lg font-semibold text-gray-900">Setup Email Two-Factor Authentication</h3>

          <p className="text-sm text-gray-600">
            We'll send a 6-digit verification code to <strong>{userEmail}</strong>
          </p>

          <Alert variant="info">You'll need to verify your email each time you log in for added security.</Alert>

          <div className="flex gap-3">
            <Button onClick={handleInitiate} isLoading={isInitiatePending} disabled={isInitiatePending} className="flex-1">
              Send Verification Code
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
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Verify Your Email</h3>

      <Alert variant="info" className="mb-4">
        Enter the 6-digit code sent to <strong>{userEmail}</strong>
      </Alert>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input {...register("code")} type="text" label="Verification Code" placeholder="000000" error={errors.code?.message} maxLength={6} autoComplete="one-time-code" autoFocus disabled={isVerifyPending} required />

        <div className="flex gap-3">
          <Button type="submit" className="flex-1" isLoading={isVerifyPending} disabled={isVerifyPending}>
            Verify & Enable
          </Button>
          <Button type="button" variant="secondary" onClick={handleInitiate} disabled={isInitiatePending || isVerifyPending} className="flex-1">
            Resend Code
          </Button>
        </div>
      </form>
    </Card>
  );
}
