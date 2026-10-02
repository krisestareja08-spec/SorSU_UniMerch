export type ThemeChoice = "system" | "light" | "dark"
export const THEME_STORAGE_KEY = "theme"

/** Runs in <head> before paint so the saved theme applies without a flash. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}")||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);var c=document.documentElement.classList;c.toggle("dark",d);c.toggle("light",!d)}catch(e){}})()`
