import { describe, expect, it } from "vitest";
import { codexSpec } from "../../../src/composition/tool-profiles/codex.js";
import { artifactPath } from "../../../src/contexts/tools/contract/artifact-path.js";
import { defineAiTool } from "../../../src/contexts/tools/domain/profile/define-tool.js";
import { SmolTomlCodec } from "../../../src/contexts/tools/infrastructure/smol-toml-codec.adapter.js";
import {
  PLUGIN_TREE_SOURCES,
  supported,
} from "../../contexts/tools/testing/build-artifacts.builder.js";
import {
  contractOf,
  marketplaceSourcesOf,
} from "../../contexts/tools/testing/profile-tables.builder.js";
import { type InstallKind, installPathOf } from "../../contexts/tools/testing/profiles.builder.js";

const codex = defineAiTool(codexSpec, { toml: new SmolTomlCodec() });

describe("codex profile", () => {
  it("declares its directory, tool suffix, signal directory and the one config file it reads", () => {
    expect(codex.directory).toBe(".codex/");
    expect(codex.toolSuffix).toBe(".codex.md");
    expect(codex.signalDir).toBe(".codex/commands");
    expect(codex.configFiles()).toStrictEqual({ "config.toml": ".codex/config.toml" });
  });

  it.each<[InstallKind, string, string]>([
    ["agents", "alexia.md", ".codex/agents/alexia.toml"],
    ["rules", "01-standards/naming.codex.md", ".codex/rules/01-standards/naming.md"],
    ["commands", "04_code/implement.md", ".codex/commands/aidd/04/implement.md"],
    ["commands", "commit.md", ".codex/commands/aidd/commit.md"],
  ])("installs %s file %s at %s", (kind, built, path) => {
    expect(installPathOf(codex, kind, built)).toBe(path);
  });
});

describe("codex build and conversion tables", () => {
  it("sources the plugin tree as it ships, and stages an agent named with an inner .md as .toml", () => {
    expect(marketplaceSourcesOf(codex)).toStrictEqual(PLUGIN_TREE_SOURCES);
    expect(
      artifactPath(
        supported(contractOf(codex, "marketplace").artifacts.agents),
        "aidd-dev",
        "agents/notes.md-helper.md"
      )
    ).toBe("codex-agents/notes.md-helper.toml");
  });
});
