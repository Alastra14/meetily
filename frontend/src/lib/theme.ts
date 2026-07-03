// Ternova Meet — gestión de tema (claro / oscuro / sistema).
// Persistido en localStorage; aplica la clase `dark` en <html> (tailwind
// darkMode: ['class']). Emite 'tn-theme-change' para que la UI reaccione.

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'tn-theme';
export const THEME_CHANGE_EVENT = 'tn-theme-change';

export function getThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyThemeMode(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', resolveIsDark(mode));
}

export function setThemeMode(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch { /* almacenamiento no disponible */ }
  applyThemeMode(mode);
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: mode }));
}

/** Ciclo del toggle: light → dark → system → light… */
export function nextThemeMode(mode: ThemeMode): ThemeMode {
  return mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light';
}
