import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import { textLoader } from "./tests/setup/vitest-text-loader.js";

const TEXT_EXTENSIONS = [".md", ".toml", ".txt", ".cjs"] as const;

// Tests of the test tooling itself (mutation filter, sequencer, throwaway profile, platform
// fixtures). They run in the `tooling` project, which CI runs and the default run skips.
const TOOLING_TESTS = [
  "tests/mutation/stryker-filter.integration.test.ts",
  "tests/shared/testing/realpath-windows.unit.test.ts",
  "tests/mutation/mutation-sequencer.integration.test.ts",
  "tests/setup/throwaway-profile.integration.test.ts",
  "tests/mutation/unloadable-file-as-failed-test.integration.test.ts",
  "tests/mutation/unloadable-file-as-failed-test.unit.test.ts",
];

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
          exclude: [...TOOLING_TESTS],
          globals: false,
          environment: "node",
          globalSetup: [
            "./tests/setup/sweep-stale-temp-dirs.ts",
            "./tests/setup/throwaway-profile.ts",
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
            "./tests/setup/sweep-stale-temp-dirs.ts",
            "./tests/setup/throwaway-profile.ts",
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
          testTimeout: 60000,
        },
      },
      {
        extends: false,
        plugins: [textLoader(TEXT_EXTENSIONS)],
        test: {
          name: "integration",
          include: ["tests/**/*.integration.test.ts"],
          exclude: [...TOOLING_TESTS],
          globals: false,
          environment: "node",
          testTimeout: 60000,
          // A `beforeEach` that spawns git is slower than the 10s default on a loaded Windows runner.
          hookTimeout: 60000,
          globalSetup: [
            "./tests/setup/sweep-stale-temp-dirs.ts",
            "./tests/setup/throwaway-profile.ts",
          ],
        },
      },
      {
        extends: false,
        plugins: [textLoader(TEXT_EXTENSIONS)],
        test: {
          name: "tooling",
          include: TOOLING_TESTS,
          globals: false,
          environment: "node",
          testTimeout: 60000,
          hookTimeout: 60000,
          globalSetup: [
            "./tests/setup/sweep-stale-temp-dirs.ts",
            "./tests/setup/throwaway-profile.ts",
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
          globalSetup: ["./tests/setup/global-setup.ts", "./tests/setup/sweep-stale-temp-dirs.ts"],
        },
      },
      {
        extends: false,
        plugins: [textLoader(TEXT_EXTENSIONS)],
        test: {
          name: "golden",
          include: ["tests/golden/**/*.golden.test.ts"],
          globals: false,
          environment: "node",
          testTimeout: 60000,
          globalSetup: ["./tests/setup/global-setup.ts", "./tests/setup/sweep-stale-temp-dirs.ts"],
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
      // including it reports 0%. `presentation/controllers/` is counted: the command tests run
      // it in process.
      // Ports are interfaces with no runtime body, `shared/ports/` and a migrated context's
      // `ports/` included; `composition/` is composition. Their real net is the e2e suite and
      // scripts/smoke-tools.sh, counted there. A `contract/` folder is excluded whole although
      // host-registration's holds runtime rules beside its ports: only its mutation scope
      // checks those.
      //
      // Three of these globs still named their pre-refactor locations, under the layer
      // directories the contexts replaced. They excluded nothing, so the files this comment
      // argues must not be counted were counted, and the thresholds below sat about a point
      // from failing for a reason nobody intended. The content check's referenced-paths now reads
      // this file, so a glob cannot outlive the directory it points at again.
      exclude: [
        "src/cli.ts",
        "src/contexts/*/ports/**",
        "src/contexts/*/contract/**",
        "src/shared/ports/**",
        "src/composition/**",
      ],
      // Set a little under 98.81 / 96.08 / 99.47 / 99.34, measured once `presentation/controllers/`
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
