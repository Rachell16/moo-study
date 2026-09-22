import { useCallback, useEffect, useState } from "react";
import { nextTheme, resolveIsDark, sanitizeTheme, THEME_KEY, type Theme } from "@/lib/theme";

// Menerapkan tema ke <html class="dark">. Skrip inline di __root.tsx sudah menerapkannya sebelum React aktif
// (supaya tidak kedip), jadi hook ini hanya menyinkronkan state dan bereaksi saat tema sistem berubah.
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("system");
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setThemeState(sanitizeTheme(window.localStorage.getItem(THEME_KEY)));
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = resolveIsDark(theme, mq.matches);
      setIsDark(dark);
      document.documentElement.classList.toggle("dark", dark);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      window.localStorage.setItem(THEME_KEY, t);
    } catch {
      /* abaikan */
    }
  }, []);

  const cycle = useCallback(() => setTheme(nextTheme(theme)), [theme, setTheme]);

  return { theme, isDark, setTheme, cycle };
}
