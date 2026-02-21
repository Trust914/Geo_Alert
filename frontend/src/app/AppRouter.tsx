import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { lazy, Suspense, type JSX, type LazyExoticComponent } from "react";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { ProtectedRoute } from "../components/layout/ProtectedRoute";
import { RoleGuard } from "../components/layout/RoleGuard";
import { UserRole } from "../types/enums.types";
import { PageLoader, NotFoundPage, AccessDeniedPage } from "../components/pages";

// BFF Auth Pages (Lazy Loaded) - NEW!
const BFFLoginPage = lazy(() => import("../features/bff_auth/pages/LoginPage"));
const BFFTwoFactorPage = lazy(() => import("../features/bff_auth/pages/TwoFactorPage"));
const BFFChangePasswordPage = lazy(() => import("../features/bff_auth/pages/ChangePasswordPage"));
const BFFResetPasswordPage = lazy(() => import("../features/bff_auth/pages/ResetPasswordPage"));

// Other Auth Pages
const ActivateAccountPage = lazy(() => import("../features/activation/pages/ActivateAccountPage"));

// Dashboard Pages (Lazy Loaded)
const DashboardPage = lazy(() => import("../features/dashboard/pages/DashboardPage"));
const SettingsPage = lazy(() => import("../features/settings/pages/SettingsPage"));
const SecuritySettingsPage = lazy(() => import("../features/twoFactor/pages/SecuritySettingsPage"));

// Alert Pages (Lazy Loaded)
const AlertListPage = lazy(() => import("../features/alerts/pages/AlertListPage"));
const AlertDetailPage = lazy(() => import("../features/alerts/pages/AlertDetailPage"));
const CreateAlertPage = lazy(() => import("../features/alerts/pages/CreateAlertPage"));

// User Pages (Lazy Loaded)
const UserManagementPage = lazy(() => import("../features/users/pages/UserManagementPage"));
const CreateUserPage = lazy(() => import("../features/users/pages/CreateUserPage"));
const UserDetailsPage = lazy(() => import("../features/users/pages/UserDetailsPage"));
const UpdateUserPage = lazy(() => import("../features/users/pages/UpdateUserPage"));

// Agency Pages (Lazy Loaded)
const AgencyRouteHandler = lazy(() => import("../features/agencies/pages/AgencyRouteHandler"));
const CreateAgencyPage = lazy(() => import("../features/agencies/pages/CreateAgencyPage"));
const AgencyDetailsPage = lazy(() => import("../features/agencies/pages/AgencyDetailsPage"));
const UpdateAgencyPage = lazy(() => import("../features/agencies/pages/UpdateAgencyPage"));

// Profile Page (Lazy Loaded)
const ProfilePage = lazy(() => import("../features/profile/pages/ProfilePage"));

// Wrapper for lazy components
const withSuspense = (Component: LazyExoticComponent<() => JSX.Element>) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
);

const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/dashboard" replace />,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // FULLY PUBLIC ROUTES (accessible regardless of auth state)
  // ═══════════════════════════════════════════════════════════════════════
  {
    path: "/activate-account",
    element: withSuspense(ActivateAccountPage),
  },

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC ROUTES (Guest only) - Using BFF Auth
  // ═══════════════════════════════════════════════════════════════════════
  {
    element: <ProtectedRoute requireAuth={false} redirectTo="/dashboard" />,
    children: [
      {
        path: "/login",
        element: withSuspense(BFFLoginPage), // BFF Login
      },
      {
        path: "/bff/verify-2fa",
        element: withSuspense(BFFTwoFactorPage), // BFF 2FA
      },
      {
        path: "/reset-password",
        element: withSuspense(BFFResetPasswordPage), // BFF Password Reset
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // PROTECTED ROUTES (Authenticated users) - Using BFF Auth
  // ═══════════════════════════════════════════════════════════════════════
  {
    element: <ProtectedRoute requireAuth={true} redirectTo="/login" />,
    children: [
      {
        path: "/auth/change-password",
        element: withSuspense(BFFChangePasswordPage), // BFF Change Password
      },
      {
        element: <DashboardLayout />,
        children: [
          {
            path: "/dashboard",
            element: withSuspense(DashboardPage),
          },
          {
            path: "/settings",
            element: withSuspense(SettingsPage),
          },
          {
            path: "/settings/security",
            element: withSuspense(SecuritySettingsPage),
          },
          {
            path: "/settings/profile",
            element: withSuspense(ProfilePage),
          },

          // ===== ALERT ROUTES =====
          {
            path: "/alerts",
            element: withSuspense(AlertListPage),
          },
          {
            path: "/alerts/create",
            element: withSuspense(CreateAlertPage),
          },
          {
            path: "/alerts/:id",
            element: withSuspense(AlertDetailPage),
          },

          // ===== CITIZEN ROUTES =====
          {
            path: "/citizens",
            element: (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <h1 className="text-3xl font-black text-gray-900 dark:text-white">Citizen Directory</h1>
                <div className="rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-12 text-center bg-gray-50/50 dark:bg-gray-900/50">
                  <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">Citizen management coming soon...</p>
                </div>
              </div>
            ),
          },

          // ===== AGENCY ROUTES =====
          {
            path: "/agencies",
            element: (
              <RoleGuard allowedRoles={[UserRole.ADMIN]} fallback={<AccessDeniedPage />}>
                {withSuspense(AgencyRouteHandler)}
              </RoleGuard>
            ),
          },
          {
            path: "/agencies/create",
            element: (
              <RoleGuard requireSuperAdmin={true} fallback={<AccessDeniedPage />}>
                {withSuspense(CreateAgencyPage)}
              </RoleGuard>
            ),
          },
          {
            path: "/agencies/:agencyId",
            element: (
              <RoleGuard allowedRoles={[UserRole.ADMIN]} fallback={<AccessDeniedPage />}>
                {withSuspense(AgencyDetailsPage)}
              </RoleGuard>
            ),
          },
          {
            path: "/agencies/:agencyId/edit",
            element: (
              <RoleGuard requireSuperAdmin={true} fallback={<AccessDeniedPage />}>
                {withSuspense(UpdateAgencyPage)}
              </RoleGuard>
            ),
          },

          // ===== USER ROUTES (Admin Only) =====
          {
            path: "/users",
            element: (
              <RoleGuard allowedRoles={[UserRole.ADMIN]} fallback={<AccessDeniedPage />}>
                {withSuspense(UserManagementPage)}
              </RoleGuard>
            ),
          },
          {
            path: "/users/create",
            element: (
              <RoleGuard allowedRoles={[UserRole.ADMIN]} fallback={<AccessDeniedPage />}>
                {withSuspense(CreateUserPage)}
              </RoleGuard>
            ),
          },
          {
            path: "/users/:userId",
            element: (
              <RoleGuard allowedRoles={[UserRole.ADMIN]} fallback={<AccessDeniedPage />}>
                {withSuspense(UserDetailsPage)}
              </RoleGuard>
            ),
          },
          {
            path: "/users/:userId/edit",
            element: (
              <RoleGuard allowedRoles={[UserRole.ADMIN]} fallback={<AccessDeniedPage />}>
                {withSuspense(UpdateUserPage)}
              </RoleGuard>
            ),
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 404 NOT FOUND
  // ═══════════════════════════════════════════════════════════════════════
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}