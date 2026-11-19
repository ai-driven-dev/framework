import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  assertUserScopeWriteBoundary,
  userScopeFilesSafeToDelete,
  withoutMissingFiles,
} from "../../../../src/contexts/machine-claims/application/user-scope-plugin-files.js";
import { FileHash, InstallationFile } from "../../../../src/shared/domain/file.js";
import { CapturingLogger } from "../../../shared/testing/capturing-logger.js";
import { errnoError, FaultingFileAdapter } from "../../../shared/testing/faulting-file-adapter.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.js";
import { MachinePlugin } from "../testing/machine-plugin.js";

const HOME = "/home/u";
const BOUNDARY = join(HOME, ".cursor", "plugins", "local");
const CONTENT = "owned bytes";
const HASH = FileHash.of(CONTENT).value;

function plugin(files: Record<string, string>): MachinePlugin {
  return new MachinePlugin({ name: "aidd-test", files });
}

describe("userScopeFilesSafeToDelete", () => {
  it("answers nothing for a tool without a user-scope plugin directory", async () => {
    const logger = new CapturingLogger();

    const safe = await userScopeFilesSafeToDelete(
      new InMemoryFileAdapter(),
      logger,
      plugin({ "aidd-test/a.md": HASH }),
      registeredTools().aiProfile(TOOL.claude),
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
      registeredTools().aiProfile(TOOL.cursor),
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
      registeredTools().aiProfile(TOOL.cursor),
      HOME
    );

    expect([...safe]).toStrictEqual([]);
    expect(logger.warnMessages).toStrictEqual([]);
  });

  it("names and leaves in place a file that no longer exists", async () => {
    const fs = new FaultingFileAdapter();
    fs.failOn("realpath", join(BOUNDARY, "aidd-test", "gone.md"), errnoError("ENOENT"));
    const logger = new CapturingLogger();
    fs.setFile(join(BOUNDARY, "aidd-test", "a.md"), CONTENT);

    const safe = await userScopeFilesSafeToDelete(
      fs,
      logger,
      plugin({ "aidd-test/gone.md": HASH, "aidd-test/a.md": HASH }),
      registeredTools().aiProfile(TOOL.cursor),
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
        registeredTools().aiProfile(TOOL.cursor),
        HOME
      )
    ).rejects.toThrow("EACCES: planted by the test");
  });

  it("refuses a user-edited file even though its path remains within the scope", async () => {
    const path = join(BOUNDARY, "aidd-test", "plugin.json");
    const fs = new InMemoryFileAdapter({ [path]: "user-edited bytes" });
    await expect(
      userScopeFilesSafeToDelete(
        fs,
        new CapturingLogger(),
        plugin({ "aidd-test/plugin.json": HASH }),
        registeredTools().aiProfile(TOOL.cursor),
        HOME
      )
    ).rejects.toThrow(/edited.*plugin.json|plugin.json.*edited/);
    expect(fs.getFile(path)).toBe("user-edited bytes");
  });

  it("refuses an unproven legacy digest and a failed content read", async () => {
    const path = join(BOUNDARY, "aidd-test", "script.js");
    const fs = new FaultingFileAdapter();
    fs.setFile(path, CONTENT);
    await expect(
      userScopeFilesSafeToDelete(
        fs,
        new CapturingLogger(),
        plugin({ "aidd-test/script.js": "" }),
        registeredTools().aiProfile(TOOL.cursor),
        HOME
      )
    ).rejects.toThrow(/unproven.*script.js|script.js.*unproven/);
    fs.failOn("readFile", path, errnoError("EACCES"));
    await expect(
      userScopeFilesSafeToDelete(
        fs,
        new CapturingLogger(),
        plugin({ "aidd-test/script.js": HASH }),
        registeredTools().aiProfile(TOOL.cursor),
        HOME
      )
    ).rejects.toThrow(/EACCES/);
  });
});

describe("withoutMissingFiles", () => {
  it("hands back the same plugin when the tool has no user-scope plugin directory", async () => {
    const recorded = plugin({ "aidd-test/a.md": HASH });

    const kept = await withoutMissingFiles(
      new InMemoryFileAdapter(),
      recorded,
      registeredTools().aiProfile(TOOL.claude),
      HOME
    );

    expect(kept).toBe(recorded);
  });
});

