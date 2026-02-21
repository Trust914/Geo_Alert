import { useMemo } from "react";
import { Check, X } from "lucide-react";
import clsx from "clsx";

interface PasswordStrengthIndicatorProps {
  password: string;
}

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const requirements: PasswordRequirement[] = [
  {
    label: "At least 8 characters",
    test: (pwd) => pwd.length >= 8,
  },
  {
    label: "Contains uppercase letter",
    test: (pwd) => /[A-Z]/.test(pwd),
  },
  {
    label: "Contains lowercase letter",
    test: (pwd) => /[a-z]/.test(pwd),
  },
  {
    label: "Contains number",
    test: (pwd) => /\d/.test(pwd),
  },
  {
    label: "Contains special character (!@#$%^&*)",
    test: (pwd) => /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
  },
];

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const { strength, metRequirements } = useMemo(() => {
    const met = requirements.filter((req) => req.test(password)).length;

    let strengthLevel: "weak" | "fair" | "good" | "strong" = "weak";
    if (met >= 5) strengthLevel = "strong";
    else if (met >= 4) strengthLevel = "good";
    else if (met >= 3) strengthLevel = "fair";

    return {
      strength: strengthLevel,
      metRequirements: met,
    };
  }, [password]);

  const strengthColors = {
    weak: "bg-red-500",
    fair: "bg-yellow-500",
    good: "bg-blue-500",
    strong: "bg-emerald-500",
  };

  const strengthLabels = {
    weak: "Weak",
    fair: "Fair",
    good: "Good",
    strong: "Strong",
  };

  if (!password) return null;

  return (
    <div className="space-y-3">
      {/* Strength Bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Password Strength
          </span>
          <span
            className={clsx(
              "text-xs font-semibold",
              strength === "strong" && "text-emerald-600 dark:text-emerald-400",
              strength === "good" && "text-blue-600 dark:text-blue-400",
              strength === "fair" && "text-yellow-600 dark:text-yellow-400",
              strength === "weak" && "text-red-600 dark:text-red-400"
            )}
          >
            {strengthLabels[strength]}
          </span>
        </div>

        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={clsx(
              "h-full transition-all duration-300 rounded-full",
              strengthColors[strength]
            )}
            style={{ width: `${(metRequirements / requirements.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Requirements Checklist */}
      <div className="space-y-1.5">
        {requirements.map((req, index) => {
          const isMet = req.test(password);
          return (
            <div key={index} className="flex items-center gap-2">
              {isMet ? (
                <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              ) : (
                <X className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
              )}
              <span
                className={clsx(
                  "text-xs",
                  isMet
                    ? "text-emerald-600 dark:text-emerald-400 font-medium"
                    : "text-gray-500 dark:text-gray-400"
                )}
              >
                {req.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Backend requirement note */}
      <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
        💡 Must meet at least 3 of the above requirements
      </p>
    </div>
  );
}