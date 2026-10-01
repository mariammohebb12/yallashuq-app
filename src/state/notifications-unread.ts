import { useSyncExternalStore } from 'react';

/**
 * The customer's unread notification count as last reported by /my/notifications/json — shared by
 * the header bell and the inbox (same pattern as cart-quantity.ts). `null` = no count to show
 * (signed out, error, or sample data).
 */

let unreadCount: number | null = null;
const listeners = new Set<() => void>();

export function setUnreadNotifications(count: number | null) {
  if (count === unreadCount) {
    return;
  }
  unreadCount = count;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useUnreadNotifications(): number | null {
  return useSyncExternalStore(subscribe, () => unreadCount);
}
