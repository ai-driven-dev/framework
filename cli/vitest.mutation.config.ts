import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { configDefaults, defineConfig } from "vitest/config";
import { CheapestKillerFirst } from "./tests/helpers/mutation-sequencer.js";
import { UnloadableFileAsFailedTest } from "./tests/helpers/unloadable-file-as-failed-test.js";
import { textLoader } from "./tests/helpers/vitest-text-loader.js";

const TEXT_EXTENSIONS = [".md", ".toml", ".txt", ".cjs"] as const;

/**
 * Every test file that drives the CLI in process, directly or through a helper that does.
 * Those tests replace e2e tests that never ran under mutation either, and they cannot run here:
 * Stryker runs Vitest on worker threads, where `os.homedir()` ignores the substituted HOME.
 * Scanned at load, so a new such test is left out without anyone remembering to list it.
 */
function inProcessCliTests(): string[] {
  const testsDir = join(import.meta.dirname, "tests");
  const files = readdirSync(testsDir, { recursive: true, encoding: "utf8" })
    .map((path) => path.split("\\").join("/"))
    .filter((path) => path.endsWith(".ts"));
  const imports = (path: string, module: string): boolean =>
    new RegExp(`from "[^"]*/${module}\\.js"`).test(readFileSync(join(testsDir, path), "utf8"));
  const isTest = (path: string): boolean => /\.(unit|integration)\.test\.ts$/.test(path);
  const drivers = ["in-process-cli"];
  for (const path of files) {
    if (!isTest(path) && path.startsWith("helpers/") && imports(path, "in-process-cli")) {
      drivers.push(path.replace(/^helpers\//, "").replace(/\.ts$/, ""));
    }
  }
  return files
    .filter((path) => isTest(path) && drivers.some((driver) => imports(path, driver)))
    .map((path) => `tests/${path}`);
}

const IN_PROCESS_CLI_TESTS = inProcessCliTests();

/**
 * The projects a mutation run may use: the two that measure behaviour.
 *
 * The architecture ratchets read the source tree as text — folder sizes, cited paths,
 * the import graph. Stryker works on a copy of that tree with a mutant injected, so those
 * tests answer a question about the sandbox rather than about the code, and they fail the
 * initial run before a single mutant is tried.
 *
 * The e2e project is left out for the opposite reason: it spawns the built binary, which
 * no mutant reaches, so every mutant would survive it and dilute the score with noise.
 *
 * A separate config limits `test.projects` to source tests; mutation runs must never
 * inherit the architecture or subprocess e2e projects from the ordinary suite.
 *
 * A test file that fails to load still counts. Stryker's vitest runner reads only the tests it
 * collected, and a file whose import throws collects none, so a static mutant that stops a
 * module from loading was reported as survived. `UnloadableFileAsFailedTest` gives such a file
 * one failed test carrying its load error. Vitest types a test with a context only it can build;
 * that test has none, and nothing reads one once the run has finished.
 *
 * Stryker stops a mutant at its first failing test, so `CheapestKillerFirst` runs the unit
 * files before the integration ones, the smallest first: the test that kills a mutant in a
 * millisecond no longer waits behind the slow files Vitest would otherwise start with.
 */
export default defineConfig({
  test: {
    reporters: ["default", new UnloadableFileAsFailedTest()],
    sequence: { sequencer: CheapestKillerFirst },
    projects: [
      {
        extends: false,
        plugins: [textLoader(TEXT_EXTENSIONS)],
        test: {
          name: "unit",
          include: ["tests/**/*.unit.test.ts"],
          exclude: [...configDefaults.exclude, ...IN_PROCESS_CLI_TESTS],
          globals: false,
          environment: "node",
          globalSetup: ["./tests/helpers/throwaway-profile.ts"],
        },
      },
      {
        extends: false,
        plugins: [textLoader(TEXT_EXTENSIONS)],
        test: {
          name: "integration",
          include: ["tests/**/*.integration.test.ts"],
          exclude: [...configDefaults.exclude, ...IN_PROCESS_CLI_TESTS],
          globals: false,
          environment: "node",
          globalSetup: ["./tests/helpers/throwaway-profile.ts"],
          testTimeout: 60000,
          hookTimeout: 60000,
        },
      },
    ],
  },
});
