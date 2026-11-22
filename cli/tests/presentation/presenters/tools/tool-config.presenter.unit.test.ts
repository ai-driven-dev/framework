import { describe, expect, it } from "vitest";
import {
  printToolAlreadyInstalled,
  printToolInstalled,
  printToolRemoved,
  printUpdateResult,
} from "../../../../src/presentation/presenters/tools/tool-config.presenter.js";
import { CapturingOutput } from "../../../shared/testing/capturing-output.fake.js";
import {
  SECOND_SYNTHETIC_TOOL,
  SYNTHETIC_TOOL,
} from "../../../shared/testing/synthetic-tool-id.builder.js";

describe("printToolAlreadyInstalled", () => {
  it("warns that the tool is there and names the flag that reinstalls it", () => {
    const output = new CapturingOutput(false);

    printToolAlreadyInstalled(output, SYNTHETIC_TOOL);

    expect(output.at("warn")).toEqual([
      "synthetic is already installed. Use `--force` to reinstall.",
    ]);
  });
});

describe("printToolInstalled", () => {
  it("announces the tool and its file count when nothing warned", () => {
    const output = new CapturingOutput(false);

    printToolInstalled(output, { toolId: SECOND_SYNTHETIC_TOOL, fileCount: 12, warnings: [] });

    expect(output.at("success")).toEqual(["Installed syntheticb (12 files)"]);
  });

  it("puts every warning before the success line, in the order given", () => {
    const output = new CapturingOutput(false);

    printToolInstalled(output, {
      toolId: SYNTHETIC_TOOL,
      fileCount: 3,
      warnings: ["first", "second"],
    });

    expect(output.captured).toEqual([
      { level: "warn", message: "first" },
      { level: "warn", message: "second" },
      { level: "success", message: "Installed synthetic (3 files)" },
    ]);
  });
});

describe("printToolRemoved", () => {
  it("announces the tool and how many files went with it", () => {
    const output = new CapturingOutput(false);

    printToolRemoved(output, SYNTHETIC_TOOL, 7);

    expect(output.at("success")).toEqual(["Removed synthetic (7 files removed)"]);
  });
});

describe("printUpdateResult", () => {
  it("says no tool is installed when there is neither an update nor an error", () => {
    const output = new CapturingOutput(false);

    printUpdateResult(output, [], []);

    expect(output.captured).toEqual([{ level: "info", message: "No tools installed." }]);
  });

  it("prints one success per updated tool, then every error", () => {
    const output = new CapturingOutput(false);

    printUpdateResult(
      output,
      [
        { toolId: SYNTHETIC_TOOL, fileCount: 4 },
        { toolId: SECOND_SYNTHETIC_TOOL, fileCount: 1 },
      ],
      [{ scope: SYNTHETIC_TOOL, error: "binary missing" }]
    );

    expect(output.captured).toEqual([
      { level: "success", message: "Updated synthetic (4 files)" },
      { level: "success", message: "Updated syntheticb (1 files)" },
      { level: "warn", message: "[synthetic] binary missing" },
    ]);
  });

  it("stays silent about missing tools once an update alone came back", () => {
    const output = new CapturingOutput(false);

    printUpdateResult(output, [{ toolId: SYNTHETIC_TOOL, fileCount: 2 }], []);

    expect(output.captured).toEqual([{ level: "success", message: "Updated synthetic (2 files)" }]);
  });

  it("stays silent about missing tools once an error alone came back", () => {
    const output = new CapturingOutput(false);

    printUpdateResult(output, [], [{ scope: "synthetic", error: "refused" }]);

    expect(output.captured).toEqual([{ level: "warn", message: "[synthetic] refused" }]);
  });
});
