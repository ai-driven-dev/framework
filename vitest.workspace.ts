import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      name: "unit",
      include: ["tests/**/*.unit.test.ts"],
      globals: false,
      environment: "node",
    },
  },
  {
    test: {
      name: "integration",
      include: ["tests/**/*.integration.test.ts"],
      globals: false,
      environment: "node",
      testTimeout: 60000,
    },
  },
  {
    test: {
      name: "e2e",
      include: ["tests/**/*.e2e.test.ts"],
      globals: false,
      environment: "node",
      testTimeout: 60000,
    },
  },
]);
