import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detectToolSignals } from "../../../../src/contexts/installation/application/init-project.js";
import { InMemoryFileAdapter } from "../../../helpers/ports/index.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.js";

describe("a tool's own files as a signal it is in use", () => {
  it("answers nothing for a tool declaring no signal directory", async () => {
    const fs = new InMemoryFileAdapter({ "/p/.antigravity/commands/a.md": "name: aidd:x" });

    expect(
      await detectToolSignals(fs, registeredTools().aiProfile(TOOL.antigravity), "/p")
    ).toStrictEqual([]);
  });

  it("answers nothing when the signal directory does not exist", async () => {
    expect(
      await detectToolSignals(
        new InMemoryFileAdapter(),
        registeredTools().aiProfile(TOOL.cursor),
        "/p"
      )
    ).toStrictEqual([]);
  });

  it("names every markdown file whose frontmatter declares an aidd name, and only those", async () => {
    const fs = new InMemoryFileAdapter({
      "/p/.cursor/commands/colon.md": "---\nname: aidd:plan\n---",
      "/p/.cursor/commands/quoted.md": "---\nname: 'aidd_plan'\n---",
      "/p/.cursor/commands/tight.md": "name:aidd:plan",
      "/p/.cursor/commands/indented.md": "  name: aidd:plan",
      "/p/.cursor/commands/other.md": "name: mine",
      "/p/.cursor/commands/notes.txt": "name: aidd:plan",
    });

    expect(
      (await detectToolSignals(fs, registeredTools().aiProfile(TOOL.cursor), "/p")).sort()
    ).toStrictEqual(["colon.md", "quoted.md", "tight.md"].map((f) => join(".cursor/commands", f)));
  });

  it("reads the directory the profile names, not another tool's", async () => {
    const fs = new InMemoryFileAdapter({ "/p/.claude/commands/a.md": "name: aidd:x" });

    expect(
      await detectToolSignals(fs, registeredTools().aiProfile(TOOL.cursor), "/p")
    ).toStrictEqual([]);
    expect(
      await detectToolSignals(fs, registeredTools().aiProfile(TOOL.claude), "/p")
    ).toStrictEqual([join(".claude/commands", "a.md")]);
  });
});
