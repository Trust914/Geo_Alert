import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { TwoFactorSettings } from "../components/TwoFactorSettings";

export default function SecuritySettingsPage() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* Back Navigation */}
      <Link
        to="/settings"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Settings
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-gray-900 dark:text-white">
          Security Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage your two-factor authentication and account security
        </p>
      </div>

      {/* Two-Factor Settings Component */}
      <TwoFactorSettings />
    </div>
  );
}