import { join } from "node:path";
import { describe, expect, it } from "vitest";
// Side-effect imports: registering every shipped tool is what makes this suite meaningful.
// A tool missing here would silently escape conformance, so the list must stay complete.
import "../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import "../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import "../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import "../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import "../../../../src/contexts/tools/domain/profiles/kilo/profile.js";
import "../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import "../../../../src/contexts/tools/domain/profiles/vscode/profile.js";
import type { ToolBuildContract } from "../../../../src/contexts/tools/domain/build-contract.js";
import type { AiTool } from "../../../../src/contexts/tools/domain/contracts.js";
import { hasRules } from "../../../../src/contexts/tools/domain/contracts.js";
import {
  frameworkBuildModeFor,
  getAllRegisteredTools,
  getToolConfig,
  isAiTool,
  machineLocalFilesOf,
  projectHooksFileOf,
  userMachineLocalFilesOf,
} from "../../../../src/contexts/tools/domain/registry.js";
import {
  buildTargetModesOf,
  frameworkBuildTargetModes,
} from "../../../../src/contexts/translate/domain/build-target.js";
import {
  distributionProbesOf,
  marketplaceProbes,
} from "../../../../src/contexts/translate/domain/plugin-format.js";
import { AI_TOOL_IDS, type ToolId } from "../../../../src/kernel/tool.js";

/** Every assertion iterates the registry rather than a hardcoded list, so adding a tool file
 * subjects it to all of them instead of letting it misbehave at runtime. */

const registeredAiTools: [string, AiTool<unknown>][] = [
  ...getAllRegisteredTools().entries(),
].flatMap(([id, config]) =>
  isAiTool(config) ? [[id as string, config] as [string, AiTool<unknown>]] : []
);

describe("AiTool contract conformance", () => {
  it("the registry actually contains tools (guards against a no-op suite)", () => {
    expect(registeredAiTools.length).toBeGreaterThan(0);
  });

  describe.each(registeredAiTools)("%s", (toolId, tool) => {
    it("has a well-formed AiTool shape", () => {
      expect(tool.kind, `${toolId}: kind must be "ai"`).toBe("ai");
      expect(tool.toolId, `${toolId}: toolId must match its registry key`).toBe(toolId);
      expect(
        typeof tool.directory === "string" && tool.directory.length > 0,
        `${toolId}: directory must be a non-empty string`
      ).toBe(true);
      expect(tool.directory.endsWith("/"), `${toolId}: directory must end with "/"`).toBe(true);
      expect(
        typeof tool.toolSuffix === "string" && tool.toolSuffix.startsWith("."),
        `${toolId}: toolSuffix must be a string starting with "."`
      ).toBe(true);
      expect(
        tool.signalDir === null || typeof tool.signalDir === "string",
        `${toolId}: signalDir must be a string or null`
      ).toBe(true);
      expect(
        typeof tool.capabilities === "object" && tool.capabilities !== null,
        `${toolId}: capabilities must be an object`
      ).toBe(true);
    });

    it("implements every required content method", () => {
      for (const method of ["rewriteContent"] as const) {
        expect(typeof tool[method], `${toolId}: ${method} must be a function`).toBe("function");
      }
    });

    it("is declared in AI_TOOL_IDS", () => {
      expect(
        (AI_TOOL_IDS as readonly string[]).includes(toolId),
        `${toolId} is registered but missing from AI_TOOL_IDS (kernel/tool.ts)`
      ).toBe(true);
    });

    it("is reachable by at least one framework build target/mode", () => {
      expect(
        frameworkBuildTargetModes().some((entry) => entry.target === toolId),
        `${toolId} is registered but declares no buildContracts — 'aidd translate --to ${toolId}' would be rejected`
      ).toBe(true);
    });

    it("is ingestible when it declares a plugins capability", () => {
      const declaresPlugins = "plugins" in (tool.capabilities as object);
      if (!declaresPlugins) return;
      expect(
        marketplaceProbes().some((probe) => probe.format === toolId),
        `${toolId} declares a plugins capability but its profile declares no marketplace probe — its native marketplace would never be detected`
      ).toBe(true);
    });

    // A project-local `marketplaceSettings` declaration was measured to load nothing in
    // Claude: the runtime reads its own user-global registry, which `nativeActivation` drives.
    it("drives native CLI activation when its plugins capability declares marketplaceSettings", () => {
      const caps = tool.capabilities as {
        plugins?: { marketplaceSettings?: unknown; nativeActivation?: unknown };
      };
      if (caps.plugins?.marketplaceSettings == null) return;
      expect(
        caps.plugins.nativeActivation,
        `${toolId} declares marketplaceSettings without nativeActivation — its settings.json declaration is never registered with the runtime that resolves plugins`
      ).not.toBeNull();
    });
  });
});

