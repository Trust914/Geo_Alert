import { useNavigate } from "react-router-dom";
import { Shield, Bell, Globe, Lock, ChevronRight, User } from "lucide-react";

export default function SettingsPage() {
  const navigate = useNavigate();

  const settingsOptions = [
    {
      icon: User,
      title: "Profile",
      description: "View your account details and update your name",
      path: "/settings/profile",
      color: "emerald",
    },
    {
      icon: Shield,
      title: "Security",
      description: "Manage two-factor authentication and security preferences",
      path: "/settings/security",
      color: "blue",
      badge: "2FA",
    },
    {
      icon: Bell,
      title: "Notifications",
      description: "Configure alert and email notification settings",
      path: "/settings/notifications",
      color: "purple",
      comingSoon: true,
    },
    {
      icon: Globe,
      title: "Preferences",
      description: "Customize your dashboard and regional settings",
      path: "/settings/preferences",
      color: "orange",
      comingSoon: true,
    },
    {
      icon: Lock,
      title: "Privacy & Data",
      description: "Control your data privacy and account visibility",
      path: "/settings/privacy",
      color: "red",
      comingSoon: true,
    },
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      emerald: {
        bg: "bg-emerald-100 dark:bg-emerald-500/20",
        text: "text-emerald-600 dark:text-emerald-400",
      },
      blue: {
        bg: "bg-blue-100 dark:bg-blue-500/20",
        text: "text-blue-600 dark:text-blue-400",
      },
      purple: {
        bg: "bg-purple-100 dark:bg-purple-500/20",
        text: "text-purple-600 dark:text-purple-400",
      },
      orange: {
        bg: "bg-orange-100 dark:bg-orange-500/20",
        text: "text-orange-600 dark:text-orange-400",
      },
      red: {
        bg: "bg-red-100 dark:bg-red-500/20",
        text: "text-red-600 dark:text-red-400",
      },
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your account settings and preferences</p>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4">
        <div className="flex gap-3">
          <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">Profile Information</h3>
            <p className="text-sm text-blue-700 dark:text-blue-400">Your profile details (name, email, role) can only be updated by your agency administrator. Please contact your admin if you need to change your personal information.</p>
          </div>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 gap-4">
        {settingsOptions.map((option) => {
          const Icon = option.icon;
          const colors = getColorClasses(option.color);

          return (
            <button key={option.path} onClick={() => !option.comingSoon && navigate(option.path)} disabled={option.comingSoon} className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 text-left disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none">
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${colors.text}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{option.title}</h3>
                    {option.badge && <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 rounded">{option.badge}</span>}
                    {option.comingSoon && <span className="px-2 py-0.5 text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">Coming Soon</span>}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{option.description}</p>
                </div>

                {/* Arrow */}
                {!option.comingSoon && (
                  <div className="flex-shrink-0">
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
        <div className="space-y-3">
          <button onClick={() => navigate("/auth/change-password")} className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <div className="text-left">
                <p className="font-semibold text-gray-900 dark:text-white">Change Password</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Update your account password</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
