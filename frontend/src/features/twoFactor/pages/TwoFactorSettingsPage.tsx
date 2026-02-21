import { AuthLayout } from '../../../components/AuthLayout';
import { TwoFactorSettings } from '../components/TwoFactorSettings';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../../../components/ui/Card';

export default function TwoFactorSettingsPage() {
  return (
    <AuthLayout>
      <div className="w-full max-w-3xl mx-auto">
        <Card className="p-6 md:p-8">
          <CardHeader className="mb-6">
            <CardTitle className="text-2xl font-bold text-gray-900">
              Security Settings
            </CardTitle>
            <CardDescription className="text-gray-600">
              Manage your two-factor authentication settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TwoFactorSettings />
          </CardContent>
        </Card>
      </div>
    </AuthLayout>
  );
}