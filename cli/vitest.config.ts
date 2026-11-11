import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import { textLoader } from "./tests/helpers/vitest-text-loader.js";

const TEXT_EXTENSIONS = [".md", ".toml", ".txt", ".cjs"] as const;

export default defineConfig({
  plugins: [textLoader(TEXT_EXTENSIONS)],
  test: {
    projects: [
      {
        extends: false,
        plugins: [textLoader(TEXT_EXTENSIONS)],
        test: {
          name: "unit",
          include: ["tests/**/*.unit.test.ts"],
          globals: false,
          environment: "node",
          globalSetup: [
            "./tests/helpers/sweep-stale-temp-dirs.ts",
            "./tests/helpers/throwaway-profile.ts",
          ],
        },
      },
      {
        extends: false,
        plugins: [textLoader(TEXT_EXTENSIONS)],
        test: {
          name: "contract",
          include: ["tests/**/*.contract.test.ts"],
          globals: false,
          environment: "node",
          globalSetup: [
            "./tests/helpers/sweep-stale-temp-dirs.ts",
            "./tests/helpers/throwaway-profile.ts",
          ],
        },
      },
      {
        extends: false,
        plugins: [textLoader(TEXT_EXTENSIONS)],
        test: {
          name: "architecture",
          include: ["tests/architecture/**/*.arch.test.ts"],
          globals: false,
          environment: "node",
        },
      },
      {
        extends: false,
        plugins: [textLoader(TEXT_EXTENSIONS)],
        test: {
          name: "integration",
          include: ["tests/**/*.integration.test.ts"],
          globals: false,
          environment: "node",
          testTimeout: 60000,
          // A `beforeEach` that spawns git is slower than the 10s default on a loaded Windows runner.
          hookTimeout: 60000,
          globalSetup: [
            "./tests/helpers/sweep-stale-temp-dirs.ts",
            "./tests/helpers/throwaway-profile.ts",
          ],
        },
      },
      {
        extends: false,
        plugins: [textLoader(TEXT_EXTENSIONS)],
        test: {
          name: "e2e",
          include: ["tests/**/*.e2e.test.ts"],
          globals: false,
          environment: "node",
          testTimeout: 60000,
          globalSetup: ["./tests/e2e/global-setup.ts", "./tests/helpers/sweep-stale-temp-dirs.ts"],
        },
      },
      {
        extends: false,
        plugins: [textLoader(TEXT_EXTENSIONS)],
        test: {
          name: "golden",
          include: ["tests/**/*.golden.test.ts"],
          globals: false,
          environment: "node",
          testTimeout: 60000,
          globalSetup: ["./tests/e2e/global-setup.ts", "./tests/helpers/sweep-stale-temp-dirs.ts"],
        },
      },
    ],
    globals: false,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 60000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts"],
      // Excluded because measuring them here would report a false zero, not because
      // they are untested. `cli.ts` is exercised by the e2e suite and the smoke checks, which
      // spawn a built `cli.js` as a subprocess; v8 coverage does not cross a process boundary:
      // including it reports 0%. `presentation/commands/` is counted: the command tests run
      // it in process.
      // Ports are interfaces with no runtime body, `shared/ports/` and a migrated context's
      // `ports/` included; `runtime/wiring/` and `composition/` are composition. Their real net
      // is the e2e suite and scripts/smoke-tools.sh, counted there. A `contract/` folder is
      // excluded whole although host-registration's holds runtime rules beside its ports: only
      // its mutation scope checks those.
      //
      // Three of these globs still named their pre-refactor locations, under the layer
      // directories the contexts replaced. They excluded nothing, so the files this comment
      // argues must not be counted were counted, and the thresholds below sat about a point
      // from failing for a reason nobody intended. `referenced-paths.arch.test.ts` now reads
      // this file, so a glob cannot outlive the directory it points at again.
      exclude: [
        "src/cli.ts",
        "src/kernel/ports/**",
        "src/contexts/*/domain/ports/**",
        "src/contexts/*/ports/**",
        "src/contexts/*/contract/**",
        "src/shared/ports/**",
        "src/runtime/wiring/**",
        "src/composition/**",
      ],
      // Set a little under 98.81 / 96.08 / 99.47 / 99.34, measured once `presentation/commands/`
      // was counted: a threshold with no headroom fails on an honest change, and one far below
      // what is measured is not a gate. `pnpm test:coverage` runs them, and CI runs that.
      thresholds: {
        statements: 98,
        branches: 95,
        functions: 98.5,
        lines: 98.5,
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src"),
    },
  },
});
