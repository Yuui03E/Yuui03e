import { useEffect, useState } from "react";

/**
 * Returns a debounced copy of `value` — the returned value only updates after
 * `delay` ms of inactivity on the source. Useful for delaying expensive
 * operations (search queries, filter computations) while keeping the UI
 * responsive to keystrokes.
 *
 * @example
 * ```ts
 * const debouncedQuery = useDebounce(searchQuery, 400);
 * useEffect(() => {
 *   if (debouncedQuery) runSearch(debouncedQuery);
 * }, [debouncedQuery]);
 * ```
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
