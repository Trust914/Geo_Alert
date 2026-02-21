import React, {  useEffect, useState, useCallback } from 'react';
import type { AuthContextType, User } from '../types';
import { authService } from '../services';
import { tokenStorage } from '../../../services/storage';
import { ENV } from '../../../config';
import { AuthContext } from './auth.context';


export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Set authenticated user and store access token in memory
   */
  const setAuth = useCallback((userData: User, accessToken: string) => {
    tokenStorage.setAccessToken(accessToken);
    setUser(userData);
  }, []);

  /**
   * Logout user and clear all tokens
   */
  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      tokenStorage.clearAll();
      setUser(null);
      //Redirect to login or clear query cache here
    }
  }, []);

  /**
   * Update user data (e.g., after profile update)
   */
  const updateUser = useCallback((userData: User) => {
    setUser(userData);
  }, []);

  /**
   * Global Event Listener for 401/Logout events from Axios Interceptor
   */
  useEffect(() => {
    const handleLogout = () => {
      tokenStorage.clearAll();
      setUser(null);
    };

    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  /**
   * 🚀 INITIALIZATION FLOW
   * 1. Try to refresh token (checks HttpOnly cookie)
   * 2. If success, get access token -> fetch user profile
   * 3. If fail, stop loading (user is guest)
   */
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Step 1: Get short-lived Access Token from secure Cookie
        const { accessToken } = await authService.refreshToken();
        tokenStorage.setAccessToken(accessToken);

        // Step 2: Use that token to get User Details
        const { user: userData } = await authService.getCurrentUser();
        setUser(userData);

      } catch (error) {
        // Silent fail: User is simply not logged in (or session expired)
        console.debug('No active session found', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  /**
   * 🔄 SILENT REFRESH LOOP
   * Proactively refresh token before it expires to prevent 401s
   */
  useEffect(() => {
    if (!user) return;

    // Refresh 1 minute before expiry (assuming 15min token)
    // Better strategy: Decode JWT exp, but interval works for now
    const refreshInterval = setInterval(async () => {
      try {
        const { accessToken } = await authService.refreshToken();
        tokenStorage.setAccessToken(accessToken);
      } catch (error) {
        console.error('Auto-refresh failed:', error);
        // Don't logout immediately, let the interceptor handle the next 401
      }
    }, ENV.TOKEN_REFRESH_INTERVAL || 14 * 60 * 1000);

    return () => clearInterval(refreshInterval);
  }, [user]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    setAuth,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}