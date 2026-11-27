import { describe, expect, it } from "vitest";
import { translateBuildLayout } from "../../../../shared/testing/build-files.builder.js";
import { present } from "../../../../shared/testing/present.builder.js";
import { aCanon } from "../../testing/canon-distribution.builder.js";
import { translator } from "../../testing/engine-kit.builder.js";
import { codex } from "../../testing/registered-profiles.builder.js";

const SCOPED = '---\ndescription: "TypeScript"\npaths:\n  - "**/*.ts"\n---\n# TypeScript\n';

function marketplaceBuilt(files: Record<string, string>): Record<string, string> {
  const written = translateBuildLayout(
    aCanon("aidd-craft", files),
    present(codex.buildContracts.marketplace)(),
    "marketplace"
  );
  return Object.fromEntries(written.map((file) => [file.relativePath, file.content]));
}

describe("the marketplace layout of a plugin's rules for a tool listing them in AGENTS.md", () => {
  it("places each rule inside the plugin's output where the flat build places it, scope stated in the body", () => {
    expect(marketplaceBuilt({ "rules/01-standards/2-ts.md": SCOPED })).toEqual({
      "plugins/aidd-craft/.codex/instructions/aidd-craft-01-standards-2-ts.md":
        "Applies to files matching `**/*.ts`.\n\n# TypeScript\n",
    });
  });
});

describe("the install of a plugin's rules for a tool listing them in AGENTS.md", () => {
  it("places each rule at the project path the flat build uses, with the bytes its own build carries", () => {
    const canon = aCanon("aidd-craft", { "rules/01-standards/2-ts.md": SCOPED });

    const installed = Object.fromEntries(
      translator.translate(canon, codex).map((file) => [file.relativePath, file.content])
    );

    expect(installed).toEqual({
      ".codex/instructions/aidd-craft-01-standards-2-ts.md": marketplaceBuilt({
        "rules/01-standards/2-ts.md": SCOPED,
      })["plugins/aidd-craft/.codex/instructions/aidd-craft-01-standards-2-ts.md"],
    });
  });
});
