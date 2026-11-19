import { describe, expect, it } from "vitest";
import { CheckFileReferences } from "../../../../../src/contexts/installation/application/doctor/check-file-references.js";
import { LoadManifest } from "../../../../../src/contexts/installation/application/doctor/load-manifest.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { FileHash, InstallationFile } from "../../../../../src/shared/domain/file.js";
import type { ToolId } from "../../../../../src/shared/domain/tool.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.js";
import { TOOL } from "../../../../shared/testing/registered-tools.js";

const PROJECT_ROOT = "/project";
const DOC = ".claude/rules/doc.md";
const PLUGIN_DOC = ".claude/plugins/sample/agents/reviewer.md";

function brokenIn(relativePath: string, ref: string) {
  return {
    severity: "warning",
    message: `Broken reference in ${relativePath}: "${ref}" not found on disk`,
    fix: `Restore the missing file or remove the reference in ${relativePath}`,
  };
}

function manifestWithPluginDoc(content: string): Manifest {
  const manifest = Manifest.create();
  manifest.addTool(TOOL.claude, "1.0.0", []);
  manifest.addPlugin(
    TOOL.claude,
    InstalledPlugin.fromJSON({
      name: "sample",
      source: { kind: "local", path: "/some/path" },
      version: "1.0.0",
      strict: false,
      files: { [PLUGIN_DOC]: FileHash.of(content).value },
      scope: "project",
    })
  );
  return manifest;
}

async function issuesFor(
  onDisk: Record<string, string>,
  options: {
    trackedFiles?: { relativePath: string; toolId: ToolId | null }[];
    manifest?: Manifest;
    allowedIds?: Set<string> | null;
  } = {}
) {
  const files = Object.fromEntries(
    Object.entries(onDisk).map(([relativePath, content]) => [
      `${PROJECT_ROOT}/${relativePath}`,
      content,
    ])
  );
  const manifest = options.manifest ?? Manifest.create();
  for (const { relativePath, toolId } of options.trackedFiles ?? []) {
    manifest.addTool(toolId ?? TOOL.claude, "1.0.0", [
      new InstallationFile({ relativePath, content: "", hash: FileHash.of("") }),
    ]);
  }
  const load = new LoadManifest(new InMemoryManifestRepository(manifest));
  return new CheckFileReferences(load, new InMemoryFileAdapter(files)).execute({
    projectRoot: PROJECT_ROOT,
    allowedIds: options.allowedIds ?? null,
  });
}

const TRACKED_DOC = [{ relativePath: DOC, toolId: TOOL.claude }];

describe("CheckFileReferences", () => {
  describe("references in a tracked markdown file", () => {
    it("reports a warning for an @ reference to a file that is not on disk", async () => {
      const issues = await issuesFor(
        { [DOC]: "See @docs/missing.md" },
        { trackedFiles: TRACKED_DOC }
      );

      expect(issues).toStrictEqual([brokenIn(DOC, "docs/missing.md")]);
    });

    it("reports a warning for a markdown link resolved from the file's own directory", async () => {
      const issues = await issuesFor(
        { [DOC]: "[sibling](gone.md)" },
        { trackedFiles: TRACKED_DOC }
      );

      expect(issues).toStrictEqual([brokenIn(DOC, "gone.md")]);
    });

    it("reports nothing when every reference resolves", async () => {
      const issues = await issuesFor(
        {
          [DOC]: "See @docs/here.md and [sibling](other.md)",
          "docs/here.md": "",
          ".claude/rules/other.md": "",
        },
        { trackedFiles: TRACKED_DOC }
      );

      expect(issues).toStrictEqual([]);
    });

    it("never looks up a directory reference", async () => {
      const issues = await issuesFor(
        { [DOC]: "See @docs/nowhere/ and [dir](elsewhere/)" },
        { trackedFiles: TRACKED_DOC }
      );

      expect(issues).toStrictEqual([]);
    });

    it("ignores a link that resolves outside the project", async () => {
      const issues = await issuesFor(
        { [DOC]: "[up](../../../outside.md)" },
        { trackedFiles: TRACKED_DOC }
      );

      expect(issues).toStrictEqual([]);
    });

    it("reports nothing for a tracked file that is not on disk", async () => {
      expect(await issuesFor({}, { trackedFiles: TRACKED_DOC })).toStrictEqual([]);
    });
  });

  describe("which files are scanned", () => {
    it("scans only markdown files", async () => {
      const settings = ".claude/settings.json";
      const issues = await issuesFor(
        { [settings]: "@docs/missing.md" },
        { trackedFiles: [{ relativePath: settings, toolId: TOOL.claude }] }
      );

      expect(issues).toStrictEqual([]);
    });

    it("skips a file whose markdown extension is not its last one", async () => {
      const backup = ".claude/rules/doc.md.bak";
      const issues = await issuesFor(
        { [backup]: "@docs/missing.md" },
        { trackedFiles: [{ relativePath: backup, toolId: TOOL.claude }] }
      );

      expect(issues).toStrictEqual([]);
    });

    it("skips a file under a tasks directory", async () => {
      const task = "aidd_docs/tasks/plan.md";
      const issues = await issuesFor(
        { [task]: "@docs/missing.md" },
        { trackedFiles: [{ relativePath: task, toolId: null }] }
      );

      expect(issues).toStrictEqual([]);
    });
  });

  describe("files of an installed plugin", () => {
    const content = "See @docs/missing.md";

    it("are scanned like tracked files", async () => {
      const issues = await issuesFor(
        { [PLUGIN_DOC]: content },
        { manifest: manifestWithPluginDoc(content) }
      );

      expect(issues).toStrictEqual([brokenIn(PLUGIN_DOC, "docs/missing.md")]);
    });

    it("are ignored when their tool is outside the narrowed set", async () => {
      const issues = await issuesFor(
        { [PLUGIN_DOC]: content },
        { manifest: manifestWithPluginDoc(content), allowedIds: new Set(["cursor"]) }
      );

      expect(issues).toStrictEqual([]);
    });

    it("are still scanned when their tool is inside the narrowed set", async () => {
      const issues = await issuesFor(
        { [PLUGIN_DOC]: content },
        { manifest: manifestWithPluginDoc(content), allowedIds: new Set(["claude"]) }
      );

      expect(issues).toStrictEqual([brokenIn(PLUGIN_DOC, "docs/missing.md")]);
    });
  });
});
