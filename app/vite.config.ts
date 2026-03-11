import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";

export default defineConfig({
  plugins: [
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
  ],
  optimizeDeps: {
    // Both garaga and @aztec/bb.js ship their own WASM bundles.
    // Excluding them prevents Vite from trying to bundle/transform them,
    // which breaks WASM loading and worker resolution.
    exclude: ["garaga", "@aztec/bb.js"],
    esbuildOptions: {
      conditions: ["browser"],
    },
  },
  build: {
    target: "esnext",
  },
  server: {
    headers: {
      // Required for SharedArrayBuffer (kept in case threads > 1 is ever re-enabled)
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  resolve: {
    conditions: ["browser", "module", "import", "default"],
    alias: {
      // Point @aztec/bb.js explicitly to its browser build
      "@aztec/bb.js": path.resolve(
        __dirname,
        "node_modules/@aztec/bb.js/dest/browser/index.js"
      ),
      pino: "pino/browser.js",
    },
  },
});
