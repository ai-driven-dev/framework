import { describe, expect, it } from "vitest";
import { codexSpec } from "../../../../../../src/composition/tool-profiles/codex.js";
import { defineAiTool } from "../../../../../../src/contexts/tools/domain/profile/define-tool.js";
import { applyLinkSyntax } from "../../../../../../src/shared/domain/materialization/link-syntax.js";
import { SmolTomlCodec } from "../../../../../../src/shared/infrastructure/smol-toml-codec.adapter.js";

const rewriteCodexContent = (text: string) =>
  applyLinkSyntax(text, defineAiTool(codexSpec, { toml: new SmolTomlCodec() }).linkSyntax);

describe("codex link syntax", () => {
  it("sends a skill reference to the agents directory Codex scans, under its aidd- prefix", () => {
    expect(rewriteCodexContent("Read .codex/skills/01-plan/SKILL.md\n")).toBe(
      "Read .agents/skills/aidd-01-plan/SKILL.md\n"
    );
  });
});

describe("codex commands", () => {
  const profile = defineAiTool(codexSpec, { toml: new SmolTomlCodec() });

  it("declares no commands capability, since Codex reads no project command directory", () => {
    expect(profile.section("commands")).toBeNull();
  });

  it("keeps no signal directory, since no command file is ever written for it", () => {
    expect(profile.signalDirectoryIn("/project")).toBeNull();
  });
});
