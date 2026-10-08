const THEME_KEY = "theme";

export type Theme = "light" | "dark";

export function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "dark" || stored === "light" ? stored : null;
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

// Call once on app load — resolves to the person's saved choice, or "light"
// the very first time they ever open the app (deliberately not following the
// OS-level preference, so the app always starts in light mode by default
// until someone explicitly switches it), and applies it immediately.
export function initTheme(): Theme {
  const theme = getStoredTheme() ?? "light";
  applyTheme(theme);
  return theme;
}

export function persistTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}