describe("no parallel list references an unregistered tool", () => {
  it("every AI_TOOL_IDS entry resolves to a registered AI tool", () => {
    for (const id of AI_TOOL_IDS) {
      const config = getToolConfig(id);
      expect(isAiTool(config), `AI_TOOL_IDS lists "${id}" but its config is not an AI tool`).toBe(
        true
      );
    }
  });
});

/** A real contract that builds nothing. `buildTargetModesOf` reads which keys a profile
 * declares, never what a contract holds, so the emptiest valid one says exactly that. */
const unsupportedContract: ToolBuildContract = {
  manifestFileRelative: null,
  synthesizeManifest: null,
  manifestSchemaName: null,
  artifacts: {
    skills: { supported: false },
    agents: { supported: false },
    mcp: { supported: false },
    hooks: { supported: false },
    rules: { supported: false },
    commands: { supported: false },
  },
  buildMarketplaceCatalog: null,
  buildMarketplaceEntry: null,
};

/** A profile reduced to the two fields each derivation reads. */
function fakeTool(overrides: Partial<AiTool<unknown>>): AiTool<unknown> {
  return {
    kind: "ai",
    toolId: "claude",
    displayName: "Fake",
    directory: ".fake/",
    toolSuffix: ".md",
    signalDir: null,
    capabilities: {},
    rewriteContent: (content) => content,
    ...overrides,
  };
}

function registryOf(...tools: AiTool<unknown>[]): ReadonlyMap<ToolId, AiTool<unknown>> {
  return new Map(tools.map((tool) => [tool.toolId, tool]));
}

describe("buildTargetModesOf()", () => {
  it("gives a tool one pair per contract it declares, and none for what it omits", () => {
    const contract = () => unsupportedContract;
    const modes = buildTargetModesOf(
      registryOf(
        fakeTool({ toolId: "claude", buildContracts: { marketplace: contract, flat: contract } }),
        fakeTool({ toolId: "opencode", buildContracts: { flat: contract } })
      )
    );
    expect(modes).toEqual([
      { target: "claude", mode: "marketplace" },
      { target: "claude", mode: "flat" },
      { target: "opencode", mode: "flat" },
    ]);
  });

  it("excludes a registered tool that declares no build contract at all", () => {
    expect(buildTargetModesOf(registryOf(fakeTool({ toolId: "cursor" })))).toEqual([]);
  });
});

describe("distributionProbesOf()", () => {
  // Order is behaviour: the reader takes the first probe that resolves, and a bare
  // `plugin.json` at the root is satisfied by almost any directory.
  it("puts the deepest path first and a bare filename last", () => {
    const probes = distributionProbesOf(
      registryOf(
        fakeTool({ toolId: "claude", distributionProbes: { manifest: ["plugin.json"] } }),
        fakeTool({
          toolId: "copilot",
          distributionProbes: { manifest: [".plugin/plugin.json", ".a/b/plugin.json"] },
        })
      ),
      "manifest"
    );
    expect(probes.map((probe) => probe.relativePath)).toEqual([
      ".a/b/plugin.json",
      ".plugin/plugin.json",
      "plugin.json",
    ]);
  });

  it("reads the kind it was asked for, and nothing from a profile that declares none", () => {
    const tools = registryOf(
      fakeTool({ toolId: "claude", distributionProbes: { marketplace: ["m.json"] } }),
      fakeTool({ toolId: "cursor" })
    );
    expect(distributionProbesOf(tools, "marketplace")).toEqual([
      { format: "claude", relativePath: "m.json" },
    ]);
    expect(distributionProbesOf(tools, "manifest")).toEqual([]);
  });
});

