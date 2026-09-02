import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const hasDevelopmentThemeOverride =
    switchable &&
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    ["light", "dark"].includes(new URLSearchParams(window.location.search).get("theme") ?? "");

  const [theme, setTheme] = useState<Theme>(() => {
    if (switchable) {
      const requested = import.meta.env.DEV
        ? new URLSearchParams(window.location.search).get("theme")
        : null;
      if (requested === "light" || requested === "dark") return requested;
      const stored = localStorage.getItem("theme");
      return (stored as Theme) || defaultTheme;
    }
    return defaultTheme;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    if (switchable && !hasDevelopmentThemeOverride) {
      localStorage.setItem("theme", theme);
    }
  }, [theme, switchable, hasDevelopmentThemeOverride]);

  const toggleTheme = switchable
    ? () => {
        setTheme(prev => (prev === "light" ? "dark" : "light"));
      }
    : undefined;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, switchable }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
