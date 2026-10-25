// Session-scoped (in-memory) cache for the admin screens' bootstrap data.
// It persists across client-side navigations but clears on a full reload, so
// revisiting a screen within the same session shows its last data instantly
// (no loading skeleton) while a background fetch silently refreshes it.

const store = new Map<string, unknown>();

export function getCachedBootstrap<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export function setCachedBootstrap<T>(key: string, value: T): void {
  store.set(key, value);
}

export function clearCachedBootstrap(key: string): void {
  store.delete(key);
}

export function clearAllCachedBootstrap(): void {
  store.clear();
}
