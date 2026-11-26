import { describe, expect, it } from "vitest";
import { kilo as kiloTool } from "../../../../../src/composition/tool-profiles/kilo.js";
import { opencode as opencodeTool } from "../../../../../src/composition/tool-profiles/opencode.js";
import { translateBuildLayout } from "../../../../shared/testing/build-files.builder.js";
import { present } from "../../../../shared/testing/present.builder.js";
import { aCanon } from "../../testing/canon-distribution.builder.js";
import { CLAUDE_ROOT_TOKEN, translator } from "../../testing/engine-kit.builder.js";
import { opencode } from "../../testing/registered-profiles.builder.js";

const COMMAND = [
  "---",
  "name: aidd:04:implement",
  "description: Implement a feature.",
  "---",
  "",
  `Read @${CLAUDE_ROOT_TOKEN}/skills/commit/SKILL.md first.`,
  "",
].join("\n");

const FILES = {
  "commands/04_code/implement.md": COMMAND,
  "skills/commit/SKILL.md": "---\nname: commit\ndescription: Commit.\n---\n# Commit\n",
};

function built(plugin: string, files: Record<string, string>, tool = opencodeTool) {
  const written = translateBuildLayout(
    aCanon(plugin, files),
    present(tool.buildContracts.flat)(),
    "flat"
  );
  return Object.fromEntries(written.map((file) => [file.relativePath, file.content]));
}

describe("the commands of a flat build for OpenCode", () => {
  it("lands a command in a folder of its plugin's name, named by its plugin", () => {
    const files = built("aidd-craft", FILES);

    expect(files[".opencode/commands/aidd-craft/implement.md"]).toContain(
      "name: 'aidd-aidd-craft:implement'"
    );
  });

  it("writes the same bytes at the same path as an install of the same commands", () => {
    const installed = Object.fromEntries(
      translator
        .translate(aCanon("aidd-craft", FILES), opencode)
        .map((file) => [file.relativePath, file.content])
    );

    expect(built("aidd-craft", FILES)).toEqual(installed);
  });

  it("keeps two plugins' commands of one file name apart", () => {
    const paths = ["aidd-one", "aidd-two"].flatMap((plugin) =>
      Object.keys(built(plugin, FILES)).filter((path) => path.includes("/commands/"))
    );

    expect(paths).toEqual([
      ".opencode/commands/aidd-one/implement.md",
      ".opencode/commands/aidd-two/implement.md",
    ]);
  });

  it("resolves a link to a skill to where the skill lands, relative to the command", () => {
    const files = built("aidd-craft", FILES);

    expect(files[".opencode/commands/aidd-craft/implement.md"]).toContain(
      "[SKILL.md](../../skills/aidd-craft/commit/SKILL.md)"
    );
  });

  it("resolves a skill's link to a command to where the command lands", () => {
    const files = built("aidd-craft", {
      ...FILES,
      "skills/commit/SKILL.md": `---\nname: commit\n---\nRun @${CLAUDE_ROOT_TOKEN}/commands/04_code/implement.md\n`,
    });

    expect(files[".opencode/skills/aidd-craft/commit/SKILL.md"]).toContain(
      "[implement.md](../../../commands/aidd-craft/implement.md)"
    );
  });
});

describe("the commands of a flat build for a tool that carries none", () => {
  it("writes none", () => {
    const files = built("aidd-craft", FILES, kiloTool);

    expect(Object.keys(files).filter((path) => path.includes("commands/"))).toEqual([]);
  });
});
