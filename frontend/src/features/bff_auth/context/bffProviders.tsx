/**
 * BFF Provider
 * Manages BFF authentication state based on HttpOnly cookies.
 *
 * FIXES:
 * 1. refreshSession no longer calls setUser unless a field actually changed,
 *    preventing spurious re-renders that caused isAuthenticated to flicker.
 * 2. Interval effect now depends only on whether the user is logged in (boolean),
 *    not on user?.id — avoids teardown/recreate on every session refresh.
 * 3. isLoading stays true until the very first init resolves, preventing
 *    ProtectedRoute from rendering a redirect during startup.
 * 4. Removed setUser from refreshSession entirely — session status is stored
 *    separately; the user object only changes on explicit login/logout/updateUser.
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import type { BFFContextType, BFFUser, SessionStatus } from "../types";
import { bffService } from "../services";
import { BFFContext } from "./bff.context";

interface BFFProviderProps {
  children: React.ReactNode;
}

export function BFFProvider({ children }: BFFProviderProps) {
  const [user, setUser] = useState<BFFUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);

  // Track whether we have an authenticated user as a ref so the interval
  // effect doesn't need to depend on the user object itself.
  const isAuthenticatedRef = useRef(false);
  const sessionStatusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isInitializedRef = useRef(false);
  const initializingRef = useRef(false);

  // Keep user in a ref so refreshSession can read it without being a dependency.
  const userRef = useRef<BFFUser | null>(null);

  // ─── helpers ────────────────────────────────────────────────────────────────

  const clearSessionInterval = () => {
    if (sessionStatusIntervalRef.current) {
      clearInterval(sessionStatusIntervalRef.current);
      sessionStatusIntervalRef.current = null;
    }
  };

  // ─── public API ─────────────────────────────────────────────────────────────

  /** Called after a successful login / 2FA verify. */
  const setAuth = useCallback((userData: BFFUser) => {
    console.log("🔐 BFF: Setting auth -", userData.email);
    userRef.current = userData;
    isAuthenticatedRef.current = true;
    setUser(userData);
    isInitializedRef.current = true;
  }, []);

  /** Update user fields (e.g. after a profile edit). */
  const updateUser = useCallback((userData: BFFUser) => {
    console.log("🔄 BFF: Updating user data");
    userRef.current = userData;
    setUser(userData);
  }, []);

  /** Logout: revoke session and wipe local state. */
  const logout = useCallback(async () => {
    console.log("🚪 BFF: Logging out...");
    clearSessionInterval();
    try {
      await bffService.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      userRef.current = null;
      isAuthenticatedRef.current = false;
      isInitializedRef.current = false;
      initializingRef.current = false;
      setUser(null);
      setSessionStatus(null);
    }
  }, []);

  /**
   * Background session refresh — polls /bff/session/status.
   *
   * KEY FIX: We intentionally do NOT call setUser here.
   * The session status endpoint is for liveness / token refresh only.
   * User data changes (role change, deactivation, etc.) are rare and are
   * handled by the backend returning 401/403, which the interceptor catches.
   * Calling setUser on every poll was the source of the isAuthenticated flicker.
   */
  const refreshSession = useCallback(async () => {
    try {
      const status = await bffService.getSessionStatus();
      setSessionStatus(status);
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        // Session has genuinely expired — interceptor will handle redirect.
        console.log("ℹ️ BFF: Session expired during background refresh");
      } else if (status !== 429) {
        console.error("BFF: Failed to refresh session status:", error);
      }
    }
  }, []); // Stable — no state dependencies.

  // ─── global logout event (fired by axios interceptor on 401) ────────────────

  useEffect(() => {
    const handleLogout = () => {
      console.log("📢 BFF: Received auth:logout event");
      clearSessionInterval();
      userRef.current = null;
      isAuthenticatedRef.current = false;
      isInitializedRef.current = false;
      initializingRef.current = false;
      setUser(null);
      setSessionStatus(null);
    };

    window.addEventListener("auth:logout", handleLogout);
    return () => window.removeEventListener("auth:logout", handleLogout);
  }, []);

  // ─── one-time initialisation ─────────────────────────────────────────────────

  useEffect(() => {
    const initializeBFF = async () => {
      if (initializingRef.current || isInitializedRef.current) {
        setIsLoading(false);
        return;
      }

      initializingRef.current = true;
      console.log("🚀 BFF: Initializing...");

      try {
        const userData = await bffService.getCurrentUser();
        console.log("✅ BFF: Session restored for", userData.email);
        userRef.current = userData;
        isAuthenticatedRef.current = true;
        setUser(userData);
        isInitializedRef.current = true;
      } catch (error: any) {
        const status = error?.response?.status;
        if (status === 401 || status === 403) {
          console.log("ℹ️ BFF: No active session");
        } else if (status === 429) {
          console.warn("⚠️ BFF: Rate limited on init");
        } else {
          console.error("❌ BFF: Init error:", error);
        }
      } finally {
        setIsLoading(false);
        initializingRef.current = false;
      }
    };

    // Small delay to let the cookie jar settle after a hard navigation.
    const t = setTimeout(initializeBFF, 100);
    return () => clearTimeout(t);
  }, []); // Run exactly once on mount.

  // ─── background session-status polling ───────────────────────────────────────
  //
  // KEY FIX: Depend on `isLoading` (becomes false after init) rather than
  // `user?.id`. This means the effect only runs once after init completes,
  // not every time the user object is replaced.

  useEffect(() => {
    if (isLoading) return; // Don't start polling until init is done.

    if (!isAuthenticatedRef.current) {
      clearSessionInterval();
      return;
    }

    console.log("🔄 BFF: Starting session status polling (5 min)");
    sessionStatusIntervalRef.current = setInterval(() => {
      if (isAuthenticatedRef.current) {
        refreshSession();
      }
    }, 5 * 60 * 1000);

    return clearSessionInterval;
  }, [isLoading, refreshSession]); // `isLoading` flips once; `refreshSession` is stable.


  const value: BFFContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    sessionStatus,
    setAuth,
    logout,
    updateUser,
    refreshSession,
  };

  return <BFFContext.Provider value={value}>{children}</BFFContext.Provider>;
}