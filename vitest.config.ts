import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // #439: Playwright E2E specs live under tests/e2e/ and use @playwright/test's
    // own `describe`/`test` runner — incompatible with Vitest. E2E is invoked
    // via `npm run test:e2e`, never through Vitest.
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**", ".next/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
