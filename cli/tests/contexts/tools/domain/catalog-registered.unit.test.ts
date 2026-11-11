import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hasRules } from "../../../../src/contexts/tools/domain/contracts.js";
import { REGISTERED_PROFILES } from "../../../../src/contexts/tools/domain/profiles/registered-profiles.js";
import { isAiTool, ToolCatalog } from "../../../../src/contexts/tools/domain/registry.js";
import { distributionProbesOf } from "../../../../src/contexts/translate/domain/plugin-format.js";
import { AI_TOOL_IDS } from "../../../../src/kernel/tool.js";

const NO_ENV = () => undefined;

function registered(): ToolCatalog {
  return new ToolCatalog(REGISTERED_PROFILES);
}

describe("what the registered profiles answer", () => {
  it("builds opencode flat and claude as a marketplace", () => {
    expect(registered().frameworkBuildModeFor("opencode")).toBe("flat");
    expect(registered().frameworkBuildModeFor("claude")).toBe("marketplace");
  });

  it("keeps claude's machine-local file, and every one inside its tool's directory", () => {
    expect(registered().machineLocalFilesOf("claude")).toEqual([".claude/settings.local.json"]);
    for (const toolId of AI_TOOL_IDS) {
      const profile = registered().getAiToolConfig(toolId);
      for (const path of registered().machineLocalFilesOf(toolId)) {
        expect(path.startsWith(profile.directory), `${toolId}: ${path}`).toBe(true);
      }
    }
  });

  it("keeps cursor's project hooks file out of the machine-local files", () => {
    expect(registered().machineLocalFilesOf("cursor")).not.toContain(".cursor/hooks.json");
  });

  it("names claude's user settings file under the home directory, and none for cursor", () => {
    expect(registered().userMachineLocalFilesOf("claude", "/home/tester", NO_ENV)).toEqual([
      join("/home/tester", ".claude", "settings.json"),
    ]);
    expect(registered().userMachineLocalFilesOf("cursor", "/home/tester", NO_ENV)).toEqual([]);
  });

  it("names the project hooks file of cursor and antigravity, and none for claude", () => {
    expect(registered().projectHooksFileOf("cursor")).toBe(".cursor/hooks.json");
    expect(registered().projectHooksFileOf("antigravity")).toBe(".agents/hooks.json");
    expect(registered().projectHooksFileOf("claude")).toBeUndefined();
  });

  it("makes plugin enablement machine-global for codex, copilot and cursor, and not for claude", () => {
    for (const toolId of ["codex", "copilot", "cursor"] as const) {
      expect(registered().pluginEnablementIsMachineGlobal(toolId), toolId).toBe(true);
    }
    expect(registered().pluginEnablementIsMachineGlobal("claude")).toBe(false);
  });

  it("takes a disabled host ref for a plugin in use everywhere but copilot", () => {
    expect(registered().hostRefInUse("copilot", false)).toBe(false);
    expect(registered().hostRefInUse("claude", false)).toBe(true);
    expect(registered().hostRefInUse("copilot", true)).toBe(true);
  });

  it("probes a marketplace for kilo and opencode, which build none natively", () => {
    const probed = distributionProbesOf(
      new Map(REGISTERED_PROFILES.flatMap((p) => (isAiTool(p) ? [[p.toolId, p] as const] : []))),
      "marketplace"
    ).map((probe) => probe.format);

    expect(probed).toContain("kilo");
    expect(probed).toContain("opencode");
  });

  // Pinned as a table so a tool whose install path moves fails here instead of drifting from
  // the installer quietly.
  it("answers the directory and extension each tool installs its rules into", () => {
    const expected = {
      antigravity: null,
      claude: { directory: ".claude/rules/", extension: ".md" },
      codex: { directory: ".codex/rules/", extension: ".md" },
      copilot: { directory: ".github/instructions/", extension: ".instructions.md" },
      cursor: { directory: ".cursor/rules/", extension: ".mdc" },
      kilo: { directory: ".kilo/rules/", extension: ".md" },
      opencode: { directory: ".opencode/rules/", extension: ".md" },
    };

    const answered = Object.fromEntries(
      AI_TOOL_IDS.map((id) => {
        const tool = registered().getAiToolConfig(id);
        const rules = hasRules(tool) ? tool.capabilities.rules : undefined;
        return [id, rules?.installedLocation() ?? null];
      })
    );

    expect(answered).toEqual(expected);
  });
});
