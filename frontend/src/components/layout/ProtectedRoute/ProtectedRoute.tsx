import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useBFF } from "../../../features/bff_auth/context";

interface ProtectedRouteProps {
  redirectTo?: string;
  requireAuth?: boolean;
}

export function ProtectedRoute({ redirectTo = "/login", requireAuth = true }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useBFF();
  const location = useLocation();

  // Wait for the initial session check to complete before making any
  // auth decisions. Without this, a background token refresh can briefly
  // set isAuthenticated=false and cause an incorrect redirect to /login
  // which then bounces to 404.
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if authentication is required but the user is not authenticated.
  if (requireAuth && !isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Redirect authenticated users away from public-only pages (e.g. /login).
  if (!requireAuth && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // Gate all protected routes behind the mandatory password change flow.
  if (isAuthenticated && user?.mustChangePassword && location.pathname !== "/auth/change-password") {
    return <Navigate to="/auth/change-password" replace />;
  }

  return <Outlet />;
}
