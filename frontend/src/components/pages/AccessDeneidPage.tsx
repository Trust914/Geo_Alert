import { Shield } from 'lucide-react';

import { Home } from 'lucide-react';
import { Link } from 'react-router-dom';


export function AccessDeniedPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950 p-4">
      <div className="text-center max-w-md space-y-6">
        {/* Lock Icon */}
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-orange-600 dark:from-red-600 dark:to-orange-700 shadow-2xl shadow-red-500/30">
          <Shield className="h-12 w-12 text-white" strokeWidth={2.5} />
        </div>

        {/* Message */}
        <div className="space-y-3">
          <h1 className="text-6xl font-black text-gray-900 dark:text-white">403</h1>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Access Denied
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            You don't have permission to access this page. Please contact your administrator if you believe this is an error.
          </p>
        </div>

        {/* Action */}
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 dark:from-emerald-400 dark:to-green-500 text-white font-semibold hover:shadow-lg hover:shadow-emerald-500/30 transition-all hover:scale-105"
        >
          <Home className="h-5 w-5" />
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}