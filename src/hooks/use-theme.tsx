import { useCallback, useEffect, useState } from "react";
import { initTheme, persistTheme, type Theme } from "@/lib/theme";

export function useTheme() {
  // Starts as "light" for the very first render (before the effect below
  // runs), then immediately syncs to the real stored/system value — avoids
  // needing this hook to know about SSR, which this app doesn't use anyway.
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    setThemeState(initTheme());
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      persistTheme(next);
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}