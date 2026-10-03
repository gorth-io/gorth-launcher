type Theme = "dark" | "light" | "system";

const THEME_STORAGE_KEY = "launcher-theme";
function readThemeCookie() {
  return document.cookie.split("; ").find((item) => item.startsWith(`${THEME_STORAGE_KEY}=`))?.split("=").slice(1).join("=") ?? null;
}

function readTheme(): Theme {
  const savedTheme = readThemeCookie();

  return savedTheme === "dark" || savedTheme === "light"
    ? savedTheme
    : "system";
}

function resolveTheme(theme: Theme): Exclude<Theme, "system"> {
  if (theme !== "system") return theme;

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  const resolvedTheme = resolveTheme(theme);

  document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = resolvedTheme;
}

function saveTheme(theme: Theme) {
  document.cookie = `${THEME_STORAGE_KEY}=${theme}; path=/; max-age=31536000; SameSite=Strict`;
  applyTheme(theme);
}

function subscribeToSystemTheme(callback: () => void) {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", callback);

  return () => mediaQuery.removeEventListener("change", callback);
}

export { applyTheme, readTheme, saveTheme, subscribeToSystemTheme };
export type { Theme };
