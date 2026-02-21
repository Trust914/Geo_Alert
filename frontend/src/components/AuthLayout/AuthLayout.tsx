import React from 'react';
import { Shield, Zap } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-green-50 dark:from-gray-950 dark:via-gray-900 dark:to-emerald-950 flex items-center justify-center p-4">
      {/* --- Animated Background Pattern --- */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#10b98120_1px,transparent_1px),linear-gradient(to_bottom,#10b98120_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />

        {/* Gradient Orbs */}
        <div className="absolute top-0 -left-4 w-72 h-72 sm:w-96 sm:h-96 bg-emerald-300 dark:bg-emerald-500/30 rounded-full mix-blend-multiply dark:mix-blend-normal filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute top-0 -right-4 w-72 h-72 sm:w-96 sm:h-96 bg-green-300 dark:bg-green-500/30 rounded-full mix-blend-multiply dark:mix-blend-normal filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-20 w-72 h-72 sm:w-96 sm:h-96 bg-emerald-300 dark:bg-emerald-500/30 rounded-full mix-blend-multiply dark:mix-blend-normal filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
      </div>

      {/* --- Main Content Container --- */}
      <div className="relative z-10 w-full max-w-md mx-auto flex flex-col items-center">
        {/* Logo Section */}
        <div className="mb-8 text-center w-full">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 shadow-lg shadow-emerald-500/30 mb-4 transform hover:scale-105 transition-transform duration-300 relative">
            <Shield className="w-8 h-8 sm:w-10 sm:h-10 text-white" strokeWidth={2.5} />
            <div className="absolute -top-1 -right-1 bg-white dark:bg-gray-900 rounded-full p-1 shadow-md">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 fill-current" />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 via-emerald-800 to-gray-900 dark:from-white dark:via-emerald-400 dark:to-white tracking-tight">
            GEOALERT
          </h1>
          {title && (
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-gray-200 mt-2">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {subtitle}
            </p>
          )}
        </div>

        {/* Children (The Card) with glow effect */}
        <div className="relative w-full">
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl blur opacity-20 dark:opacity-40" />
          {children}
        </div>
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
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}