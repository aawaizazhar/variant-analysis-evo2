"use client";

import { useEffect } from "react";
import { useAuth } from "~/providers/auth-provider";

type ThemePreference = "system" | "dark" | "light";

function normalizeThemePreference(value: unknown): ThemePreference {
  if (value === "dark" || value === "light") return value;
  return "system";
}

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function applyTheme(theme: ThemePreference) {
  const root = document.documentElement;
  const resolvedTheme = theme === "system" ? getSystemTheme() : theme;

  root.classList.toggle("dark", resolvedTheme === "dark");
  root.classList.toggle("light", resolvedTheme === "light");
  root.dataset.theme = theme;
  root.dataset.resolvedTheme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const themePreference = normalizeThemePreference(profile?.theme_preference);

  useEffect(() => {
    applyTheme(themePreference);

    if (themePreference !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const handleSystemThemeChange = () => applyTheme("system");

    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, [themePreference]);

  return children;
}
