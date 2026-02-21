/**
 * BFF Two-Factor Verification Page
 * 2FA verification page for BFF authentication
 */

import { ShieldCheck } from "lucide-react";
import { AuthLayout } from "../../../components/AuthLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/Card";
import { TwoFactorVerification } from "../components/TwoFactorVerification";

export default function BFFTwoFactorPage() {
  return (
    <AuthLayout>
      <Card className="w-full relative bg-card/95 backdrop-blur-sm border-border/50">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl sm:text-2xl font-bold text-foreground">
              Two-Factor Authentication
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Enter the 6-digit code to continue
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <TwoFactorVerification/>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}