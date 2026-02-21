
export const AccountType = {
  AGENCY_ADMIN: "AGENCY_ADMIN",
  USER: "USER",
} as const;
export type AccountType = typeof AccountType[keyof typeof AccountType];

export interface VerifyTokenRequest {
  token: string;
  userId: string;
}

export interface VerifyTokenResponse {
  success: boolean;
  message: string;
  data: {
    email: string;
    accountType: AccountType;
  };
}

export interface CompleteActivationRequest {
  userId: string;
  token: string;
  password: string;
  confirmPassword: string;
}

export interface CompleteActivationResponse {
  success: boolean;
  message: string;
}

export interface ResendActivationRequest {
  userId: string;
}

export interface ResendActivationResponse {
  success: boolean;
  message: string;
}

export interface ActivationFormData {
  password: string;
  confirmPassword: string;
}

export interface ActivationState {
  step: "verifying" | "form" | "success" | "error";
  email?: string;
  accountType?: AccountType;
  error?: string;
}