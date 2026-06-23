import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests cover pure logic only (no DOM/React) — node environment is enough.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
