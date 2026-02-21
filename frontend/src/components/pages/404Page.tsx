import { Home, ArrowLeft, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 dark:from-gray-950 dark:via-gray-900 dark:to-emerald-950 flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#10b98120_1px,transparent_1px),linear-gradient(to_bottom,#10b98120_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-30" />

      {/* Gradient Orbs */}
      <div className="absolute top-0 -left-4 w-96 h-96 bg-emerald-300 dark:bg-emerald-500/30 rounded-full mix-blend-multiply dark:mix-blend-normal filter blur-3xl opacity-20 animate-blob" />
      <div className="absolute bottom-0 -right-4 w-96 h-96 bg-green-300 dark:bg-green-500/30 rounded-full mix-blend-multiply dark:mix-blend-normal filter blur-3xl opacity-20 animate-blob animation-delay-2000" />

      <div className="relative z-10 text-center max-w-2xl mx-auto space-y-8">
        {/* 404 Number */}
        <div className="relative">
          <h1 className="text-[12rem] md:text-[16rem] font-black leading-none bg-gradient-to-br from-emerald-600 via-green-600 to-teal-600 dark:from-emerald-400 dark:via-green-400 dark:to-teal-400 bg-clip-text text-transparent opacity-20 select-none">
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-gradient-to-br from-emerald-500 to-green-600 dark:from-emerald-400 dark:to-green-500 p-8 rounded-3xl shadow-2xl">
              <Search className="h-20 w-20 text-white" strokeWidth={2} />
            </div>
          </div>
        </div>

        {/* Message */}
        <div className="space-y-4">
          <h2 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white">
            Page Not Found
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            Oops! The page you're looking for seems to have gone missing.
            Let's get you back on track.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 dark:from-emerald-400 dark:to-green-500 text-white font-semibold hover:shadow-lg hover:shadow-emerald-500/30 dark:hover:shadow-emerald-400/30 transition-all hover:scale-105"
          >
            <Home className="h-5 w-5" />
            Go to Dashboard
          </Link>

          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white border-2 border-gray-200 dark:border-gray-700 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all hover:scale-105"
          >
            <ArrowLeft className="h-5 w-5" />
            Go Back
          </button>
        </div>

        {/* Help Text */}
        <p className="text-sm text-gray-500 dark:text-gray-500">
          Need help? Contact support or check the{' '}
          <a href="#" className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium">
            documentation
          </a>
        </p>
      </div>

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
      `}</style>
    </div>
  );
}
