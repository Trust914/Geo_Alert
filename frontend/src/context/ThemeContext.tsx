"use client";

// src/context/ThemeContext.tsx
import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const STORAGE_KEY = "app-theme";

// Helper to get initial theme without triggering effects
const getInitialTheme = (): Theme => {
  if (typeof window === "undefined") return "system";
  return (localStorage.getItem(STORAGE_KEY) as Theme) || "system";
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const root = window.document.documentElement;

    const applyTheme = () => {
      const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

      // Only manipulate classes if this is NOT the first render
      // The blocking script in index.html already handled the initial state
      if (!isFirstRender.current) {
        root.classList.remove("light", "dark");
        root.classList.add(isDark ? "dark" : "light");
      }

      isFirstRender.current = false;
      localStorage.setItem(STORAGE_KEY, theme);
    };

    applyTheme();

    // Listen for OS changes if user is on 'system' mode
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = () => {
        root.classList.remove("light", "dark");
        const isDark = mediaQuery.matches;
        root.classList.add(isDark ? "dark" : "light");
      };
      mediaQuery.addEventListener("change", listener);
      return () => mediaQuery.removeEventListener("change", listener);
    }
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};
