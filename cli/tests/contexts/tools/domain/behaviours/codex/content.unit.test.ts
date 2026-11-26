import { describe, expect, it } from "vitest";
import { codexSpec } from "../../../../../../src/composition/tool-profiles/codex.js";
import { defineAiTool } from "../../../../../../src/contexts/tools/domain/profile/define-tool.js";
import { SmolTomlCodec } from "../../../../../../src/contexts/tools/infrastructure/smol-toml-codec.adapter.js";
import { applyLinkSyntax } from "../../../../../../src/shared/domain/materialization/link-syntax.js";

const rewriteCodexContent = (text: string) =>
  applyLinkSyntax(text, defineAiTool(codexSpec, { toml: new SmolTomlCodec() }).linkSyntax);

describe("codex link syntax", () => {
  it("sends a skill reference to the agents directory Codex scans, under its aidd- prefix", () => {
    expect(rewriteCodexContent("Read .codex/skills/01-plan/SKILL.md\n")).toBe(
      "Read .agents/skills/aidd-01-plan/SKILL.md\n"
    );
  });
});
