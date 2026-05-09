import { Navigate } from "react-router-dom";
import { isSuperAdmin } from "../../users/utils";
import AgencyManagementPage from "./AgencyManagementPage";
import AgencyAdminViewPage from "./AgencyAdminViewPage";
import { Loader2 } from "lucide-react";
import type { ISafeUser } from "../../users/types";
import { useBFF } from "../../bff_auth/context";
import { UserRole } from "../../../types";

export default function AgencyRouteHandler() {
  // isLoading is true until the BFF /me response has fully settled,
  // meaning user.agency.type / name / jurisdictionLevel are guaranteed
  // to be present. Never use a fixed timer — it races against the network.
  const { user, isLoading } = useBFF();

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  const superAdmin = isSuperAdmin(user as ISafeUser);
  const isAgencyAdmin = user.role === UserRole.ADMIN && !!user.agencyId && !superAdmin;

  if (superAdmin) {
    return <AgencyManagementPage />;
  }

  if (isAgencyAdmin) {
    // AgencyAdminViewPage reads user.agencyId directly from BFF context,
    // so it works correctly at /agencies without a :agencyId URL param.
    return <AgencyAdminViewPage />;
  }

  return <Navigate to="/dashboard" replace />;
}