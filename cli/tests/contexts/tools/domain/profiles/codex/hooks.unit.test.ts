import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCodexFlatContract } from "../../../../../../src/contexts/tools/domain/profiles/codex/build.js";
import { codex } from "../../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import { REPOSITORY_ROOT } from "../../../../../helpers/repository-root.js";

describe("codex hooks", () => {
  describe("capabilities.hooks", () => {
    it("outputs to .codex/hooks.json", () => {
      expect(codex.capabilities.hooks.buildOutputPath()).toBe(".codex/hooks.json");
    });

    it("consumes the codex-hooks config name", () => {
      expect(codex.capabilities.hooks.consumes).toContain("codex-hooks");
    });

    it("uses user-prime merge strategy", () => {
      expect(codex.capabilities.hooks.getMergeStrategy()).toBe("user-prime");
    });

    it("uses SessionStart as entry section", () => {
      expect(codex.capabilities.hooks.getEntrySection()).toBe("SessionStart");
    });

    it("returns null entry section for unknown config names", () => {
      const cap = [codex.capabilities.mcp, codex.capabilities.hooks].find((c) =>
        c.consumes.includes("unknown")
      );
      expect(cap).toBeUndefined();
    });
  });
});

describe("the telemetry plugin's hooks on both Codex routes", () => {
  // biome-ignore lint/suspicious/noTemplateCurlyInString: the placeholder a plugin's hooks name
  const ROOT = "${CLAUDE_PLUGIN_ROOT}";

  it("writes the same entries as the plugin tree, so one trust review covers both", () => {
    const shipped = readFileSync(
      join(REPOSITORY_ROOT, "plugins", "aidd-telemetry", "hooks", "hooks.json"),
      "utf8"
    );
    const hooks = buildCodexFlatContract().artifacts.hooks;
    if (!hooks.supported || hooks.hooksFile === undefined) throw new Error("no hooks file");
    const merged = hooks.hooksFile.merge(null, shipped, "aidd-telemetry", (path) => path).content;

    expect(JSON.parse(merged)).toStrictEqual(
      JSON.parse(shipped.replaceAll(`${ROOT}/hooks/`, "./.codex/hooks/aidd-telemetry/"))
    );
  });
});

describe("the Codex flat hooks file", () => {
  // biome-ignore lint/suspicious/noTemplateCurlyInString: the placeholder a plugin's hooks name
  const ROOT = "${CLAUDE_PLUGIN_ROOT}";

  it("keeps only the items that run a command, and skips a group that lists none", () => {
    const shipped = JSON.stringify({
      hooks: {
        Stop: [
          { matcher: "x" },
          {
            hooks: [{ type: "prompt", prompt: "check" }, { command: `node ${ROOT}/hooks/a.cjs` }],
          },
        ],
      },
    });
    const hooks = buildCodexFlatContract().artifacts.hooks;
    if (!hooks.supported || hooks.hooksFile === undefined) throw new Error("no hooks file");

    expect(
      JSON.parse(hooks.hooksFile.merge(null, shipped, "p", (path) => path).content)
    ).toStrictEqual({
      hooks: { Stop: [{ hooks: [{ command: "node ./.codex/hooks/p/a.cjs", type: "command" }] }] },
    });
  });
});