describe("a recorded install digest", () => {
  it.each([
    ["a prefix", `x${HASH}`],
    ["a suffix", `${HASH}x`],
  ])("is refused when it carries %s beyond the 32 hex digits", async (_label, digest) => {
    const fs = new InMemoryFileAdapter();
    fs.setFile(join(BOUNDARY, "aidd-test", "script.js"), CONTENT);
    await expect(
      userScopeFilesSafeToDelete(
        fs,
        new CapturingLogger(),
        plugin({ "aidd-test/script.js": digest }),
        registeredTools().aiProfile(TOOL.cursor),
        HOME
      )
    ).rejects.toThrow(/unproven/);
  });
});

describe("assertUserScopeWriteBoundary", () => {
  const file = (relativePath: string) =>
    new InstallationFile({
      relativePath,
      content: "new bytes",
      hash: new FileHash("a".repeat(32)),
    });

  it("refuses a tool without a declared user plugins directory", async () => {
    await expect(
      assertUserScopeWriteBoundary(
        new InMemoryFileAdapter(),
        registeredTools().aiProfile(TOOL.claude),
        "aidd-test",
        [file("aidd-test/a.md")],
        HOME
      )
    ).rejects.toThrow(/no user plugins directory/);
  });

  it.each([BOUNDARY, join(BOUNDARY, "aidd-test")])(
    "propagates an unreadable write boundary at %s",
    async (path) => {
      const fs = new FaultingFileAdapter();
      const error = errnoError("EACCES");
      fs.failOn("realpath", path, error);

      await expect(
        assertUserScopeWriteBoundary(
          fs,
          registeredTools().aiProfile(TOOL.cursor),
          "aidd-test",
          [file("aidd-test/a.md")],
          HOME
        )
      ).rejects.toBe(error);
    }
  );

  it("allows missing nested parents only after resolving an existing safe ancestor", async () => {
    const fs = new FaultingFileAdapter();
    fs.failOn("realpath", join(BOUNDARY, "aidd-test/skills/new"), errnoError("ENOENT"));
    fs.failOn("realpath", join(BOUNDARY, "aidd-test/skills"), errnoError("ENOENT"));

    await expect(
      assertUserScopeWriteBoundary(
        fs,
        registeredTools().aiProfile(TOOL.cursor),
        "aidd-test",
        [file("aidd-test/skills/new/SKILL.md")],
        HOME
      )
    ).resolves.toBeUndefined();
  });

  it("refuses a plugin directory that disappears after the initial boundary check", async () => {
    const fs = new InMemoryFileAdapter();
    const pluginDir = join(BOUNDARY, "aidd-test");
    let pluginReads = 0;
    vi.spyOn(fs, "realpath").mockImplementation(async (path) => {
      if (path === BOUNDARY) return path;
      if (path === pluginDir && ++pluginReads === 1) return path;
      throw errnoError("ENOENT");
    });

    await expect(
      assertUserScopeWriteBoundary(
        fs,
        registeredTools().aiProfile(TOOL.cursor),
        "aidd-test",
        [file("aidd-test/skills/new/SKILL.md")],
        HOME
      )
    ).rejects.toThrow(/directory disappeared during update/);
  });

  it("allows a new file only within the owned plugin directory", async () => {
    const fs = new InMemoryFileAdapter();
    await expect(
      assertUserScopeWriteBoundary(
        fs,
        registeredTools().aiProfile(TOOL.cursor),
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
        registeredTools().aiProfile(TOOL.cursor),
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
        registeredTools().aiProfile(TOOL.cursor),
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
        registeredTools().aiProfile(TOOL.cursor),
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
        registeredTools().aiProfile(TOOL.cursor),
        "aidd-test",
        [file("aidd-test/skills/demo/SKILL.md")],
        HOME
      )
    ).rejects.toThrow(/directory is not safely inside/);
  });
});

