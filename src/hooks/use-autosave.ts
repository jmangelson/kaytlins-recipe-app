import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Calls `save(value)` once `value` has stopped changing for `delayMs`, and
 * immediately if the screen closes with a change still pending, so leaving
 * right after typing never loses the edit. Skips the initial value.
 */
export function useAutosave<T>(value: T, save: (value: T) => void, delayMs = 700) {
  const saveRef = useRef(save);
  useLayoutEffect(() => {
    saveRef.current = save;
  });
  const pending = useRef<{ value: T } | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    pending.current = { value };
    const timer = setTimeout(() => {
      pending.current = null;
      saveRef.current(value);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  useEffect(
    () => () => {
      if (pending.current) saveRef.current(pending.current.value);
    },
    []
  );
}
