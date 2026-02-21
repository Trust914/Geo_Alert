/**
 * Step-Up 2FA Modal
 * Modal component for step-up 2FA verification on sensitive operations
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { Shield, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../../../components/ui/";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../../components/ui/Dialog/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../../../components/ui/";

const stepUpSchema = z.object({
  code: z
    .string()
    .length(6, "Code must be exactly 6 digits")
    .regex(/^[0-9]+$/, "Code must contain only numbers"),
});

type StepUpFormData = z.infer<typeof stepUpSchema>;

interface StepUp2FAModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (code: string) => void;
  isLoading?: boolean;
  title?: string;
  description?: string;
}

export function StepUp2FAModal({ isOpen, onClose, onConfirm, isLoading = false, title = "Two-Factor Authentication Required", description = "Please enter your verification code to continue." }: StepUp2FAModalProps) {
  const [code, setCode] = useState("");

  const {
    handleSubmit,
    setValue,
    clearErrors,
    reset,
    formState: { errors },
  } = useForm<StepUpFormData>({
    resolver: zodResolver(stepUpSchema),
  });

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCode("");
      reset();
    }
  }, [isOpen, reset]);

  // Update form value when code changes
  useEffect(() => {
    setValue("code", code);
    if (code.length === 6) {
      clearErrors("code");
    }
  }, [code, setValue, clearErrors]);

  const onSubmit = (data: StepUpFormData) => {
    onConfirm(data.code);
  };

  const handleChange = (value: string) => {
    setCode(value);
    // Auto-submit when 6 digits are entered
    if (value.length === 6) {
      handleSubmit(onSubmit)();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription className="mt-1">{description}</DialogDescription>
              </div>
            </div>
            <button onClick={onClose} className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none" disabled={isLoading}>
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-4">
          {/* OTP Input */}
          <div className="flex flex-col items-center space-y-4">
            <div className="space-y-3">
              <InputOTP maxLength={6} value={code} onChange={handleChange} disabled={isLoading} autoFocus>
                <InputOTPGroup className="gap-2">
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

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={code.length !== 6 || isLoading} isLoading={isLoading}>
              Verify
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
