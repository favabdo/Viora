const STORAGE_KEY = "viora-theme";

export type Theme = "light" | "dark";

export function getStoredTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage ممكن يكون مقفول (وضع التصفح الخاص)، مفيش مشكلة لو الحفظ فشل
  }
}
