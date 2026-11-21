/**
 * A `.golden.test.ts` file compares an output to a versioned snapshot through `expectGolden`;
 * the suffix names the level and must not lie. The golden files that assert inline instead are
 * listed and may not grow; one that moves to `expectGolden` or drops the suffix must come off
 * the list, so it only ever gets shorter.
 */
import { describe, expect, it } from "vitest";
import { read, tsFilesUnder } from "./source-graph.js";

/** Golden files with no `expectGolden` call today. */
const INLINE_GOLDEN_TESTS: readonly string[] = [
  "tests/presentation/errors/catalog-error-messages.presenter.golden.test.ts",
  "tests/presentation/errors/core-error-messages.presenter.golden.test.ts",
  "tests/presentation/errors/describe-message.presenter.golden.test.ts",
  "tests/presentation/errors/error-messages.presenter.golden.test.ts",
  "tests/presentation/errors/error-translator.presenter.golden.test.ts",
  "tests/presentation/errors/installation-error-messages.presenter.golden.test.ts",
  "tests/presentation/presenters/agent-models.presenter.golden.test.ts",
  "tests/presentation/presenters/auth.presenter.golden.test.ts",
  "tests/presentation/presenters/clean.presenter.golden.test.ts",
  "tests/presentation/presenters/doctor.presenter.golden.test.ts",
  "tests/presentation/presenters/installed-rules.presenter.golden.test.ts",
  "tests/presentation/presenters/marketplace.presenter.golden.test.ts",
  "tests/presentation/presenters/menu.presenter.golden.test.ts",
  "tests/presentation/presenters/plugin.presenter.golden.test.ts",
  "tests/presentation/presenters/restore.presenter.golden.test.ts",
  "tests/presentation/presenters/setup.presenter.golden.test.ts",
  "tests/presentation/presenters/status.presenter.golden.test.ts",
  "tests/presentation/presenters/sync.presenter.golden.test.ts",
  "tests/presentation/presenters/telemetry/telemetry-identity.presenter.golden.test.ts",
  "tests/presentation/presenters/telemetry/telemetry-lifecycle.presenter.golden.test.ts",
  "tests/presentation/presenters/telemetry/telemetry-read.presenter.golden.test.ts",
  "tests/presentation/presenters/telemetry/telemetry-report-table.presenter.golden.test.ts",
  "tests/presentation/presenters/telemetry/telemetry-report.presenter.golden.test.ts",
  "tests/presentation/presenters/telemetry/telemetry-task.presenter.golden.test.ts",
  "tests/presentation/presenters/tool-config.presenter.golden.test.ts",
  "tests/presentation/presenters/tool-config.presenter.recipes.golden.test.ts",
  "tests/presentation/presenters/translate.presenter.golden.test.ts",
  "tests/presentation/presenters/update.presenter.golden.test.ts",
];

describe("golden tests", () => {
  it("holds every golden file to a snapshot comparison, or to the list written down for it", () => {
    const inline = tsFilesUnder("tests").filter(
      (file) => file.endsWith(".golden.test.ts") && !read(file).includes("expectGolden(")
    );

    expect(inline).toEqual(INLINE_GOLDEN_TESTS);
  });
});
