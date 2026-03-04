import { useNavigate } from "react-router-dom";
import { Edit, Users, Bell, Trash2, AlertCircle } from "lucide-react";
import { AgencyStatus } from "../types";

interface AgencyQuickActionsProps {
  agencyId: string;
  agencyName: string;
  agencyStatus: AgencyStatus;
  canEdit: boolean;
  isSuperAdmin: boolean;
  onDelete?: () => void;
}

export function AgencyQuickActions({
  agencyId,
  // agencyName,
  agencyStatus,
  canEdit,
  isSuperAdmin,
  onDelete,
}: AgencyQuickActionsProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
        <div className="space-y-3">
          {canEdit && (
            <ActionButton
              icon={<Edit className="w-5 h-5 text-gray-600 dark:text-gray-400" />}
              label="Edit Agency Details"
              onClick={() => navigate(`/agencies/${agencyId}/edit`)}
            />
          )}

          <ActionButton
            icon={<Users className="w-5 h-5 text-gray-600 dark:text-gray-400" />}
            label="View All Users"
            onClick={() => navigate(`/users?agencyId=${agencyId}`)}
          />

          <ActionButton
            icon={<Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />}
            label="View Agency Alerts"
            onClick={() => navigate(`/alerts?agencyId=${agencyId}`)}
          />
        </div>
      </div>

      {/* Danger Zone - Only for super admin */}
      {isSuperAdmin && agencyStatus !== AgencyStatus.INACTIVE && onDelete && (
        <div className="bg-red-50 dark:bg-red-500/10 border-2 border-red-200 dark:border-red-500/20 rounded-2xl p-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-bold text-red-900 dark:text-red-400 mb-1">Danger Zone</h3>
              <p className="text-sm text-red-700 dark:text-red-400">
                Deleting this agency will deactivate all associated users and prevent new alerts.
              </p>
            </div>
          </div>
          <button
            onClick={onDelete}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-all"
          >
            <Trash2 className="w-5 h-5" />
            Delete Agency
          </button>
        </div>
      )}
    </div>
  );
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

function ActionButton({ icon, label, onClick }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors text-left"
    >
      {icon}
      <span className="font-medium text-gray-900 dark:text-white">{label}</span>
    </button>
  );
}