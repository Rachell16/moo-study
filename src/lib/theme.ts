// Tema terang/gelap/ikuti sistem. Murni, tanpa DOM, supaya bisa dites di Node.

export type Theme = "light" | "dark" | "system";
export const THEME_KEY = "moo-theme";
const THEMES: Theme[] = ["system", "light", "dark"];

export function sanitizeTheme(value: unknown): Theme {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

export function resolveIsDark(theme: Theme, systemPrefersDark: boolean): boolean {
  return theme === "dark" || (theme === "system" && systemPrefersDark);
}

// Urutan tombol siklus: Ikuti sistem → Terang → Gelap → (ulang).
export function nextTheme(theme: Theme): Theme {
  return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]!;
}

export const THEME_LABEL: Record<Theme, string> = {
  system: "Ikuti sistem",
  light: "Terang",
  dark: "Gelap",
};
