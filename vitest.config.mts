import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    // Unit (tests/unit) and contract (tests/contract) suites; e2e is Playwright's.
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", "tests/e2e/**"],
    // Domain code must never depend on the wall clock or real timers implicitly.
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