describe("frameworkBuildModeFor()", () => {
  it("gives a flat tool a flat build", () => {
    expect(frameworkBuildModeFor("opencode")).toBe("flat");
  });

  it("gives a native tool a marketplace build", () => {
    expect(frameworkBuildModeFor("claude")).toBe("marketplace");
  });

  it("reads every tool's mode from its profile, never from its name", () => {
    for (const toolId of AI_TOOL_IDS) {
      const config = getToolConfig(toolId);
      if (!isAiTool(config)) continue;
      const caps = config.capabilities as { plugins?: { mode?: string } };
      const expected = caps.plugins?.mode === "flat" ? "flat" : "marketplace";
      expect(frameworkBuildModeFor(toolId), toolId).toBe(expected);
    }
  });

  it("defaults an IDE tool with no plugins capability to marketplace", () => {
    // vscode is `kind: "ide"` and declares no `plugins` capability at all — the one
    // shipped tool that exercises the "no capability" branch, every AI tool declares one.
    expect(frameworkBuildModeFor("vscode")).toBe("marketplace");
  });
});

describe("machineLocalFilesOf()", () => {
  // `status` skips these files by comparing the path a profile declares against the one it
  // builds from the tool directory, so a path declared any other way stops being skipped.
  it("declares every machine-local file project-relative, inside its own tool directory", () => {
    for (const toolId of AI_TOOL_IDS) {
      const config = getToolConfig(toolId);
      if (!isAiTool(config)) continue;
      for (const relativePath of machineLocalFilesOf(toolId)) {
        expect(relativePath.startsWith(config.directory), `${toolId}: ${relativePath}`).toBe(true);
      }
    }
  });

  it("returns claude's .claude/settings.local.json", () => {
    expect(machineLocalFilesOf("claude")).toContain(".claude/settings.local.json");
  });

  // Its content is project-relative and shareable, unlike the absolute-path content this
  // function keeps out of the gitignore; `projectHooksFileOf` carries that file instead.
  it("does not carry cursor's project hooks file", () => {
    expect(machineLocalFilesOf("cursor")).not.toContain(".cursor/hooks.json");
  });
});

describe("userMachineLocalFilesOf()", () => {
  it("returns claude's user-scope settings file, absolute under the given homedir", () => {
    expect(userMachineLocalFilesOf("claude", "/home/tester", () => undefined)).toEqual([
      join("/home/tester", ".claude", "settings.json"),
    ]);
  });

  it("returns nothing for a tool whose profile declares no userSettingsPath", () => {
    expect(userMachineLocalFilesOf("cursor", "/home/tester", () => undefined)).toEqual([]);
  });
});

describe("projectHooksFileOf()", () => {
  it("returns .cursor/hooks.json for cursor", () => {
    expect(projectHooksFileOf("cursor")).toBe(".cursor/hooks.json");
  });

  it("returns undefined for a tool with nothing merged into a project hooks file", () => {
    expect(projectHooksFileOf("claude")).toBeUndefined();
  });
});

/** Pinned as a table rather than described, so a tool whose install path moves — or a sixth
 * tool added with rules — fails here instead of drifting away from the installer quietly. */
describe("every tool says where its own installed rules live", () => {
  const EXPECTED: Readonly<Record<string, { directory: string; extension: string }>> = {
    claude: { directory: ".claude/rules/", extension: ".md" },
    codex: { directory: ".codex/rules/", extension: ".md" },
    copilot: { directory: ".github/instructions/", extension: ".instructions.md" },
    cursor: { directory: ".cursor/rules/", extension: ".mdc" },
    kilo: { directory: ".kilo/rules/", extension: ".md" },
    opencode: { directory: ".opencode/rules/", extension: ".md" },
  };

  it("answers the directory and extension each one actually installs into", () => {
    const answered = Object.fromEntries(
      AI_TOOL_IDS.map((id) => {
        const tool = getToolConfig(id);
        const rules = isAiTool(tool) && hasRules(tool) ? tool.capabilities.rules : undefined;
        return [id, rules?.installedLocation() ?? null];
      })
    );

    expect(answered).toEqual(EXPECTED);
  });
});
