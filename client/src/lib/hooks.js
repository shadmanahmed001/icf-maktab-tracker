/** Data-fetching and UI hooks used across the portals. */
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Run an async loader and expose { data, error, loading, reload }.
 *
 * `deps` behaves like useEffect's dependency list. A reload keeps the previous
 * data on screen while refetching, so a refresh does not blank the page.
 */
export function useApi(loader, deps = [], { skip = false } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [tick, setTick] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    if (skip) {
      setLoading(false);
      return undefined;
    }
    let canceled = false;
    setLoading(true);
    setError(null);

    loaderRef.current()
      .then((result) => { if (!canceled) setData(result); })
      .catch((err) => { if (!canceled) setError(err); })
      .finally(() => { if (!canceled) setLoading(false); });

    return () => { canceled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, skip]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, setData };
}

/**
 * Track an in-flight mutation: { run, busy, error }.
 * `run` resolves to the action's value, or rethrows so callers can branch.
 */
export function useAction(action, { onSuccess, onError } = {}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = useCallback(async (...args) => {
    setBusy(true);
    setError(null);
    try {
      const result = await action(...args);
      onSuccess?.(result);
      return result;
    } catch (err) {
      setError(err);
      onError?.(err);
      throw err;
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, onSuccess, onError]);

  return { run, busy, error, clearError: () => setError(null) };
}

/** Persist a small preference (selected class, chosen tab) across visits. */
export function useStickyState(key, initial) {
  const storageKey = `maktab.${key}`;
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      return stored === null ? initial : JSON.parse(stored);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // Private browsing or blocked storage — the preference simply won't persist.
    }
  }, [storageKey, value]);

  return [value, setValue];
}

/** Close-on-escape for dialogs and drawers. */
export function useEscapeKey(handler, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') handler(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handler, active]);
}

/** Debounce a fast-changing value, for search inputs. */
export function useDebounced(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
