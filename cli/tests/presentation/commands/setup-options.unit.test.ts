import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  expandAllKeyword,
  parsePluginsFlag,
  parseSourceFlag,
  parseToolIds,
  requireAgentHosts,
} from "../../../src/presentation/commands/setup.js";
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

  it("expands --ai all into every AI tool and no IDE tool", () => {
    expect(parseToolIds({ ai: "all" }, new CapturingOutput(false), registeredCatalog())).toEqual({
      aiTools: [...catalogOf().idsInCanonicalOrder("ai")],
      ideTools: [],
    });
  });
});

describe("expandAllKeyword", () => {
  it("selects nothing when the flag was not given", () => {
    expect(expandAllKeyword(undefined, catalogOf().idsInCanonicalOrder("ai"))).toEqual([]);
  });

  it("expands 'all' into every id of that category, spacing and all", () => {
    expect(expandAllKeyword("all", catalogOf().idsInCanonicalOrder("ide"))).toEqual([
      ...catalogOf().idsInCanonicalOrder("ide"),
    ]);
    expect(expandAllKeyword("  all  ", catalogOf().idsInCanonicalOrder("ide"))).toEqual([
      ...catalogOf().idsInCanonicalOrder("ide"),
    ]);
  });

  it("splits a comma-separated list, dropping the spacing and the empty entries", () => {
    expect(expandAllKeyword(" claude , , cursor ", catalogOf().idsInCanonicalOrder("ai"))).toEqual([
      "claude",
      "cursor",
    ]);
  });
});

describe("parsePluginsFlag", () => {
  it("asks on a terminal when --plugins was not given", () => {
    expect(parsePluginsFlag(undefined, true)).toEqual({ mode: "interactive", names: [] });
  });

  it("installs nothing off a terminal when --plugins was not given", () => {
    expect(parsePluginsFlag(undefined, false)).toEqual({ mode: "none", names: [] });
  });

  it("reads each of the three keywords as its own mode, spacing and all", () => {
    expect(parsePluginsFlag("  none  ", true)).toEqual({ mode: "none", names: [] });
    expect(parsePluginsFlag("all", true)).toEqual({ mode: "all", names: [] });
    expect(parsePluginsFlag("recommended", true)).toEqual({ mode: "recommended", names: [] });
  });

  it("reads anything else as the names to install", () => {
    expect(parsePluginsFlag(" aidd-dev , aidd-pm ,", true)).toEqual({
      mode: "named",
      names: ["aidd-dev", "aidd-pm"],
    });
  });
});

describe("requireAgentHosts", () => {
  it("asks for an --ide tool that runs the agents when none was given", () => {
    expect(() => requireAgentHosts("openai", { hosts: [], runnable: ["claude", "codex"] })).toThrow(
      "--provider needs --ide with a tool that runs the framework's agents: claude, codex."
    );
  });

  it("lets a run with no provider, or a tool that runs the agents, through", () => {
    expect(() => requireAgentHosts(undefined, { hosts: [], runnable: ["claude"] })).not.toThrow();
    expect(() =>
      requireAgentHosts("openai", { hosts: ["claude"], runnable: ["claude"] })
    ).not.toThrow();
  });
});
