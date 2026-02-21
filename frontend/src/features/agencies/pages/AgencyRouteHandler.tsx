import { Navigate } from "react-router-dom";
import { isSuperAdmin } from "../../users/utils";
import AgencyManagementPage from "./AgencyManagementPage";
import AgencyDetailsPage from "./AgencyDetailsPage";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import type { ISafeUser } from "../../users/types";
import { useBFF } from "../../bff_auth/context";
import { UserRole } from "../../../types";

export default function AgencyRouteHandler() {
  const { user } = useBFF();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsChecking(false), 100);
    return () => clearTimeout(timer);
  }, []);

  if (isChecking || !user) {
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
    // Render inline instead of redirecting — keeps the URL at /agencies
    // and avoids the RoleGuard re-evaluating the /:agencyId route
    return <AgencyDetailsPage />;
  }

  return <Navigate to="/dashboard" replace />;
}