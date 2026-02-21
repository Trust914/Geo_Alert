// src/features/users/hooks/useUsers.ts
// React Query hooks for the Users feature with Super Admin support

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { QUERY_KEYS } from "../../../lib/reactQuery/queryKeys";
import type { ICreateUserDTO, IUpdateUserDTO, IUserFilters, IUser } from "../types/";
import type { TwoFactorAuthError } from "../../../types/common.types";
import { useState } from "react";
import { UserAPI } from "../services/user.services";
import { agencyApi } from "../../agencies/services/agency.api";
// import { AgencyAPI } from "../services/agency.services";

// ============================================================================
// QUERY HOOKS
// ============================================================================

/**
 * Fetch ALL users across all agencies (Super Admin only).
 * queryKey includes filters for proper cache management.
 */
export function useAllUsers(filters?: IUserFilters) {
  return useQuery({
    queryKey: QUERY_KEYS.USERS.ALL(filters),
    queryFn: () => UserAPI.getAllUsers(filters),
    staleTime: 30 * 1000,
  });
}

/**
 * Fetch paginated + filtered user list for a specific agency (Agency Admin).
 * queryKey includes filters for proper cache management.
 */
export function useUsersByAgency(agencyId: string, filters?: IUserFilters) {
  return useQuery({
    queryKey: QUERY_KEYS.USERS.BY_AGENCY(agencyId, filters),
    queryFn: () => UserAPI.getUsersByAgency(agencyId, filters),
    enabled: !!agencyId,
    staleTime: 30 * 1000,
  });
}

/**
 * Fetch a single user by ID.
 */
export function useUserById(userId: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.USERS.BY_ID(userId!),
    queryFn: () => UserAPI.getUserById(userId!),
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
}

/**
 * Fetch list of all agencies (for Super Admin user creation dropdown).
 */
export function useAgencies() {
  return useQuery({
    queryKey: QUERY_KEYS.AGENCIES.ALL,
    queryFn: () => agencyApi.getAllAgenciesDropDown(),
    staleTime: 5 * 60 * 1000, // 5 minutes - agencies rarely change
  });
}

// ============================================================================
// MUTATION HOOKS
// ============================================================================

/**
 * Create a new user.
 * On success: invalidate appropriate cache based on user type.
 */
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ICreateUserDTO) => UserAPI.createUser(data),
    onSuccess: (data) => {
      // Invalidate both ALL users cache (for super admins) and agency-specific cache
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.USERS.ALL(),
      });

      if (data.agencyId) {
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.USERS.BY_AGENCY(data.agencyId),
        });
      }

      toast.success("User created successfully", {
        description: `Activation email sent to ${data.email}`,
      });
    },
    onError: (error: any) => {
      toast.error("Failed to create user", {
        description: error.response?.data?.error || "An error occurred",
      });
    },
  });
}

/**
 * Update user details.
 * Uses optimistic update on the single-user cache, then invalidates relevant lists.
 */
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: IUpdateUserDTO }) =>
      UserAPI.updateUser(userId, data),

    onMutate: async ({ userId, data }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.USERS.BY_ID(userId) });

      const previousUser = queryClient.getQueryData<IUser>(QUERY_KEYS.USERS.BY_ID(userId));

      if (previousUser) {
        queryClient.setQueryData<IUser>(QUERY_KEYS.USERS.BY_ID(userId), {
          ...previousUser,
          ...data,
          updatedAt: new Date(),
        });
      }

      return { previousUser };
    },

    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEYS.USERS.BY_ID(data.id), data);

      // Invalidate both ALL users and agency-specific caches
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USERS.ALL() });

      if (data.agencyId) {
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.USERS.BY_AGENCY(data.agencyId),
        });
      }

      toast.success("User updated successfully");
    },

    onError: (error: any, variables, context) => {
      if (context?.previousUser) {
        queryClient.setQueryData(QUERY_KEYS.USERS.BY_ID(variables.userId), context.previousUser);
      }

      toast.error("Failed to update user", {
        description: error.response?.data?.error || "An error occurred",
      });
    },
  });
}

/**
 * Deactivate a user account (may trigger 2FA challenge).
 */
