import { useSyncExternalStore } from 'react';

/**
 * The cart's total quantity as last reported by the backend (`cart_quantity` from
 * /shop/cart/update_json) — the app-side mirror of the live site's header cart count.
 * The backend's session cart is the source of truth; this only caches its latest number.
 */

let cartQuantity = 0;
const listeners = new Set<() => void>();

export function setCartQuantity(quantity: number) {
  if (quantity === cartQuantity) {
    return;
  }
  cartQuantity = quantity;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useCartQuantity(): number {
  return useSyncExternalStore(subscribe, () => cartQuantity);
}
