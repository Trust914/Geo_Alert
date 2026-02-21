/**
 * useBFF Hook
 * Custom hook for accessing BFF context throughout the application
 */

import { useContext } from "react";
import { BFFContext } from "./bff.context";
import type { BFFContextType } from "../types";

export function useBFF(): BFFContextType {
  const context = useContext(BFFContext);

  if (context === undefined) {
    throw new Error("useBFF must be used within a BFFProvider");
  }

  return context;
}