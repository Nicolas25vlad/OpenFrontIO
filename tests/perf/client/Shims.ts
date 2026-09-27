/**
 * Browser-global shims for running client code (src/client/view, theme,
 * WebGLFrameBuilder) under Node. Import this FIRST — ESM executes imports in
 * order, so it must precede any module that touches these globals.
 *
 * A minimal DOM is needed for module-level browser event listeners. The
 * harness does not render DOM-bound HUD layers, so a JSDOM document is enough.
 * UserSettings reads localStorage lazily; an in-memory store means every
 * setting resolves to its default, which is also the deterministic choice.
 */
import { createRequire } from "node:module";

const { JSDOM } = createRequire(import.meta.url)("jsdom") as {
  JSDOM: new (
    html: string,
    options: { url: string },
  ) => { window: Record<string, unknown> };
};
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
});
const browserGlobals = globalThis as unknown as Record<string, unknown>;

for (const name of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLCanvasElement",
  "CustomEvent",
]) {
  if (typeof browserGlobals[name] === "undefined") {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: dom.window[name],
    });
  }
}

if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, String(value));
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    },
  });
}

export {};
