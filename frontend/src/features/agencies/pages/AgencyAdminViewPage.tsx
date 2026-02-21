import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAgencyById } from "../hooks";
// import { useAuth } from "../../auth/context";
import {
  AgencyStatusBadge,
  AgencyStatsCards,
  AgencyInfoSection,
} from "../components/";
import { useBFF } from "../../bff_auth/context";

/**
 * Simplified agency view for agency admins who only need to see their own agency
 * This is a read-only view without edit/delete capabilities
 */
export default function AgencyAdminViewPage() {
  const navigate = useNavigate();
  const { user } = useBFF();
  const { data, isLoading } = useAgencyById(user?.agencyId || null);

  const agency = data?.data;

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
          <p className="text-red-600 dark:text-red-400 text-lg">Agency not found</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="mt-4 px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-all"
          >
            Back to Dashboard
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
          onClick={() => navigate("/dashboard")}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-black text-gray-900 dark:text-white">{agency.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <AgencyStatusBadge status={agency.status} />
            <span className="text-gray-500 dark:text-gray-400">•</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">Your Agency</span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <AgencyStatsCards agency={agency} />

      {/* Agency Information */}
      <AgencyInfoSection agency={agency} />
    </div>
  );
}