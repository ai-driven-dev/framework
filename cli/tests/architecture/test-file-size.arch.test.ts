/**
 * A test file past four hundred lines is several files under one name: its cases stop being
 * found, and a change to one drags the rest into review.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { expectRatchet, REPO_ROOT, read } from "./helpers.js";

const MAX_LINES_PER_TEST_FILE = 400;

/**
 * Test files over the limit, each with the line count it carries. The list may only shrink,
 * and an entry leaves when its file is split, not when lines are moved to dodge the count.
 * The test asserts the count, so a number nobody measured fails here.
 */
const BASELINE: readonly { readonly path: string; readonly lines: number }[] = [
  {
    path: "tests/contexts/distribution/infrastructure/plugin-fetcher-cache-and-auth.unit.test.ts",
    lines: 417,
  },
  {
    path: "tests/contexts/framework/application/clean-native-cache.integration.test.ts",
    lines: 947,
  },
  { path: "tests/contexts/framework/application/clean-use-case.unit.test.ts", lines: 3136 },
  {
    path: "tests/contexts/framework/application/clean/clean-shared-ref-guard.integration.test.ts",
    lines: 464,
  },
  {
    path: "tests/contexts/framework/application/clean/clean-user-scope-use-case.integration.test.ts",
    lines: 1999,
  },
  {
    path: "tests/contexts/framework/application/doctor-marketplace-sources.integration.test.ts",
    lines: 492,
  },
  {
    path: "tests/contexts/framework/application/flows/marketplace-remove-use-case.unit.test.ts",
    lines: 703,
  },
  {
    path: "tests/contexts/framework/application/flows/marketplace-sync-machine-projection.integration.test.ts",
    lines: 812,
  },
  {
    path: "tests/contexts/framework/application/flows/marketplace-sync-native-activation.integration.test.ts",
    lines: 1062,
  },
  {
    path: "tests/contexts/framework/application/flows/marketplace-sync-native-provenance.integration.test.ts",
    lines: 549,
  },
  {
    path: "tests/contexts/framework/application/flows/marketplace-sync-recovery-contract.integration.test.ts",
    lines: 811,
  },
  {
    path: "tests/contexts/framework/application/flows/marketplace-sync-settings-migration.integration.test.ts",
    lines: 1470,
  },
  {
    path: "tests/contexts/framework/application/flows/marketplace-sync-settings-scope.integration.test.ts",
    lines: 418,
  },
  {
    path: "tests/contexts/framework/application/flows/marketplace-sync-settings-use-case-manifest-writes.unit.test.ts",
    lines: 674,
  },
  {
    path: "tests/contexts/framework/application/flows/marketplace-sync-settings.unit.test.ts",
    lines: 621,
  },
  {
    path: "tests/contexts/framework/application/flows/marketplace-sync-source-provenance.integration.test.ts",
    lines: 808,
  },
  {
    path: "tests/contexts/framework/application/flows/native-plugin-claims.integration.test.ts",
    lines: 410,
  },
  {
    path: "tests/contexts/framework/application/framework/translator/project-hooks-materializer.unit.test.ts",
    lines: 419,
  },
  {
    path: "tests/contexts/framework/application/install/install-ai-tool-use-case.unit.test.ts",
    lines: 422,
  },
  {
    path: "tests/contexts/framework/application/install/install-runtime-config-use-case.unit.test.ts",
    lines: 435,
  },
  {
    path: "tests/contexts/framework/application/ownership/user-marketplace-remove.integration.test.ts",
    lines: 620,
  },
  {
    path: "tests/contexts/framework/application/ownership/user-plugin-remove.integration.test.ts",
    lines: 417,
  },
  {
    path: "tests/contexts/framework/application/plugin/plugin-add-use-case.unit.test.ts",
    lines: 1104,
  },
  {
    path: "tests/contexts/framework/application/plugin/plugin-install-from-marketplace-use-case.unit.test.ts",
    lines: 618,
  },
  {
    path: "tests/contexts/framework/application/plugin/plugin-install-use-case.unit.test.ts",
    lines: 512,
  },
  {
    path: "tests/contexts/framework/application/plugin/plugin-remove-native-activation.integration.test.ts",
    lines: 988,
  },
  {
    path: "tests/contexts/framework/application/plugin/plugin-remove-selection.integration.test.ts",
    lines: 565,
  },
  {
    path: "tests/contexts/framework/application/plugin/plugin-remove-shared-ref-guard.integration.test.ts",
    lines: 418,
  },
  {
    path: "tests/contexts/framework/application/plugin/plugin-update-built-tree.unit.test.ts",
    lines: 802,
  },
  {
    path: "tests/contexts/framework/application/recipes/validate-recipes.integration.test.ts",
    lines: 990,
  },
  { path: "tests/contexts/framework/application/restore-all-use-case.unit.test.ts", lines: 604 },
  { path: "tests/contexts/framework/application/restore-use-case.unit.test.ts", lines: 735 },
  {
    path: "tests/contexts/framework/application/restore/restore-merge-files-use-case.unit.test.ts",
    lines: 442,
  },
  { path: "tests/contexts/framework/application/setup-use-case.unit.test.ts", lines: 702 },
  {
    path: "tests/contexts/framework/application/shared/ensure-built-marketplace-use-case.integration.test.ts",
    lines: 629,
  },
  {
    path: "tests/contexts/framework/application/shared/remove-project-hooks.unit.test.ts",
    lines: 461,
  },
  { path: "tests/contexts/framework/domain/manifest.unit.test.ts", lines: 567 },
  { path: "tests/contexts/framework/domain/recipes/recipe-validation.unit.test.ts", lines: 415 },
  { path: "tests/contexts/telemetry/application/ingest-usage-use-case.unit.test.ts", lines: 1354 },
  {
    path: "tests/contexts/telemetry/application/report/report-usage-use-case.unit.test.ts",
    lines: 593,
  },
  {
    path: "tests/contexts/telemetry/application/switch/telemetry-switch-use-cases.unit.test.ts",
    lines: 645,
  },
  { path: "tests/contexts/telemetry/consent-scenarios.integration.test.ts", lines: 886 },
  { path: "tests/contexts/telemetry/domain/report/attribution.unit.test.ts", lines: 430 },
  {
    path: "tests/contexts/telemetry/infrastructure/claude-transcript-source-adapter.integration.test.ts",
    lines: 420,
  },
  {
    path: "tests/contexts/telemetry/infrastructure/usage-ledger-adapter.integration.test.ts",
    lines: 475,
  },
  { path: "tests/contexts/telemetry/telemetry-lifecycle.integration.test.ts", lines: 596 },
  { path: "tests/contexts/tools/domain/marketplace-catalog.unit.test.ts", lines: 403 },
  { path: "tests/contexts/tools/domain/profiles/kilo/kilo-hooks-bridge.unit.test.ts", lines: 401 },
  {
    path: "tests/contexts/tools/domain/profiles/opencode/opencode-hooks-bridge.unit.test.ts",
    lines: 405,
  },
  { path: "tests/contexts/tools/hooks-runtime-bridges.integration.test.ts", lines: 417 },
  { path: "tests/contexts/tools/hooks-runtime.unit.test.ts", lines: 783 },
  {
    path: "tests/contexts/tools/infrastructure/host-plugin-registry-reader-adapter.integration.test.ts",
    lines: 469,
  },
  {
    path: "tests/contexts/translate/application/framework-build-use-case.integration.test.ts",
    lines: 597,
  },
  {
    path: "tests/contexts/translate/application/strategies/flat-build-strategy.integration.test.ts",
    lines: 809,
  },
  {
    path: "tests/contexts/translate/application/strategies/marketplace-build-strategy.codex.integration.test.ts",
    lines: 438,
  },
  {
    path: "tests/contexts/translate/application/strategies/marketplace-build-strategy.integration.test.ts",
    lines: 481,
  },
  { path: "tests/contexts/translate/domain/plugin-content-translator.unit.test.ts", lines: 794 },
  { path: "tests/e2e/framework-build.e2e.test.ts", lines: 684 },
  { path: "tests/e2e/kilo-runtime.e2e.test.ts", lines: 493 },
  { path: "tests/e2e/telemetry-journey.e2e.test.ts", lines: 575 },
  { path: "tests/golden/golden-baseline.e2e.test.ts", lines: 404 },
  { path: "tests/kernel/errors.unit.test.ts", lines: 638 },
  { path: "tests/kernel/source.unit.test.ts", lines: 435 },
  { path: "tests/presentation/commands/doctor-wiring.integration.test.ts", lines: 544 },
  { path: "tests/presentation/commands/framework-wiring.integration.test.ts", lines: 444 },
  { path: "tests/presentation/commands/marketplace-wiring.integration.test.ts", lines: 453 },
  { path: "tests/presentation/commands/plugin-wiring.integration.test.ts", lines: 408 },
  { path: "tests/presentation/commands/setup-wiring.integration.test.ts", lines: 409 },
  { path: "tests/presentation/commands/telemetry-wiring.integration.test.ts", lines: 649 },
  { path: "tests/presentation/prompts/interactive-menu-use-case.unit.test.ts", lines: 552 },
];

