import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  expandAllKeyword,
  parsePluginsFlag,
  parseSourceFlag,
  parseToolIds,
  requireAgentHosts,
} from "../../../../src/presentation/controllers/setup/setup-flags.controller.js";
import { CapturingOutput, ExitRequested } from "../../../shared/testing/capturing-output.fake.js";
import {
  SECOND_SYNTHETIC_TOOL,
  SYNTHETIC_IDE_TOOL,
  SYNTHETIC_TOOL,
  syntheticMixedCatalog,
} from "../../../shared/testing/synthetic-tool-id.builder.js";

describe("reading the --source flag", () => {
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

    expect(() => parseSourceFlag({ source: "local" }, output)).toThrow(new ExitRequested(1));

    expect(output.at("error")).toEqual(["--source local requires --path <dir>"]);
  });
});

describe("reading the tool id flags", () => {
  it("selects no tool at all when neither category was given", () => {
    expect(parseToolIds({}, syntheticMixedCatalog())).toEqual({
      aiTools: [],
      ideTools: [],
    });
  });

  it("splits the ids given per category", () => {
    expect(
      parseToolIds({ ai: SYNTHETIC_TOOL, ide: SYNTHETIC_IDE_TOOL }, syntheticMixedCatalog())
    ).toEqual({
      aiTools: [SYNTHETIC_TOOL],
      ideTools: [SYNTHETIC_IDE_TOOL],
    });
  });

  it("expands --ai all into every AI tool and no IDE tool", () => {
    expect(parseToolIds({ ai: "all" }, syntheticMixedCatalog())).toEqual({
      aiTools: [...syntheticMixedCatalog().idsInCanonicalOrder("ai")],
      ideTools: [],
    });
  });
});

describe("expanding the all keyword", () => {
  it("selects nothing when the flag was not given", () => {
    expect(expandAllKeyword(undefined, syntheticMixedCatalog().idsInCanonicalOrder("ai"))).toEqual(
      []
    );
  });

  it("expands 'all' into every id of that category, spacing and all", () => {
    expect(expandAllKeyword("all", syntheticMixedCatalog().idsInCanonicalOrder("ide"))).toEqual([
      ...syntheticMixedCatalog().idsInCanonicalOrder("ide"),
    ]);
    expect(expandAllKeyword("  all  ", syntheticMixedCatalog().idsInCanonicalOrder("ide"))).toEqual(
      [...syntheticMixedCatalog().idsInCanonicalOrder("ide")]
    );
  });

  it("splits a comma-separated list, dropping the spacing and the empty entries", () => {
    expect(
      expandAllKeyword(
        ` ${SYNTHETIC_TOOL} , , ${SECOND_SYNTHETIC_TOOL} `,
        syntheticMixedCatalog().idsInCanonicalOrder("ai")
      )
    ).toEqual([SYNTHETIC_TOOL, SECOND_SYNTHETIC_TOOL]);
  });
});

describe("reading the --plugins flag", () => {
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

describe("requiring a host that runs the agents", () => {
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
