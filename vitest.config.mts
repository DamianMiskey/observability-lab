import path from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests (tests/): plain functions, no server or network. End-to-end tests
// (e2e/) are Playwright's.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 20_000,
  },
});
