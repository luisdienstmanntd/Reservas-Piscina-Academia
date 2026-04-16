import path from "node:path";
import { defineConfig } from "vitest/config";

/** Suíte separada: requer Docker + `npm run db:start` e .env.local só com URL/chave locais. */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    globals: false,
    passWithNoTests: false,
    include: ["tests/integration/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
    testTimeout: 30_000,
  },
});
