import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Edit, RotateCcw, Loader2, AlertCircle } from "lucide-react";
import { useAgencyById, useDeleteAgency, useReactivateAgency } from "../hooks";
import { AgencyStatus } from "../types";
import { AccessDeniedPage } from "../../../components/pages";
import { isSuperAdmin, canViewAgency, canEditAgency } from "../../users/utils";
// import { useAuth } from "../../auth/context";
import type { ISafeUser } from "../../users/types";
import {
  AgencyStatusBadge,
  AgencyStatsCards,
  AgencyInfoSection,
  AgencyQuickActions,
  DeleteAgencyModal,
} from "../components";
import { useBFF } from "../../bff_auth/context";

export default function AgencyDetailsPage() {
  const { agencyId } = useParams<{ agencyId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useBFF();

  const { data, isLoading } = useAgencyById(agencyId || null);
  const deleteMutation = useDeleteAgency();
  const reactivateMutation = useReactivateAgency();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const agency = data?.data;

  // Permission checks
  const hasViewPermission = currentUser && agencyId ? canViewAgency(currentUser as ISafeUser, agencyId) : false;
  const canEdit = currentUser && agencyId ? canEditAgency(currentUser as ISafeUser) : false;
  const isSuperAdminUser = currentUser ? isSuperAdmin(currentUser as ISafeUser) : false;

  const handleDelete = (twoFactorCode: string) => {
    if (!agencyId || !isSuperAdminUser) return;
    deleteMutation.mutate(
      { agencyId, twoFactorCode },
      {
        onSuccess: () => {
          setShowDeleteConfirm(false);
          navigate("/agencies");
        },
      }
    );
  };

  const handleReactivate = () => {
    if (!agencyId || !isSuperAdminUser) return;
    reactivateMutation.mutate(agencyId);
  };

  // Permission check
  if (!hasViewPermission) {
    return <AccessDeniedPage />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading agency details...</p>
        </div>
      </div>
    );
  }

  if (!agency) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Agency Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            The agency you're looking for doesn't exist or has been removed.
          </p>
          <button
            onClick={() => navigate("/agencies")}
            className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-all"
          >
            Back to Agencies
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/agencies")}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-black text-gray-900 dark:text-white">{agency.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <AgencyStatusBadge status={agency.status} />
            <span className="text-gray-500 dark:text-gray-400">•</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">{agency.type} Agency</span>
            {!isSuperAdminUser && (
              <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2 py-1 rounded">
                View Only
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {isSuperAdminUser && (
          <div className="flex gap-2">
            {agency.status === AgencyStatus.INACTIVE ? (
              <button
                onClick={handleReactivate}
                disabled={reactivateMutation.isPending}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
              >
                <RotateCcw className="w-5 h-5" />
                Reactivate
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate(`/agencies/${agencyId}/edit`)}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all"
                >
                  <Edit className="w-5 h-5" />
                  Edit Agency
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <AgencyStatsCards agency={agency} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agency Information */}
        <div className="lg:col-span-2">
          <AgencyInfoSection agency={agency} />
        </div>

        {/* Sidebar - Quick Actions */}
        <div>
          <AgencyQuickActions
            agencyId={agencyId!}
            agencyName={agency.name}
            agencyStatus={agency.status}
            canEdit={canEdit}
            isSuperAdmin={isSuperAdminUser}
            onDelete={() => setShowDeleteConfirm(true)}
          />
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteAgencyModal
        isOpen={showDeleteConfirm}
        agencyName={agency.name}
        userCount={agency._count.users}
        isDeleting={deleteMutation.isPending}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}