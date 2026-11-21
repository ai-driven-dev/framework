import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TrackedConfigFiles } from "../../../../../../src/contexts/installation/application/install/config/tracked-config-files.js";
import { Manifest } from "../../../../../../src/contexts/installation/domain/manifest.js";
import { FileHash } from "../../../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../../../src/shared/domain/installation-file.js";
import { extractMergeEntries } from "../../../../../../src/shared/domain/merge.js";
import { CapturingLogger } from "../../../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import { TOOL } from "../../../../../shared/testing/registered-tools.builder.js";

const ROOT = "/project";

function setup(seed: Record<string, string> = {}) {
  const fs = new InMemoryFileAdapter(seed);
  const logger = new CapturingLogger();
  return { fs, logger, files: new TrackedConfigFiles(fs, logger) };
}

describe("TrackedConfigFiles.fileOf", () => {
  it("hashes the content and defaults to no merge strategy", () => {
    const { files } = setup();

    const file = files.fileOf("a.json", "{}");

    expect(file.hash).toStrictEqual(FileHash.of("{}"));
    expect(file.mergeStrategy).toBe("none");
  });
});

describe("TrackedConfigFiles.isUserOwned", () => {
  it("answers false for a file the project does not have, without a warning", async () => {
    const { files, logger } = setup();

    expect(await files.isUserOwned("a.json", ROOT, Manifest.create())).toBe(false);
    expect(logger.warnMessages).toStrictEqual([]);
  });

  it("answers false for a file on disk the manifest tracks", async () => {
    const { files } = setup({ [join(ROOT, "a.json")]: "{}" });
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "1.0.0", [files.fileOf("a.json", "{}")]);

    expect(await files.isUserOwned("a.json", ROOT, manifest)).toBe(false);
  });

  it("answers true and warns for a file on disk the manifest does not track", async () => {
    const { files, logger } = setup({ [join(ROOT, "a.json")]: "{}" });

    expect(await files.isUserOwned("a.json", ROOT, Manifest.create())).toBe(true);
    expect(logger.warnMessages).toStrictEqual(["Skipping a.json — exists but not tracked by aidd"]);
  });
});

describe("TrackedConfigFiles.writeAndTrack", () => {
  it("writes each file and tracks it as given", async () => {
    const { files, fs } = setup();
    const file = files.fileOf("a.txt", "alpha");

    const tracked = await files.writeAndTrack([file], ROOT);

    expect(await fs.readFile(join(ROOT, "a.txt"))).toBe("alpha");
    expect(tracked).toStrictEqual([file]);
  });

  it("leaves a skipped file as it is and tracks it by the hash it holds on disk", async () => {
    const { files, fs } = setup({ [join(ROOT, "a.txt")]: "edited" });

    const tracked = await files.writeAndTrack(
      [files.fileOf("a.txt", "alpha")],
      ROOT,
      async () => "skip"
    );

    expect(await fs.readFile(join(ROOT, "a.txt"))).toBe("edited");
    expect(tracked.map((f) => [f.relativePath, f.content, f.hash])).toStrictEqual([
      ["a.txt", "", FileHash.of("edited")],
    ]);
  });

  it("asks the gate once per file with its relative path", async () => {
    const { files } = setup();
    const asked: string[] = [];

    await files.writeAndTrack(
      [files.fileOf("a.txt", "a"), files.fileOf("b.txt", "b")],
      ROOT,
      async (path) => {
        asked.push(path);
        return "write";
      }
    );

    expect(asked).toStrictEqual(["a.txt", "b.txt"]);
  });
});

describe("TrackedConfigFiles.mergeAndTrack", () => {
  it("merges into the file on disk and answers the entries the merged file holds", async () => {
    const { files, fs } = setup({ [join(ROOT, "s.json")]: '{"user":1}' });

    const entries = await files.mergeAndTrack(
      [
        new InstallationFile({
          relativePath: "s.json",
          content: '{"framework":2}',
          hash: FileHash.of('{"framework":2}'),
          mergeStrategy: "framework-prime",
        }),
      ],
      ROOT
    );

    const merged = await fs.readFile(join(ROOT, "s.json"));
    expect(JSON.parse(merged)).toStrictEqual({ user: 1, framework: 2 });
    expect(entries).toStrictEqual([
      {
        relativePath: "s.json",
        sectionKey: null,
        entries: extractMergeEntries(merged, null),
      },
    ]);
  });
});