export function useDeactivateUser() {
  const queryClient = useQueryClient();
  const [pending2FA, setPending2FA] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: ({ userId, twoFactorCode }: { userId: string; twoFactorCode?: string }) =>
      UserAPI.deactivateUser(userId, twoFactorCode),

    onMutate: async ({ userId }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.USERS.BY_ID(userId) });

      const previousUser = queryClient.getQueryData<IUser>(QUERY_KEYS.USERS.BY_ID(userId));

      if (previousUser) {
        queryClient.setQueryData<IUser>(QUERY_KEYS.USERS.BY_ID(userId), {
          ...previousUser,
          isActive: false,
          updatedAt: new Date(),
        });
      }

      return { previousUser };
    },

    onSuccess: (_, { userId }) => {
      const cachedUser = queryClient.getQueryData<IUser>(QUERY_KEYS.USERS.BY_ID(userId));

      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USERS.BY_ID(userId) });

      // Invalidate both caches
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USERS.ALL() });

      if (cachedUser?.agencyId) {
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.USERS.BY_AGENCY(cachedUser.agencyId),
        });
      }

      toast.success("User deactivated successfully");
      setPending2FA(null);
    },

    onError: (error: any, { userId }, context) => {
      const authError = error as TwoFactorAuthError;

      if (authError.is2FARequired) {
        setPending2FA(authError.originalRequest?.url || "pending");
        toast.info("2FA verification required", {
          description: "Please enter your 2FA code to continue",
        });
      } else {
        if (context?.previousUser) {
          queryClient.setQueryData(QUERY_KEYS.USERS.BY_ID(userId), context.previousUser);
        }

        toast.error("Failed to deactivate user", {
          description: error.response?.data?.error || "An error occurred",
        });
        setPending2FA(null);
      }
    },
  });

  return { ...mutation, pending2FA, clearPending2FA: () => setPending2FA(null) };
}

/**
 * Reactivate a user account.
 */
export function useReactivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => UserAPI.reactivateUser(userId),

    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.USERS.BY_ID(userId) });

      const previousUser = queryClient.getQueryData<IUser>(QUERY_KEYS.USERS.BY_ID(userId));

      if (previousUser) {
        queryClient.setQueryData<IUser>(QUERY_KEYS.USERS.BY_ID(userId), {
          ...previousUser,
          isActive: true,
          updatedAt: new Date(),
        });
      }

      return { previousUser };
    },

    onSuccess: (_, userId) => {
      const cachedUser = queryClient.getQueryData<IUser>(QUERY_KEYS.USERS.BY_ID(userId));

      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USERS.BY_ID(userId) });

      // Invalidate both caches
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USERS.ALL() });

      if (cachedUser?.agencyId) {
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.USERS.BY_AGENCY(cachedUser.agencyId),
        });
      }

      toast.success("User reactivated successfully");
    },

    onError: (error: any, userId, context) => {
      if (context?.previousUser) {
        queryClient.setQueryData(QUERY_KEYS.USERS.BY_ID(userId), context.previousUser);
      }

      toast.error("Failed to reactivate user", {
        description: error.response?.data?.error || "An error occurred",
      });
    },
  });
}

/**
 * Force-reset another user's password (may trigger 2FA challenge).
 */
export function useResetUserPassword() {
  const queryClient = useQueryClient();
  const [pending2FA, setPending2FA] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: ({ userId, twoFactorCode }: { userId: string; twoFactorCode?: string }) =>
      UserAPI.resetUserPassword(userId, twoFactorCode),

    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USERS.BY_ID(userId) });

      toast.success("Password reset email sent", {
        description: "User will receive instructions to reset their password",
      });
      setPending2FA(null);
    },

    onError: (error: any) => {
      const authError = error as TwoFactorAuthError;

      if (authError.is2FARequired) {
        setPending2FA(authError.originalRequest?.url || "pending");
        toast.info("2FA verification required", {
          description: "Please enter your 2FA code to continue",
        });
      } else {
        toast.error("Failed to reset password", {
          description: error.response?.data?.error || "An error occurred",
        });
        setPending2FA(null);
      }
    },
  });

  return { ...mutation, pending2FA, clearPending2FA: () => setPending2FA(null) };
}

/**
 * Update the current user's OWN profile (name only).
 */
export function useUpdateOwnProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: Pick<IUpdateUserDTO, "firstName" | "lastName"> }) =>
      UserAPI.updateUser(userId, data),

    onMutate: async ({ userId, data }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.USERS.BY_ID(userId) });

      const previousUser = queryClient.getQueryData<IUser>(QUERY_KEYS.USERS.BY_ID(userId));

      if (previousUser) {
        queryClient.setQueryData<IUser>(QUERY_KEYS.USERS.BY_ID(userId), {
          ...previousUser,
          ...data,
          updatedAt: new Date(),
        });
      }

      return { previousUser };
    },

    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEYS.USERS.BY_ID(data.id), data);

      // Invalidate both caches
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USERS.ALL() });

      if (data.agencyId) {
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.USERS.BY_AGENCY(data.agencyId),
        });
      }

      toast.success("Profile updated successfully");
    },

    onError: (error: any, variables, context) => {
      if (context?.previousUser) {
        queryClient.setQueryData(QUERY_KEYS.USERS.BY_ID(variables.userId), context.previousUser);
      }

      toast.error("Failed to update profile", {
        description: error.response?.data?.error || "An error occurred",
      });
    },
  });
}