function testFiles(): string[] {
  return readdirSync(join(REPO_ROOT, "cli/tests"), { recursive: true, encoding: "utf8" })
    .map((entry) => `tests/${entry.replaceAll("\\", "/")}`)
    .filter((path) => path.endsWith(".test.ts"))
    .sort();
}

function linesOf(path: string): number {
  return (read(path).match(/\n/g) ?? []).length;
}

function filesOverLimit(paths: readonly string[], measure: (path: string) => number): string[] {
  return paths.filter((path) => measure(path) > MAX_LINES_PER_TEST_FILE);
}

describe("test files stay small enough to hold in mind", () => {
  it("no test file carries more than four hundred lines", () => {
    const { added, fixed } = expectRatchet(
      filesOverLimit(testFiles(), linesOf),
      BASELINE.map((entry) => entry.path)
    );

    expect(added, "a test file past the size limit — split it by behaviour").toEqual([]);
    expect(fixed, "under the limit now — remove these from BASELINE").toEqual([]);
  });

  it("holds each baseline entry to the count it was recorded at", () => {
    const recorded = BASELINE.map(({ path, lines }) => `${path}: ${lines}`);
    const actual = BASELINE.map(({ path }) => `${path}: ${linesOf(path)}`);

    expect(actual, "a baseline count drifted from the tree — fix the number").toEqual(recorded);
  });
});

describe("the guard itself", () => {
  it("names a file one line past the limit, not one on it", () => {
    const lines: Record<string, number> = { "tests/a.test.ts": 401, "tests/b.test.ts": 400 };
    const over = filesOverLimit(Object.keys(lines), (path) => lines[path] ?? 0);

    expect(over).toEqual(["tests/a.test.ts"]);
    expect(expectRatchet(over, []).added).toEqual(["tests/a.test.ts"]);
  });
});
