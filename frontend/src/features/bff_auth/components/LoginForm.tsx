/**
 * BFF Login Form
 * Login form component using BFF authentication
 */

import React, { useState, useCallback } from "react";
import { Eye, EyeOff, Mail, Lock, ArrowRight } from "lucide-react";
import { useLogin } from "../hooks";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "../../../components/ui/";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../../../components/ui/";
import { cn } from "../../../lib/utils";
import { Button } from "../../../components/ui/";

interface LoginFormProps {
  className?: string;
}

interface FormErrors {
  email?: { message: string };
  password?: { message: string };
}

export function LoginForm({ className }: LoginFormProps) {
  const loginMutation = useLogin();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  const isLoading = loginMutation.isPending;

  const validateForm = useCallback(() => {
    const newErrors: FormErrors = {};

    if (!email) {
      newErrors.email = { message: "Email is required" };
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = { message: "Please enter a valid email" };
    }

    if (!password) {
      newErrors.password = { message: "Password is required" };
    } else if (password.length < 8) {
      newErrors.password = { message: "Password must be at least 8 characters" };
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [email, password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    loginMutation.mutate({ email, password });
  };

  const clearError = (field: keyof FormErrors) => {
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn("flex flex-col gap-6", className)}>
      <FieldGroup className="gap-5">
        {/* Email Field */}
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="bff-login-email">Email</FieldLabel>
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <Mail className="size-4" />
            </InputGroupAddon>
            <InputGroupInput
              id="bff-login-email"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearError("email");
              }}
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              disabled={isLoading}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
            />
          </InputGroup>
          <FieldError id="email-error" errors={errors.email ? [errors.email] : undefined} />
        </Field>

        {/* Password Field */}
        <Field data-invalid={!!errors.password}>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="bff-login-password">Password</FieldLabel>
            <a
              href="/forgot-password"
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              tabIndex={-1}
            >
              Forgot password?
            </a>
          </div>
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <Lock className="size-4" />
            </InputGroupAddon>
            <InputGroupInput
              id="bff-login-password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearError("password");
              }}
              autoComplete="current-password"
              disabled={isLoading}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "password-error" : undefined}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <FieldError
            id="password-error"
            errors={errors.password ? [errors.password] : undefined}
          />
        </Field>
      </FieldGroup>

      {/* Submit Button */}
      <Button
        type="submit"
        size="lg"
        disabled={isLoading}
        isLoading={isLoading}
        className="w-full"
      >
        {!isLoading && (
          <>
            Sign in
            <ArrowRight className="size-4" />
          </>
        )}
        {isLoading && "Signing in..."}
      </Button>

      {/* Security footer */}
      <p className="text-center text-xs text-muted-foreground pt-2">
        Secured with end-to-end encryption
      </p>
    </form>
  );
}