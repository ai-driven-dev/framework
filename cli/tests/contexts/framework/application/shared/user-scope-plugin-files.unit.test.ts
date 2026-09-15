import "../../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertUserScopeWriteBoundary,
  userScopeFilesSafeToDelete,
} from "../../../../../src/contexts/framework/application/shared/user-scope-plugin-files.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import { FileHash, InstallationFile } from "../../../../../src/kernel/file.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import {
  errnoError,
  FaultingFileAdapter,
} from "../../../../helpers/ports/faulting-file-adapter.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";

const HOME = "/home/u";
const BOUNDARY = join(HOME, ".cursor", "plugins", "local");
const HASH = "abc123abc123abc123abc123abc123ab";

function plugin(files: Record<string, string>): InstalledPlugin {
  return InstalledPlugin.fromJSON({
    name: "aidd-test",
    source: { kind: "local", path: "/some/path" },
    version: "1.0.0",
    strict: false,
    files,
    scope: "user",
  });
}

describe("userScopeFilesSafeToDelete", () => {
  it("answers nothing for a tool without a user-scope plugin directory", async () => {
    const logger = new CapturingLogger();

    const safe = await userScopeFilesSafeToDelete(
      new InMemoryFileAdapter(),
      logger,
      plugin({ "aidd-test/a.md": HASH }),
      "claude",
      HOME
    );

    expect([...safe]).toStrictEqual([]);
    expect(logger.warnMessages).toStrictEqual([]);
  });

  it("names and leaves in place a file whose path escapes the user-scope directory", async () => {
    const logger = new CapturingLogger();

    const safe = await userScopeFilesSafeToDelete(
      new InMemoryFileAdapter(),
      logger,
      plugin({ "../escape.md": HASH }),
      "cursor",
      HOME
    );

    expect([...safe]).toStrictEqual([]);
    expect(logger.warnMessages).toStrictEqual([
      `cursor: 'aidd-test' file '../escape.md' does not resolve inside ${BOUNDARY}; left in place.`,
    ]);
  });

  it("answers nothing, silently, when the user-scope directory itself does not exist", async () => {
    const fs = new FaultingFileAdapter();
    fs.failOn("realpath", BOUNDARY, errnoError("ENOENT"));
    const logger = new CapturingLogger();

    const safe = await userScopeFilesSafeToDelete(
      fs,
      logger,
      plugin({ "aidd-test/a.md": HASH }),
      "cursor",
      HOME
    );

    expect([...safe]).toStrictEqual([]);
    expect(logger.warnMessages).toStrictEqual([]);
  });

  it("names and leaves in place a file that no longer exists", async () => {
    const fs = new FaultingFileAdapter();
    fs.failOn("realpath", join(BOUNDARY, "aidd-test", "gone.md"), errnoError("ENOENT"));
    const logger = new CapturingLogger();

    const safe = await userScopeFilesSafeToDelete(
      fs,
      logger,
      plugin({ "aidd-test/gone.md": HASH, "aidd-test/a.md": HASH }),
      "cursor",
      HOME
    );

    expect([...safe]).toStrictEqual([["aidd-test/a.md", HASH]]);
    expect(logger.warnMessages).toStrictEqual([
      `cursor: 'aidd-test' file 'aidd-test/gone.md' does not resolve inside ${BOUNDARY}; left in place.`,
    ]);
  });

  it("propagates a resolution failure other than absence", async () => {
    const fs = new FaultingFileAdapter();
    fs.failOn("realpath", join(BOUNDARY, "aidd-test", "a.md"), errnoError("EACCES"));

    await expect(
      userScopeFilesSafeToDelete(
        fs,
        new CapturingLogger(),
        plugin({ "aidd-test/a.md": HASH }),
        "cursor",
        HOME
      )
    ).rejects.toThrow("EACCES: planted by the test");
  });
});

describe("assertUserScopeWriteBoundary", () => {
  const file = (relativePath: string) =>
    new InstallationFile({
      relativePath,
      content: "new bytes",
      hash: new FileHash("a".repeat(32)),
    });

  it("allows a new file only within the owned plugin directory", async () => {
    const fs = new InMemoryFileAdapter();
    await expect(
      assertUserScopeWriteBoundary(
        fs,
        "cursor",
        "aidd-test",
        [file("aidd-test/skills/demo/SKILL.md")],
        HOME
      )
    ).resolves.toBeUndefined();
  });

  it.each([
    "../escape.md",
    "aidd-test/../escape.md",
    "other-plugin/SKILL.md",
    "aidd-test\\skills\\SKILL.md",
    "/absolute/escape.md",
  ])("refuses the untrusted machine update path %s", async (relativePath) => {
    await expect(
      assertUserScopeWriteBoundary(
        new InMemoryFileAdapter(),
        "cursor",
        "aidd-test",
        [file(relativePath)],
        HOME
      )
    ).rejects.toThrow(/escapes its plugin directory/);
  });

  it("refuses a plugin directory symlink that resolves outside its user-scope base", async () => {
    const fs = new InMemoryFileAdapter();
    fs.setSymlink(join(BOUNDARY, "aidd-test"), "/foreign/aidd-test");
    await expect(
      assertUserScopeWriteBoundary(
        fs,
        "cursor",
        "aidd-test",
        [file("aidd-test/skills/demo/SKILL.md")],
        HOME
      )
    ).rejects.toThrow(/directory is not safely inside/);
  });

  it("refuses a nested parent symlink before writing new bytes", async () => {
    const fs = new InMemoryFileAdapter();
    fs.setSymlink(join(BOUNDARY, "aidd-test/skills"), "/foreign/skills");
    await expect(
      assertUserScopeWriteBoundary(
        fs,
        "cursor",
        "aidd-test",
        [file("aidd-test/skills/demo/SKILL.md")],
        HOME
      )
    ).rejects.toThrow(/update parent.*escapes/);
  });

  it("refuses an absent plugin directory rather than inventing a safe write base", async () => {
    const fs = new FaultingFileAdapter();
    fs.failOn("realpath", join(BOUNDARY, "aidd-test"), errnoError("ENOENT"));
    await expect(
      assertUserScopeWriteBoundary(
        fs,
        "cursor",
        "aidd-test",
        [file("aidd-test/skills/demo/SKILL.md")],
        HOME
      )
    ).rejects.toThrow(/directory is not safely inside/);
  });
});
