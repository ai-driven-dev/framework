import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCodexFlatContract } from "../../../../../../src/contexts/tools/domain/profiles/codex/build.js";
import { codexProfile } from "../../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import { SmolTomlCodec } from "../../../../../../src/contexts/tools/infrastructure/smol-toml-codec.adapter.js";
import { REPOSITORY_ROOT } from "../../../../../shared/testing/repository-root.builder.js";

const TOML = new SmolTomlCodec();
const codex = codexProfile(TOML);

describe("codex hooks", () => {
  describe("capabilities.hooks", () => {
    it("outputs to .codex/hooks.json", () => {
      expect(codex.section("hooks").config?.outputPath()).toBe(".codex/hooks.json");
    });

    it("consumes the codex-hooks config name", () => {
      expect(codex.section("hooks").config?.consumes("codex-hooks")).toBe(true);
    });

    it("uses user-prime merge strategy", () => {
      expect(codex.section("hooks").config?.mergeStrategy()).toBe("user-prime");
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
    const hooks = buildCodexFlatContract(TOML).artifacts.hooks;
    if (!hooks.supported || hooks.hooksFile === undefined) throw new Error("no hooks file");
    const merged = hooks.hooksFile.merge(null, {
      json: shipped,
      plugin: "aidd-telemetry",
      locate: (path) => path,
    }).content;

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
    const hooks = buildCodexFlatContract(TOML).artifacts.hooks;
    if (!hooks.supported || hooks.hooksFile === undefined) throw new Error("no hooks file");

    expect(
      JSON.parse(
        hooks.hooksFile.merge(null, { json: shipped, plugin: "p", locate: (path) => path }).content
      )
    ).toStrictEqual({
      hooks: { Stop: [{ hooks: [{ command: "node ./.codex/hooks/p/a.cjs", type: "command" }] }] },
    });
  });
});
