import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { Alert, AlertFilters, AlertTarget, CreateAlertRequest } from "../types/";
import { QUERY_KEYS } from "../../../lib/reactQuery";
import { alertService } from "../services/";
import type { APIResponse } from "../../../types/";

/**
 * HELPER: Sorts alerts by updatedAt or createdAt in descending order.
 */
const sortAlertsByRecency = (alerts: Alert[]) => {
  return [...alerts].sort((a, b) => {
    const dateA = new Date(a.updatedAt || a.createdAt).getTime();
    const dateB = new Date(b.updatedAt || b.createdAt).getTime();
    return dateB - dateA;
  });
};

// --- QUERIES ---

export function useAlerts(filters?: AlertFilters) {
  return useQuery({
    queryKey: QUERY_KEYS.ALERTS.LIST(filters),
    queryFn: () => alertService.getAlerts(filters),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 1,
    refetchInterval: (query) => {
      const alerts = query.state.data?.data;
      const hasActiveAlerts = alerts?.some(
        (alert: Alert) => alert.status === "PENDING" || alert.status === "SENT"
      );
      return hasActiveAlerts ? 3000 : false;
    },
    refetchIntervalInBackground: true,
  });
}

export function useAlert(alertId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.ALERTS.BY_ID(alertId),
    queryFn: () => alertService.getAlertById(alertId),
    enabled: !!alertId,
    staleTime: 1000 * 30,
  });
}

export function useAlertPreview(alertId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.ALERTS.PREVIEW(alertId),
    queryFn: () => alertService.previewAlert(alertId),
    enabled: !!alertId,
    gcTime: 1000 * 60 * 5,
  });
}

export function useAlertStatistics(alertId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.ALERTS.STATS(alertId),
    queryFn: () => alertService.getAlertStatistics(alertId),
    enabled: !!alertId,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });
}

export function useCreateAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateAlertRequest) => alertService.createAlert(data),
    onSuccess: async (response) => {
      const newAlert = response.data as Alert;

      queryClient.setQueryData(QUERY_KEYS.ALERTS.BY_ID(newAlert.id), response);

      queryClient.setQueriesData<APIResponse<Alert[]>>(
        { queryKey: QUERY_KEYS.ALERTS.ALL },
        (oldData) => {
          if (!oldData || !oldData.data || !Array.isArray(oldData.data)) return oldData;
          return {
            ...oldData,
            data: sortAlertsByRecency([newAlert, ...oldData.data]),
            pagination: oldData.pagination
              ? { ...oldData.pagination, total: oldData.pagination.total + 1 }
              : undefined,
          };
        }
      );

      toast.success("Alert Created Successfully");
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ALERTS.ALL });
    },
    onError: (error: any) => {
      toast.error("Failed to create alert", {
        description: error?.response?.data?.message || "An error occurred",
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Step-up OTP initiation
// ---------------------------------------------------------------------------

/**
 * useInitiateStepUpOTP
 *
 * Calls POST /api/v1/two-factor/request-otp (TwoFactorController.requestOtp)
 * when the Send or Cancel confirmation modal opens, so Email 2FA users receive
 * their OTP before they need to type it.
 *
 * Backend responses:
 *  - EMAIL 2FA  -> 200 "OTP sent to email"       -> show info toast
 *  - TOTP       -> 400 "OTP not required..."      -> silent no-op (swallowed)
 *  - No 2FA     -> 400 "OTP not required..."      -> silent no-op (swallowed)
 *
 * The 400 is intentionally swallowed: TOTP and no-2FA users don't need an
 * email and the modal should open normally for them.
 */
export function useInitiateStepUpOTP() {
  return useMutation({
    mutationFn: () => alertService.initiateStepUpOTP(),

    onSuccess: () => {
      toast.info("Verification code sent", {
        description: "Check your email for the 2FA code.",
      });
    },

    onError: (error: any) => {
      const status = error?.response?.status;
      const message: string = error?.response?.data?.message ?? "";

      // 400 "OTP not required for this method" is expected for TOTP / no-2FA users.
      // Treat it as a silent no-op — the modal still opens normally.
      if (status === 400 && message.toLowerCase().includes("not required")) {
        return;
      }

      // Any other error (network failure, 5xx, etc.) is non-fatal but worth
      // surfacing so the user knows to check their email manually.
      console.warn("[useInitiateStepUpOTP] Unexpected error:", error);
      toast.warning("Could not send verification code", {
        description: "Please check your email or use your authenticator app.",
      });
    },
  });
}

export function useSendAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, code }: { id: string; code: string }) =>
      alertService.sendAlert(id, code),

    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.ALERTS.ALL });
      const previousLists = queryClient.getQueriesData({ queryKey: QUERY_KEYS.ALERTS.ALL });

      const now = new Date().toISOString();

      queryClient.setQueriesData<APIResponse<Alert[]>>(
        { queryKey: QUERY_KEYS.ALERTS.ALL },
        (oldData) => {
          if (!oldData || !oldData.data || !Array.isArray(oldData.data)) return oldData;

          const updated = oldData.data.map((a) =>
            a.id === id
              ? { ...a, status: "PENDING" as const, updatedAt: now, sentAt: now }
              : a
          );
          return { ...oldData, data: sortAlertsByRecency(updated) };
        }
      );

      return { previousLists };
    },

    onSuccess: async (response, variables) => {
      const updatedAlert = response.data?.alert;
      if (updatedAlert) {
        queryClient.setQueryData(QUERY_KEYS.ALERTS.BY_ID(variables.id), {
          data: updatedAlert,
        });
      }
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ALERTS.ALL });
      toast.success("Alert Sent Successfully");
    },

    onError: (error: any, _variables, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([key, data]) => queryClient.setQueryData(key, data));
      }
      toast.error("Failed to send alert", {
        description: error?.response?.data?.message || "Please try again",
      });
    },
  });
}

export function useCancelAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, code, reason }: { id: string; code: string; reason: string }) =>
      alertService.cancelAlert(id, code, reason),

    onMutate: async ({ id, reason }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.ALERTS.ALL });
      const previousLists = queryClient.getQueriesData({ queryKey: QUERY_KEYS.ALERTS.ALL });

      const now = new Date().toISOString();

      queryClient.setQueriesData<APIResponse<Alert[]>>(
        { queryKey: QUERY_KEYS.ALERTS.ALL },
        (oldData) => {
          if (!oldData || !oldData.data || !Array.isArray(oldData.data)) return oldData;

          const updated = oldData.data.map((a) =>
            a.id === id
              ? { ...a, status: "CANCELLED" as const, updatedAt: now, cancelReason: reason }
              : a
          );
          return { ...oldData, data: sortAlertsByRecency(updated) };
        }
      );

      return { previousLists };
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ALERTS.ALL });
      toast.success("Alert Cancelled Successfully");
    },

    onError: (error: any, _variables, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([key, data]) => queryClient.setQueryData(key, data));
      }
      toast.error("Failed to cancel alert", {
        description: error?.response?.data?.message || "Please try again",
      });
    },
  });
}

export function useEstimateRecipients() {
  return useMutation({
    mutationFn: (targets: AlertTarget[]) => alertService.estimateRecipients(targets),
    onError: (error: any) => {
      toast.error("Estimation Failed", {
        description: `Could not calculate recipient count. ${
          error.response?.data?.message || ""
        }`,
      });
    },
  });
}