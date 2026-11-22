import { describe, expect, it } from "vitest";
import {
  readBuiltFlatFiles,
  readBuiltUserPluginFiles,
  withoutDroppedFiles,
} from "../../../../../../src/contexts/installation/application/materialize/built/read-built-plugin-files.js";
import { FileHash } from "../../../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../../../src/shared/domain/installation-file.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";

const BUILT = "/built";

describe("reading a built user plugin's files", () => {
  it("reads the plugin subtree with every path prefixed by the plugin name", async () => {
    const fs = new InMemoryFileAdapter(
      { "/built/plugins/aidd-dev/skills/a.md": "a", "/built/plugins/other/x.md": "x" },
      [BUILT]
    );

    const files = await readBuiltUserPluginFiles(fs, {
      builtDir: BUILT,
      name: "aidd-dev",
      platform: process.platform,
    });

    expect(files.map((f) => f.relativePath)).toEqual(["aidd-dev/skills/a.md"]);
    expect(files[0]?.hash).toEqual(FileHash.of("a"));
  });
});

describe("leaving out the files an install drops", () => {
  it("drops the files the engine says an install leaves out, below the plugin's own directory", () => {
    const file = (relativePath: string) =>
      new InstallationFile({ relativePath, content: "", hash: FileHash.of("") });

    const kept = withoutDroppedFiles(
      [file("aidd-dev/hooks/run.js"), file("aidd-dev/skills/a.md"), file("other/hooks/x.js")],
      "aidd-dev",
      (path) => path.startsWith("hooks/")
    );

    expect(kept.map((f) => f.relativePath)).toEqual(["aidd-dev/skills/a.md", "other/hooks/x.js"]);
  });
});

describe("reading a built flat plugin's files", () => {
  const tool = registeredTools().aiProfile(TOOL.cursor);

  it("keeps what the tool says the plugin owns plus the extra paths, and nothing else", async () => {
    const owned = tool.ownsFlatPath(".cursor/rules/aidd-dev-a.mdc", "aidd-dev")
      ? ".cursor/rules/aidd-dev-a.mdc"
      : null;
    const fs = new InMemoryFileAdapter(
      {
        "/built/hooks/extra.js": "e",
        "/built/unrelated.txt": "u",
        ...(owned && { [`/built/${owned}`]: "o" }),
      },
      [BUILT]
    );

    const files = await readBuiltFlatFiles(
      fs,
      { builtDir: BUILT, platform: process.platform },
      { name: "aidd-dev", tool, extraPaths: new Set(["hooks/extra.js"]) }
    );

    const paths = files.map((f) => f.relativePath);
    expect(paths).toContain("hooks/extra.js");
    expect(paths).not.toContain("unrelated.txt");
  });
});
