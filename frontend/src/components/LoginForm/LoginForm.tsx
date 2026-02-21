"use client"

import React from "react"
import { useState, useCallback } from "react"
import { Eye, EyeOff, Mail, Lock, ArrowRight } from "lucide-react"
import { useLogin } from "../../features/auth/hooks"
import { Field, FieldError, FieldGroup, FieldLabel } from "../ui/"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "../ui/"
import { cn } from "../../lib/utils"
import { Button } from "../ui/"

interface LoginFormProps {
  className?: string
}

interface FormErrors {
  email?: { message: string }
  password?: { message: string }
}

export function LoginForm({ className }: LoginFormProps) {
  const loginMutation = useLogin()
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  // const [remember, setRemember] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

  const isLoading = loginMutation.isPending

  const validateForm = useCallback(() => {
    const newErrors: FormErrors = {}

    if (!email) {
      newErrors.email = { message: "Email is required" }
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = { message: "Please enter a valid email" }
    }

    if (!password) {
      newErrors.password = { message: "Password is required" }
    } else if (password.length < 8) {
      newErrors.password = { message: "Password must be at least 8 characters" }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [email, password])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    loginMutation.mutate({ email, password })
  }

  const clearError = (field: keyof FormErrors) => {
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cn("flex flex-col gap-6", className)}>
      <FieldGroup className="gap-5">
        {/* Email Field */}
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="login-email">Email</FieldLabel>
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <Mail className="size-4" />
            </InputGroupAddon>
            <InputGroupInput
              id="login-email"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                clearError("email")
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
            <FieldLabel htmlFor="login-password">Password</FieldLabel>
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
              id="login-password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                clearError("password")
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
          <FieldError id="password-error" errors={errors.password ? [errors.password] : undefined} />
        </Field>

        {/* Remember Me */}
        {/* <div className="flex items-center gap-2">
          <Checkbox
            id="remember"
            checked={remember}
            onCheckedChange={(checked) => setRemember(checked === true)}
            disabled={isLoading}
          />
          <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground cursor-pointer">
            Remember me for 30 days
          </Label>
        </div> */}
      </FieldGroup>

      {/* Submit Button */}
      <Button type="submit" size="lg" disabled={isLoading} isLoading={isLoading} className="w-full">
        {!isLoading && (
          <>
            Sign in
            <ArrowRight className="size-4" />
          </>
        )}
        {isLoading && "Signing in..."}
      </Button>

      {/* Divider */}
      {/* <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div> */}

      {/* Social Buttons */}
      {/* <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" type="button" disabled={isLoading} className="h-11 bg-transparent">
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          <span className="sr-only">Sign in with </span>Google
        </Button>
        <Button variant="outline" type="button" disabled={isLoading} className="h-11 bg-transparent">
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
            <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" fill="currentColor" />
          </svg>
          <span className="sr-only">Sign in with </span>GitHub
        </Button>
      </div> */}

      {/* Sign up link */}
      {/* <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <a href="/signup" className="font-medium text-primary hover:text-primary/80 transition-colors">
          Sign up
        </a>
      </p> */}

      {/* Security footer */}
      <p className="text-center text-xs text-muted-foreground pt-2">
        Secured with end-to-end encryption
      </p>
    </form>
  )
}
