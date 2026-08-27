/**
 * Light / dark appearance.
 *
 * The stylesheet already understands three states, so this only has to pick
 * one and remember it:
 *
 *   no data-theme stamp   follow the device setting (prefers-color-scheme)
 *   data-theme="light"    force light
 *   data-theme="dark"     force dark
 *
 * A fresh visitor gets no stamp, so the app matches whatever their phone or
 * laptop is set to. The moment they press the switch we stamp their choice and
 * keep it, because someone who has said "I want this light" means it on every
 * later visit, whatever their device thinks.
 *
 * Only two positions are offered rather than a light/dark/auto cycle. The
 * people using this are teachers between classes, not power users, and a
 * two-position switch is readable at a glance; "auto" still exists as the
 * starting state, it just is not something anyone has to understand.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'maktab_theme';
const ThemeContext = createContext(null);

/** What the device asks for, when the user has not overridden it. */
function devicePrefersDark() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * The stored choice, or null for "follow the device".
 *
 * Reading localStorage throws in a few real situations — Safari's private
 * mode, an embedded webview with site data blocked — and a theme is never
 * worth a blank screen, so failure just means "follow the device".
 */
function storedChoice() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function stamp(choice) {
  const root = document.documentElement;
  if (choice) root.setAttribute('data-theme', choice);
  else root.removeAttribute('data-theme');
}

export function ThemeProvider({ children }) {
  // `null` means no explicit choice: the stylesheet's media query decides.
  const [choice, setChoice] = useState(() => (typeof window === 'undefined' ? null : storedChoice()));

  // Mirrors the device setting so the switch can show the right position
  // before anyone has chosen, and follow along if they change it mid-session.
  const [deviceDark, setDeviceDark] = useState(devicePrefersDark);

  useEffect(() => {
    stamp(choice);
    try {
      if (choice) window.localStorage.setItem(STORAGE_KEY, choice);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // A theme that does not persist is still a theme that works.
    }
  }, [choice]);

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event) => setDeviceDark(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const value = useMemo(() => {
    const isDark = choice ? choice === 'dark' : deviceDark;
    return {
      /** What is actually on screen right now. */
      resolved: isDark ? 'dark' : 'light',
      /** The explicit choice, or null while following the device. */
      choice,
      isDark,
      setTheme: setChoice,
      toggle: () => setChoice(isDark ? 'light' : 'dark'),
      /** Hands appearance back to the device setting. */
      useDevice: () => setChoice(null),
    };
  }, [choice, deviceDark]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside a ThemeProvider');
  return context;
}
