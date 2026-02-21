import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios"; // Import AxiosError
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { APIResponse } from "../../../types/common.types";
import { useAuth } from "../context/useAuth";
import { authService } from "../services";
import { TwoFactorMethod } from "../../../types/enums.types";

export function useLogin() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();

  return useMutation({
    mutationFn: authService.login,
    onSuccess: (data) => {
      // console.log("Login response:", data); // Debug log

      // Logic from API docs: Check if 2FA is required
      if (data.requiresTwoFactor) {
        navigate("/auth/verify-2fa", {
          state: {
            email: data.user?.email, // Ensure safe access
            method: data.twoFactorMethod || TwoFactorMethod.GOOGLE_AUTHENTICATOR,
            preAuthToken: data.preAuthToken,
          },
        });
        toast.info("Please enter your verification code");
      } else if (data.accessToken && data.user) {
        // Full Login Success
        setAuth(data.user, data.accessToken);

        if (data.user.mustChangePassword) {
          navigate("/auth/change-password");
          toast.warning("Please change your password");
        } else {
          navigate("/dashboard");
          toast.success("Login successful");
        }
      }
    },
    // Fix: Type the error correctly to access response.data.message
    onError: (error: AxiosError<APIResponse>) => {
      const message = error.response?.data?.message || error.message || "Login failed";
      toast.error(message);
    },
  });
}
