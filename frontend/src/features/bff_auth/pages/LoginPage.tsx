/**
 * BFF Login Page
 * Login page using BFF authentication pattern
 */

import { AuthLayout } from "../../../components/AuthLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../../components/ui/Card/Card";
import { LoginForm } from "../components/LoginForm";

export default function BFFLoginPage() {
  return (
    <AuthLayout>
      <Card className="w-full max-w-md px-8 md:px-16 pt-16 pb-16 flex flex-col gap-12">
        <CardHeader className="text-center space-y-4">
          <CardTitle className="text-2xl md:text-3xl font-bold">
            Welcome Back
          </CardTitle>
          <CardDescription className="text-md text-gray-400">
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>

        <CardContent className="px-0 pb-8">
          <LoginForm />
        </CardContent>
      </Card>
    </AuthLayout>
  );
}