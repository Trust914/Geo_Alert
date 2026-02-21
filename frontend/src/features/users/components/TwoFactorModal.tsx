import { X, Shield, Loader2 } from "lucide-react";
import { useState } from "react";
import clsx from "clsx";

interface TwoFactorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerify: (code: string) => void;
  isPending: boolean;
  title: string;
  description: string;
}

export function TwoFactorModal({ isOpen, onClose, onVerify, isPending, title, description }: TwoFactorModalProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!code || code.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    setError("");
    onVerify(code);
  };

  const handleClose = () => {
    setCode("");
    setError("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full animate-in slide-in-from-bottom-4 duration-300" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" disabled={isPending}>
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Code Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Verification Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(value);
                setError("");
              }}
              placeholder="000000"
              maxLength={6}
              disabled={isPending}
              className={clsx("w-full px-4 py-3 rounded-xl border text-center text-2xl font-bold tracking-widest transition-all", error ? "border-red-300 dark:border-red-500/50 bg-red-50 dark:bg-red-900/10" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800", "text-gray-900 dark:text-white placeholder:text-gray-400", "focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500", "disabled:opacity-50 disabled:cursor-not-allowed")}
            />
            {error && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>}
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4">
            <p className="text-sm text-blue-700 dark:text-blue-400">Enter the 6-digit code from your authenticator app or email to continue.</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button type="button" onClick={handleClose} disabled={isPending} className="flex-1 px-6 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              Cancel
            </button>
            <button type="submit" disabled={isPending || code.length !== 6} className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  Verify
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
