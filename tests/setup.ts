// Add global mocks or configuration here if needed
import "vitest-canvas-mock";

// Keep browser storage available both as window.localStorage and as the
// unqualified global used by the client, even when jsdom runs on an opaque URL.
function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(String(key)) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(String(key)),
    setItem: (key, value) => values.set(String(key), String(value)),
  };
}

const localStorageMock = createStorage();
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: localStorageMock,
});
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: localStorageMock,
});

// ServerEnv.gitCommit() throws when unset; the dev server sets GIT_COMMIT=DEV,
// so tests exercising server code (e.g. the lobby feed) mirror that.
process.env.GIT_COMMIT ??= "DEV";
