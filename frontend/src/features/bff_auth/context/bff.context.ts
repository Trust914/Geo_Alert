/**
 * BFF Context
 * Global state management for BFF authentication and session
 */

import { createContext } from "react";
import type { BFFContextType } from "../types";

export const BFFContext = createContext<BFFContextType | undefined>(undefined);