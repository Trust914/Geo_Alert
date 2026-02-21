/**
 * BFF Change Password Page
 * Password change page with step-up 2FA requirement
 */

import { AuthLayout } from "../../../components/AuthLayout";
import { ChangePasswordForm } from "../components/ChangePasswordForm";

export default function BFFChangePasswordPage() {
  return (
    <AuthLayout>
      <ChangePasswordForm />
    </AuthLayout>
  );
}