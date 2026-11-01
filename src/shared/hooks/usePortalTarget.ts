import { useCallback, useSyncExternalStore } from 'react';

const targets = new Map<string, HTMLElement>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Returns a callback ref that publishes its element as the named portal target.
 * Used by the chat module to offer a slot in its transcript header that another
 * module can fill without importing chat internals.
 */
export function useRegisterPortalTarget(name: string) {
  return useCallback((element: HTMLElement | null) => {
    if (element) {
      targets.set(name, element);
    } else {
      targets.delete(name);
    }
    notify();
  }, [name]);
}

/**
 * The element currently registered under `name`, or null while no such slot is
 * mounted. Used by the browser-use module to portal into the chat header.
 */
export function usePortalTarget(name: string): HTMLElement | null {
  return useSyncExternalStore(subscribe, () => targets.get(name) ?? null, () => null);
}
