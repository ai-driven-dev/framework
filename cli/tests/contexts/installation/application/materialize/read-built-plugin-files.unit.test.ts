import { describe, expect, it } from "vitest";
import {
  readBuiltFlatFiles,
  readBuiltUserPluginFiles,
  withoutHooksPrefix,
} from "../../../../../src/contexts/installation/application/materialize/read-built-plugin-files.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../../src/shared/domain/installation-file.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const BUILT = "/built";

describe("readBuiltUserPluginFiles", () => {
  it("reads the plugin subtree with every path prefixed by the plugin name", async () => {
    const fs = new InMemoryFileAdapter(
      { "/built/plugins/aidd-dev/skills/a.md": "a", "/built/plugins/other/x.md": "x" },
      [BUILT]
    );

    const files = await readBuiltUserPluginFiles(fs, {
      builtDir: BUILT,
      name: "aidd-dev",
      platform: "posix",
    });

    expect(files.map((f) => f.relativePath)).toEqual(["aidd-dev/skills/a.md"]);
    expect(files[0]?.hash).toEqual(FileHash.of("a"));
  });
});

describe("withoutHooksPrefix", () => {
  it("drops the plugin's hooks files and keeps the rest", () => {
    const file = (relativePath: string) =>
      new InstallationFile({ relativePath, content: "", hash: FileHash.of("") });

    const kept = withoutHooksPrefix(
      [file("aidd-dev/hooks/run.js"), file("aidd-dev/skills/a.md"), file("other/hooks/x.js")],
      "aidd-dev"
    );

    expect(kept.map((f) => f.relativePath)).toEqual(["aidd-dev/skills/a.md", "other/hooks/x.js"]);
  });
});

describe("readBuiltFlatFiles", () => {
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
      { builtDir: BUILT, platform: "posix" },
      { name: "aidd-dev", tool, extraPaths: new Set(["hooks/extra.js"]) }
    );

    const paths = files.map((f) => f.relativePath);
    expect(paths).toContain("hooks/extra.js");
    expect(paths).not.toContain("unrelated.txt");
  });
});
