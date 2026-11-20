import { describe, expect, it } from "vitest";
import { CheckProjectLayout } from "../../../../../src/contexts/installation/application/doctor/check-project-layout.js";
import { LoadManifest } from "../../../../../src/contexts/installation/application/doctor/load-manifest.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { FileHash, InstallationFile } from "../../../../../src/shared/domain/file.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const PROJECT_ROOT = "/project";
const CLAUDE_COMMAND = ".claude/commands/plan.md";
const SIGNAL = "---\nname: aidd:01:plan\ndescription: Plan\n---\n";

function manifestTrackingClaude(): Manifest {
  const manifest = Manifest.create();
  manifest.addTool(TOOL.claude, "1.0.0", [
    new InstallationFile({
      relativePath: CLAUDE_COMMAND,
      content: SIGNAL,
      hash: FileHash.of(SIGNAL),
    }),
  ]);
  return manifest;
}

async function issuesFor(onDisk: Record<string, string>) {
  const files = Object.fromEntries(
    Object.entries(onDisk).map(([relativePath, content]) => [
      `${PROJECT_ROOT}/${relativePath}`,
      content,
    ])
  );
  const load = new LoadManifest(new InMemoryManifestRepository(manifestTrackingClaude()));
  return new CheckProjectLayout(load, new InMemoryFileAdapter(files), registeredTools()).execute({
    projectRoot: PROJECT_ROOT,
  });
}

describe("CheckProjectLayout", () => {
  describe("orphaned tool directories", () => {
    it("warns about a tool directory holding aidd files the manifest does not track", async () => {
      const issues = await issuesFor({
        [CLAUDE_COMMAND]: SIGNAL,
        ".cursor/commands/plan.md": SIGNAL,
      });

      expect(issues).toStrictEqual([
        {
          severity: "warning",
          message: "Orphaned directory: .cursor/ (not tracked in manifest)",
          fix: "Remove the directory manually, or run `aidd install <tool>` to track it.",
        },
      ]);
    });

    it("says nothing about a tracked tool directory holding aidd files", async () => {
      expect(await issuesFor({ [CLAUDE_COMMAND]: SIGNAL })).toStrictEqual([]);
    });
  });
});