describe("user-scope boundaries on a filesystem that rejects a missing path", () => {
  const file = (relativePath: string) =>
    new InstallationFile({
      relativePath,
      content: "new bytes",
      hash: new FileHash("a".repeat(32)),
    });
  const strict = (seed: Record<string, string> = {}) =>
    new InMemoryFileAdapter(seed).rejectMissingRealpath();

  it("deletes nothing, silently, when the user-scope directory does not exist", async () => {
    const logger = new CapturingLogger();

    const safe = await userScopeFilesSafeToDelete(
      strict(),
      logger,
      plugin({ "aidd-test/a.md": HASH }),
      registeredTools().aiProfile(TOOL.cursor),
      HOME
    );

    expect([...safe]).toStrictEqual([]);
    expect(logger.warnMessages).toStrictEqual([]);
  });

  it("names and leaves in place a recorded file that no longer exists", async () => {
    const logger = new CapturingLogger();
    const fs = strict({ [join(BOUNDARY, "aidd-test", "a.md")]: CONTENT });

    const safe = await userScopeFilesSafeToDelete(
      fs,
      logger,
      plugin({ "aidd-test/gone.md": HASH, "aidd-test/a.md": HASH }),
      registeredTools().aiProfile(TOOL.cursor),
      HOME
    );

    expect([...safe]).toStrictEqual([["aidd-test/a.md", HASH]]);
    expect(logger.warnMessages).toStrictEqual([
      `cursor: 'aidd-test' file 'aidd-test/gone.md' does not resolve inside ${BOUNDARY}; left in place.`,
    ]);
  });

  it("refuses an update when the plugin directory does not exist", async () => {
    const fs = strict({ [join(BOUNDARY, "other", "f")]: "x" });

    await expect(
      assertUserScopeWriteBoundary(
        fs,
        registeredTools().aiProfile(TOOL.cursor),
        "aidd-test",
        [file("aidd-test/a.md")],
        HOME
      )
    ).rejects.toThrow(/directory is not safely inside/);
  });

  it("allows missing nested parents once the plugin directory resolves", async () => {
    const fs = strict({ [join(BOUNDARY, "aidd-test", "keep")]: "x" });

    await expect(
      assertUserScopeWriteBoundary(
        fs,
        registeredTools().aiProfile(TOOL.cursor),
        "aidd-test",
        [file("aidd-test/skills/new/a.md")],
        HOME
      )
    ).resolves.toBeUndefined();
  });
});

describe("a profile that declares no plugins at all", () => {
  const noPlugins = { ...registeredTools().aiProfile(TOOL.cursor), plugins: () => null };
  const file = new InstallationFile({
    relativePath: "aidd-test/a.md",
    content: "new bytes",
    hash: new FileHash("a".repeat(32)),
  });

  it("answers nothing safe to delete", async () => {
    const safe = await userScopeFilesSafeToDelete(
      new InMemoryFileAdapter({ [join(BOUNDARY, "aidd-test/a.md")]: CONTENT }),
      new CapturingLogger(),
      plugin({ "aidd-test/a.md": HASH }),
      noPlugins,
      HOME
    );

    expect([...safe]).toStrictEqual([]);
  });

  it("hands back the same plugin", async () => {
    const recorded = plugin({ "aidd-test/a.md": HASH });

    expect(await withoutMissingFiles(new InMemoryFileAdapter(), recorded, noPlugins, HOME)).toBe(
      recorded
    );
  });

  it("refuses to write", async () => {
    await expect(
      assertUserScopeWriteBoundary(new InMemoryFileAdapter(), noPlugins, "aidd-test", [file], HOME)
    ).rejects.toThrow(/no user plugins directory/);
  });
});

describe("a write boundary that vanished while its plugin directory resolves", () => {
  it("is refused as unsafe, not dereferenced", async () => {
    const fs = new FaultingFileAdapter();
    fs.failOn("realpath", BOUNDARY, errnoError("ENOENT"));

    await expect(
      assertUserScopeWriteBoundary(
        fs,
        registeredTools().aiProfile(TOOL.cursor),
        "aidd-test",
        [
          new InstallationFile({
            relativePath: "aidd-test/a.md",
            content: "new bytes",
            hash: new FileHash("a".repeat(32)),
          }),
        ],
        HOME
      )
    ).rejects.toThrow(/directory is not safely inside/);
  });
});
