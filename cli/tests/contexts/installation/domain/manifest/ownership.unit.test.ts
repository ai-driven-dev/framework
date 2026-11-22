import { describe, expect, it } from "vitest";
import { ownerOf } from "../../../../../src/contexts/installation/domain/manifest/ownership.js";
import {
  createToolEntry,
  type ToolEntry,
} from "../../../../../src/contexts/installation/domain/manifest/tool-entry.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../../src/shared/domain/installation-file.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const HASH = new FileHash("a".repeat(32));

const plugin = RecordedPlugin.fromJSON({
  name: "demo",
  source: { kind: "github", repo: "owner/demo" },
  version: "1.0.0",
  strict: false,
  files: { ".claude/plugins/demo/README.md": "c".repeat(32) },
  scope: "project",
});

const entry: ToolEntry = createToolEntry({
  toolId: TOOL.claude,
  version: "3.0.0",
  files: [
    new InstallationFile({ relativePath: ".claude/CLAUDE.md", content: "content", hash: HASH }),
  ],
  mergeFiles: [
    {
      relativePath: ".claude/settings.json",
      sectionKey: "mcpServers",
      entries: { alpha: HASH, beta: HASH },
    },
  ],
  existingPlugins: [plugin],
});

describe("who owns a path", () => {
  it("gives a tool file to aidd", () => {
    expect(ownerOf([entry], ".claude/CLAUDE.md")).toStrictEqual({ owner: "aidd" });
  });

  it("gives a plugin file to aidd", () => {
    expect(ownerOf([entry], ".claude/plugins/demo/README.md")).toStrictEqual({ owner: "aidd" });
  });

  it("shares a merge file with the user, naming the keys aidd holds", () => {
    expect(ownerOf([entry], ".claude/settings.json")).toStrictEqual({
      owner: "co-owned",
      keys: ["alpha", "beta"],
    });
  });

  it("leaves every other path to the user", () => {
    expect(ownerOf([entry], "src/app.ts")).toStrictEqual({ owner: "user" });
  });

  it("finds a path recorded under any of the entries", () => {
    const other = createToolEntry({
      toolId: TOOL.cursor,
      version: "3.0.0",
      files: [new InstallationFile({ relativePath: ".cursor/rules.md", content: "c", hash: HASH })],
      mergeFiles: [],
      existingPlugins: [],
    });

    expect(ownerOf([entry, other], ".cursor/rules.md")).toStrictEqual({ owner: "aidd" });
  });
});
