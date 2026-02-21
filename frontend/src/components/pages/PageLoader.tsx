import { Shield, Loader2 } from 'lucide-react';

export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 dark:from-gray-950 dark:via-gray-900 dark:to-emerald-950">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#10b98120_1px,transparent_1px),linear-gradient(to_bottom,#10b98120_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-30" />

      <div className="relative z-10 text-center space-y-8">
        {/* Animated Logo */}
        <div className="relative inline-flex items-center justify-center">
          {/* Pulsing Rings */}
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 dark:bg-emerald-400/20 animate-ping" />
          <div className="absolute inset-0 rounded-full bg-emerald-500/10 dark:bg-emerald-400/10 animate-pulse" />

          {/* Logo Container */}
          <div className="relative bg-gradient-to-br from-emerald-500 to-green-600 dark:from-emerald-400 dark:to-green-500 p-8 rounded-3xl shadow-2xl shadow-emerald-500/30 dark:shadow-emerald-400/30">
            <Shield className="h-16 w-16 text-white animate-pulse" strokeWidth={2.5} />
          </div>
        </div>

        {/* Loading Text */}
        <div className="space-y-3">
          <h2 className="text-3xl font-black bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 dark:from-emerald-400 dark:via-green-400 dark:to-teal-400 bg-clip-text text-transparent">
            GEOALERT
          </h2>
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 animate-spin" />
            <p className="text-gray-600 dark:text-gray-400 font-medium">
              Loading your dashboard...
            </p>
          </div>
        </div>

        {/* Progress Dots */}
        <div className="flex items-center justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
