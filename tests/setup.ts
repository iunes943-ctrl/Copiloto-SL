// Polyfill mínimo de localStorage para o ambiente node do Vitest.
const store = new Map<string, string>()
const shim = {
  getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => void store.clear(),
  key: (i: number) => (Array.from(store.keys())[i] ?? null),
  get length() {
    return store.size
  },
}
Object.defineProperty(globalThis, 'localStorage', { value: shim, writable: true })
