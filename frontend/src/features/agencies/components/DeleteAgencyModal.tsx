import { useState } from "react";
import { Loader2, Trash2, AlertCircle } from "lucide-react";

interface DeleteAgencyModalProps {
  isOpen: boolean;
  agencyName: string;
  userCount: number;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: (twoFactorCode: string) => void;
}

export function DeleteAgencyModal({
  isOpen,
  agencyName,
  userCount,
  isDeleting,
  onClose,
  onConfirm,
}: DeleteAgencyModalProps) {
  const [twoFactorCode, setTwoFactorCode] = useState("");

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(twoFactorCode);
  };

  const handleClose = () => {
    setTwoFactorCode("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 max-w-md w-full animate-in zoom-in-95 slide-in-from-bottom-4">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Delete Agency?</h2>
        </div>

        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Are you sure you want to delete <strong>{agencyName}</strong>? This will:
        </p>

        <ul className="space-y-2 mb-6 text-sm text-gray-600 dark:text-gray-400">
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Deactivate all {userCount} users
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Prevent new alerts from being sent
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Mark the agency as inactive
          </li>
        </ul>

        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            2FA Verification Code (if enabled)
          </label>
          <input
            type="text"
            value={twoFactorCode}
            onChange={(e) => setTwoFactorCode(e.target.value)}
            placeholder="Enter your 2FA code"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleClose}
            disabled={isDeleting}
            className="flex-1 px-6 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDeleting}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-all disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-5 h-5" />
                Delete Agency
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}