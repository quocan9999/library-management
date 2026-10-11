const listeners = new Set<() => void>();

export function subscribeToCapabilityRefresh(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function requestCapabilityRefresh(): void {
  listeners.forEach((listener) => listener());
}
