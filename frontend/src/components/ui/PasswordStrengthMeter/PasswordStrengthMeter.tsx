import { Check, X } from 'lucide-react';
import { clsx } from 'clsx';

interface PasswordStrengthMeterProps {
  password: string;
}

interface Requirement {
  label: string;
  regex: RegExp;
  met: boolean;
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const requirements: Requirement[] = [
    { label: 'At least 8 characters', regex: /.{8,}/, met: password.length >= 8 },
    { label: 'One uppercase letter', regex: /[A-Z]/, met: /[A-Z]/.test(password) },
    { label: 'One lowercase letter', regex: /[a-z]/, met: /[a-z]/.test(password) },
    { label: 'One number', regex: /[0-9]/, met: /[0-9]/.test(password) },
    { label: 'One special character', regex: /[^A-Za-z0-9]/, met: /[^A-Za-z0-9]/.test(password) },
  ];

  const metCount = requirements.filter((req) => req.met).length;
  const strength = Math.min(100, (metCount / requirements.length) * 100);

  const getStrengthLabel = () => {
    if (strength === 0) return { text: 'Very Weak', color: 'text-gray-400' };
    if (strength <= 40) return { text: 'Weak', color: 'text-red-600 dark:text-red-400' };
    if (strength <= 60) return { text: 'Fair', color: 'text-yellow-600 dark:text-yellow-400' };
    if (strength <= 80) return { text: 'Good', color: 'text-blue-600 dark:text-blue-400' };
    return { text: 'Strong', color: 'text-emerald-600 dark:text-emerald-400' };
  };

  const getStrengthColor = () => {
    if (strength === 0) return 'bg-gray-200 dark:bg-gray-700';
    if (strength <= 40) return 'bg-gradient-to-r from-red-500 to-orange-500';
    if (strength <= 60) return 'bg-gradient-to-r from-yellow-500 to-orange-500';
    if (strength <= 80) return 'bg-gradient-to-r from-blue-500 to-cyan-500';
    return 'bg-gradient-to-r from-emerald-500 to-green-600';
  };

  if (!password) return null;

  const strengthInfo = getStrengthLabel();

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      {/* Strength Bar */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center text-sm mb-3">
          <span className="font-semibold text-gray-700 dark:text-gray-300">
            Password Strength
          </span>
          <span className={clsx('font-bold transition-colors', strengthInfo.color)}>
            {strengthInfo.text}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="relative h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={clsx(
              'h-full transition-all duration-500 ease-out rounded-full',
              getStrengthColor()
            )}
            style={{ width: `${strength}%` }}
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          </div>
        </div>
      </div>

      {/* Requirements List */}
      <div className="rounded-xl bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 p-4">
        <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
          Password Requirements
        </p>
        <div className="grid grid-cols-1 gap-2">
          {requirements.map((req, index) => (
            <div
              key={index}
              className={clsx(
                'flex items-center gap-2.5 p-2 rounded-lg transition-all duration-300',
                req.met
                  ? 'bg-emerald-50 dark:bg-emerald-500/10'
                  : 'bg-transparent'
              )}
            >
              <div className={clsx(
                'flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300',
                req.met
                  ? 'bg-emerald-500 dark:bg-emerald-400 scale-100'
                  : 'bg-gray-200 dark:bg-gray-700 scale-90'
              )}>
                {req.met ? (
                  <Check className="h-3 w-3 text-white font-bold" strokeWidth={3} />
                ) : (
                  <X className="h-3 w-3 text-gray-400 dark:text-gray-500" strokeWidth={2} />
                )}
              </div>
              <span className={clsx(
                'text-sm font-medium transition-colors',
                req.met
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-gray-600 dark:text-gray-400'
              )}>
                {req.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
}