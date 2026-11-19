import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseSourceFlag, parseToolIds } from "../../../src/presentation/commands/setup.js";
import { catalogOf, registeredCatalog } from "../../contexts/tools/testing/catalog-of.js";
import { CapturingOutput } from "../../shared/testing/capturing-output.js";

function refuseByThrowing() {
  return vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("process.exit");
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseSourceFlag", () => {
  it("chooses no source at all when --source was not given", () => {
    const output = new CapturingOutput(false);

    expect(parseSourceFlag({}, output)).toBeUndefined();
  });

  it("carries the release tag into a remote source", () => {
    const output = new CapturingOutput(false);

    const source = parseSourceFlag({ source: "remote", release: "v1.2.3" }, output);

    expect(source).toMatchObject({ kind: "github", ref: "v1.2.3" });
  });

  it("resolves a local source's path against the working directory", () => {
    const output = new CapturingOutput(false);

    const source = parseSourceFlag({ source: "local", path: "./framework" }, output);

    expect(source).toMatchObject({ kind: "local", path: resolve("./framework") });
  });

  it("refuses a local source with no --path, naming the flag it needs", () => {
    const output = new CapturingOutput(false);
    const exit = refuseByThrowing();

    expect(() => parseSourceFlag({ source: "local" }, output)).toThrow("process.exit");

    expect(output.at("error")).toEqual(["--source local requires --path <dir>"]);
    expect(exit).toHaveBeenCalledWith(1);
  });
});

describe("parseToolIds", () => {
  it("selects no tool at all when neither category was given", () => {
    expect(parseToolIds({}, new CapturingOutput(false), registeredCatalog())).toEqual({
      aiTools: [],
      ideTools: [],
    });
  });

  it("splits the ids given per category", () => {
    expect(
      parseToolIds({ ai: "claude", ide: "vscode" }, new CapturingOutput(false), registeredCatalog())
    ).toEqual({
      aiTools: ["claude"],
      ideTools: ["vscode"],
    });
  });

  it("refuses an id belonging to the other category, and an unknown one with it", () => {
    const output = new CapturingOutput(false);
    const exit = refuseByThrowing();

    expect(() => parseToolIds({ ai: "vscode,nope" }, output, registeredCatalog())).toThrow(
      "process.exit"
    );

    expect(exit).toHaveBeenCalledWith(1);
    expect(output.at("error")).toEqual([
      "vscode, nope are not AI tools. Valid AI tools: claude, cursor, copilot, opencode, kilo, codex, antigravity",
    ]);
  });

  it("files every id --ide names under the list its category decides", () => {
    expect(
      parseToolIds(
        { ide: "claude,vscode", ai: "codex" },
        new CapturingOutput(false),
        registeredCatalog()
      )
    ).toStrictEqual({
      aiTools: ["codex", "claude"],
      ideTools: ["vscode"],
    });
  });

  it("accepts 'all' without checking it against the category", () => {
    expect(parseToolIds({ ai: "all" }, new CapturingOutput(false), registeredCatalog())).toEqual({
      aiTools: [...catalogOf().idsInCanonicalOrder("ai")],
      ideTools: [],
    });
  });
});
