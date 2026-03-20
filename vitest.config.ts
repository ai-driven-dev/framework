import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    testTimeout: 60000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/cli.ts",
        "src/application/commands/**",
        "src/domain/ports/**",
        "src/infrastructure/deps.ts",
        "src/infrastructure/auth/**",
      ],
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 90,
        lines: 85,
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src"),
    },
  },
});
