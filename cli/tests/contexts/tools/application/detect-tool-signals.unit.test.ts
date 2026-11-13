import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detectToolSignals } from "../../../../src/contexts/tools/application/detect-tool-signals.js";
import type { ToolConfig } from "../../../../src/contexts/tools/domain/registry.js";
import { InMemoryFileAdapter } from "../../../helpers/ports/index.js";
import { aProfile } from "../testing/profiles.js";

describe("a tool's own files as a signal it is in use", () => {
  const cursor = (signalDir: string | null): ToolConfig =>
    aProfile("cursor").withSignalDir(signalDir).build();

  it("answers nothing for a tool declaring no signal directory", async () => {
    const fs = new InMemoryFileAdapter({ "/p/.cursor/commands/a.md": "name: aidd:x" });

    expect(await detectToolSignals(fs, cursor(null), "/p")).toStrictEqual([]);
  });

  it("answers nothing when the signal directory does not exist", async () => {
    expect(
      await detectToolSignals(new InMemoryFileAdapter(), cursor(".cursor/commands"), "/p")
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

    expect((await detectToolSignals(fs, cursor(".cursor/commands"), "/p")).sort()).toStrictEqual(
      ["colon.md", "quoted.md", "tight.md"].map((file) => join(".cursor/commands", file))
    );
  });
});
