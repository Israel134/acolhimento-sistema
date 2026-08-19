import React, { createContext, useContext, useEffect, useState } from "react";

type ThemePref = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: ThemePref;
  resolvedTheme: "light" | "dark";
  setTheme: (t: ThemePref) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function systemPrefersDark() {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>(
    () => (localStorage.getItem("acolhimento_theme") as ThemePref) || "system"
  );
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(
    theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme
  );

  useEffect(() => {
    const apply = () => {
      const resolved = theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme;
      setResolvedTheme(resolved);
      document.documentElement.classList.toggle("dark", resolved === "dark");
    };
    apply();
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme]);

  const setTheme = (t: ThemePref) => {
    setThemeState(t);
    localStorage.setItem("acolhimento_theme", t);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme deve ser usado dentro de ThemeProvider");
  return ctx;
}
