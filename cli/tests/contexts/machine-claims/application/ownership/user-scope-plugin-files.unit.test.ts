import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  assertUserScopeWriteBoundary,
  userScopeFilesSafeToDelete,
  withoutMissingFiles,
} from "../../../../../src/contexts/machine-claims/application/ownership/user-scope-plugin-files.js";
import {
  EditedAfterInstallError,
  NoUserPluginsDirectoryError,
  PluginDirectoryDisappearedError,
  PluginDirectoryOutsideBoundaryError,
  UnprovenInstallDigestError,
  UpdateParentEscapesBoundaryError,
  UpdatePathEscapesPluginError,
} from "../../../../../src/contexts/machine-claims/domain/machine-claims.error.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../../src/shared/domain/installation-file.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import {
  errnoError,
  FaultingFileAdapter,
} from "../../../../shared/testing/faulting-file-adapter.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { MachinePlugin } from "../../testing/machine-plugin.fake.js";

const HOME = "/home/u";
const BOUNDARY = join(HOME, ".cursor", "plugins", "local");
const PLUGIN_DIR = join(BOUNDARY, "aidd-test");
const CONTENT = "owned bytes";
const HASH = FileHash.of(CONTENT).value;

function plugin(files: Record<string, string>): MachinePlugin {
  return new MachinePlugin({ name: "aidd-test", files });
}

describe("choosing the user-scope files safe to delete", () => {
  it("answers nothing for a tool without a user-scope plugin directory", async () => {
    const logger = new CapturingLogger();

    const safe = await userScopeFilesSafeToDelete(
      { fs: new InMemoryFileAdapter({}, [PLUGIN_DIR]), logger, home: HOME },
      plugin({ "aidd-test/a.md": HASH }),
      registeredTools().aiProfile(TOOL.claude)
    );

    expect([...safe]).toStrictEqual([]);
    expect(logger.warnMessages).toStrictEqual([]);
  });

  it("names and leaves in place a file whose path escapes the user-scope directory", async () => {
    const logger = new CapturingLogger();

    const safe = await userScopeFilesSafeToDelete(
      { fs: new InMemoryFileAdapter({}, [PLUGIN_DIR]), logger, home: HOME },
      plugin({ "../../escape.md": HASH }),
      registeredTools().aiProfile(TOOL.cursor)
    );

    expect([...safe]).toStrictEqual([]);
    expect(logger.warnMessages).toStrictEqual([
      `cursor: 'aidd-test' file '../../escape.md' does not resolve inside ${BOUNDARY}; left in place.`,
    ]);
  });

  it("answers nothing, silently, when the user-scope directory itself does not exist", async () => {
    const fs = new FaultingFileAdapter({}, [PLUGIN_DIR]);
    fs.failOn("realpath", BOUNDARY, errnoError("ENOENT"));
    const logger = new CapturingLogger();

    const safe = await userScopeFilesSafeToDelete(
      { fs, logger, home: HOME },
      plugin({ "aidd-test/a.md": HASH }),
      registeredTools().aiProfile(TOOL.cursor)
    );

    expect([...safe]).toStrictEqual([]);
    expect(logger.warnMessages).toStrictEqual([]);
  });

  it("names and leaves in place a file that no longer exists", async () => {
    const fs = new FaultingFileAdapter({}, [PLUGIN_DIR]);
    fs.failOn("realpath", join(BOUNDARY, "aidd-test", "gone.md"), errnoError("ENOENT"));
    const logger = new CapturingLogger();
    fs.setFile(join(BOUNDARY, "aidd-test", "a.md"), CONTENT);

    const safe = await userScopeFilesSafeToDelete(
      { fs, logger, home: HOME },
      plugin({ "aidd-test/gone.md": HASH, "aidd-test/a.md": HASH }),
      registeredTools().aiProfile(TOOL.cursor)
    );

    expect([...safe]).toStrictEqual([["aidd-test/a.md", HASH]]);
    expect(logger.warnMessages).toStrictEqual([
      `cursor: 'aidd-test' file 'aidd-test/gone.md' does not resolve inside ${BOUNDARY}; left in place.`,
    ]);
  });

  it("propagates a resolution failure other than absence", async () => {
    const fs = new FaultingFileAdapter({}, [PLUGIN_DIR]);
    fs.failOn("realpath", join(BOUNDARY, "aidd-test", "a.md"), errnoError("EACCES"));

    await expect(
      userScopeFilesSafeToDelete(
        { fs, logger: new CapturingLogger(), home: HOME },
        plugin({ "aidd-test/a.md": HASH }),
        registeredTools().aiProfile(TOOL.cursor)
      )
    ).rejects.toThrow("EACCES: planted by the test");
  });

  it("refuses a user-edited file even though its path remains within the scope", async () => {
    const path = join(BOUNDARY, "aidd-test", "plugin.json");
    const fs = new InMemoryFileAdapter({ [path]: "user-edited bytes" });
    await expect(
      userScopeFilesSafeToDelete(
        { fs, logger: new CapturingLogger(), home: HOME },
        plugin({ "aidd-test/plugin.json": HASH }),
        registeredTools().aiProfile(TOOL.cursor)
      )
    ).rejects.toThrow(EditedAfterInstallError);
    expect(fs.getFile(path)).toBe("user-edited bytes");
  });

  it("refuses an unproven legacy digest and a failed content read", async () => {
    const path = join(BOUNDARY, "aidd-test", "script.js");
    const fs = new FaultingFileAdapter({}, [PLUGIN_DIR]);
    fs.setFile(path, CONTENT);
    await expect(
      userScopeFilesSafeToDelete(
        { fs, logger: new CapturingLogger(), home: HOME },
        plugin({ "aidd-test/script.js": "" }),
        registeredTools().aiProfile(TOOL.cursor)
      )
    ).rejects.toThrow(UnprovenInstallDigestError);
    fs.failOn("readFile", path, errnoError("EACCES"));
    await expect(
      userScopeFilesSafeToDelete(
        { fs, logger: new CapturingLogger(), home: HOME },
        plugin({ "aidd-test/script.js": HASH }),
        registeredTools().aiProfile(TOOL.cursor)
      )
    ).rejects.toThrow(/EACCES/);
  });
});

describe("leaving out the files already gone", () => {
  it("hands back the same plugin when the tool has no user-scope plugin directory", async () => {
    const recorded = plugin({ "aidd-test/a.md": HASH });

    const kept = await withoutMissingFiles(
      { fs: new InMemoryFileAdapter({}, [PLUGIN_DIR]), home: HOME },
      recorded,
      registeredTools().aiProfile(TOOL.claude)
    );

    expect(kept).toBe(recorded);
  });
});

describe("a recorded install digest", () => {
  it.each([
    ["a prefix", `x${HASH}`],
    ["a suffix", `${HASH}x`],
  ])("is refused when it carries %s beyond the 32 hex digits", async (_label, digest) => {
    const fs = new InMemoryFileAdapter({}, [PLUGIN_DIR]);
    fs.setFile(join(BOUNDARY, "aidd-test", "script.js"), CONTENT);
    await expect(
      userScopeFilesSafeToDelete(
        { fs, logger: new CapturingLogger(), home: HOME },
        plugin({ "aidd-test/script.js": digest }),
        registeredTools().aiProfile(TOOL.cursor)
      )
    ).rejects.toThrow(UnprovenInstallDigestError);
  });
});

describe("before writing inside a user-scope directory", () => {
  const file = (relativePath: string) =>
    new InstallationFile({
      relativePath,
      content: "new bytes",
      hash: new FileHash("a".repeat(32)),
    });

  it("refuses a tool without a declared user plugins directory", async () => {
    await expect(
      assertUserScopeWriteBoundary(
        { fs: new InMemoryFileAdapter({}, [PLUGIN_DIR]), home: HOME },
        registeredTools().aiProfile(TOOL.claude),
        { pluginName: "aidd-test", files: [file("aidd-test/a.md")] }
      )
    ).rejects.toThrow(NoUserPluginsDirectoryError);
  });

  it.each([BOUNDARY, join(BOUNDARY, "aidd-test")])(
    "propagates an unreadable write boundary at %s",
    async (path) => {
      const fs = new FaultingFileAdapter({}, [PLUGIN_DIR]);
      const error = errnoError("EACCES");
      fs.failOn("realpath", path, error);

      await expect(
        assertUserScopeWriteBoundary({ fs, home: HOME }, registeredTools().aiProfile(TOOL.cursor), {
          pluginName: "aidd-test",
          files: [file("aidd-test/a.md")],
        })
      ).rejects.toBe(error);
    }
  );

  it("allows missing nested parents only after resolving an existing safe ancestor", async () => {
    const fs = new FaultingFileAdapter({}, [PLUGIN_DIR]);
    fs.failOn("realpath", join(BOUNDARY, "aidd-test/skills/new"), errnoError("ENOENT"));
    fs.failOn("realpath", join(BOUNDARY, "aidd-test/skills"), errnoError("ENOENT"));

    await expect(
      assertUserScopeWriteBoundary({ fs, home: HOME }, registeredTools().aiProfile(TOOL.cursor), {
        pluginName: "aidd-test",
        files: [file("aidd-test/skills/new/SKILL.md")],
      })
    ).resolves.toBeUndefined();
  });

  it("refuses a plugin directory that disappears after the initial boundary check", async () => {
    const fs = new InMemoryFileAdapter({}, [PLUGIN_DIR]);
    const pluginDir = join(BOUNDARY, "aidd-test");
    let pluginReads = 0;
    vi.spyOn(fs, "realpath").mockImplementation(async (path) => {
      if (path === BOUNDARY) return path;
      if (path === pluginDir && ++pluginReads === 1) return path;
      throw errnoError("ENOENT");
    });

    await expect(
      assertUserScopeWriteBoundary({ fs, home: HOME }, registeredTools().aiProfile(TOOL.cursor), {
        pluginName: "aidd-test",
        files: [file("aidd-test/skills/new/SKILL.md")],
      })
    ).rejects.toThrow(PluginDirectoryDisappearedError);
  });

  it("allows a new file only within the owned plugin directory", async () => {
    const fs = new InMemoryFileAdapter({}, [PLUGIN_DIR]);
    await expect(
      assertUserScopeWriteBoundary({ fs, home: HOME }, registeredTools().aiProfile(TOOL.cursor), {
        pluginName: "aidd-test",
        files: [file("aidd-test/skills/demo/SKILL.md")],
      })
    ).resolves.toBeUndefined();
  });

  it.each([
    "../../escape.md",
    "aidd-test/../escape.md",
    "other-plugin/SKILL.md",
    "aidd-test\\skills\\SKILL.md",
    "/absolute/escape.md",
  ])("refuses the untrusted machine update path %s", async (relativePath) => {
    await expect(
      assertUserScopeWriteBoundary(
        { fs: new InMemoryFileAdapter({}, [PLUGIN_DIR]), home: HOME },
        registeredTools().aiProfile(TOOL.cursor),
        { pluginName: "aidd-test", files: [file(relativePath)] }
      )
    ).rejects.toThrow(UpdatePathEscapesPluginError);
  });

  it("refuses a plugin directory symlink that resolves outside its user-scope base", async () => {
    const fs = new InMemoryFileAdapter({}, [PLUGIN_DIR]);
    fs.setSymlink(join(BOUNDARY, "aidd-test"), "/foreign/aidd-test");
    await expect(
      assertUserScopeWriteBoundary({ fs, home: HOME }, registeredTools().aiProfile(TOOL.cursor), {
        pluginName: "aidd-test",
        files: [file("aidd-test/skills/demo/SKILL.md")],
      })
    ).rejects.toThrow(PluginDirectoryOutsideBoundaryError);
  });

  it("refuses a nested parent symlink before writing new bytes", async () => {
    const fs = new InMemoryFileAdapter({}, [PLUGIN_DIR, "/foreign/skills"]);
    fs.setSymlink(join(BOUNDARY, "aidd-test/skills"), "/foreign/skills");
    await expect(
      assertUserScopeWriteBoundary({ fs, home: HOME }, registeredTools().aiProfile(TOOL.cursor), {
        pluginName: "aidd-test",
        files: [file("aidd-test/skills/demo/SKILL.md")],
      })
    ).rejects.toThrow(UpdateParentEscapesBoundaryError);
  });

  it("refuses an absent plugin directory rather than inventing a safe write base", async () => {
    const fs = new FaultingFileAdapter({}, [PLUGIN_DIR]);
    fs.failOn("realpath", join(BOUNDARY, "aidd-test"), errnoError("ENOENT"));
    await expect(
      assertUserScopeWriteBoundary({ fs, home: HOME }, registeredTools().aiProfile(TOOL.cursor), {
        pluginName: "aidd-test",
        files: [file("aidd-test/skills/demo/SKILL.md")],
      })
    ).rejects.toThrow(PluginDirectoryOutsideBoundaryError);
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
      {
        fs: new InMemoryFileAdapter({ [join(BOUNDARY, "aidd-test/a.md")]: CONTENT }),
        logger: new CapturingLogger(),
        home: HOME,
      },
      plugin({ "aidd-test/a.md": HASH }),
      noPlugins
    );

    expect([...safe]).toStrictEqual([]);
  });

  it("hands back the same plugin", async () => {
    const recorded = plugin({ "aidd-test/a.md": HASH });

    expect(
      await withoutMissingFiles(
        { fs: new InMemoryFileAdapter({}, [PLUGIN_DIR]), home: HOME },
        recorded,
        noPlugins
      )
    ).toBe(recorded);
  });

  it("refuses to write", async () => {
    await expect(
      assertUserScopeWriteBoundary(
        { fs: new InMemoryFileAdapter({}, [PLUGIN_DIR]), home: HOME },
        noPlugins,
        { pluginName: "aidd-test", files: [file] }
      )
    ).rejects.toThrow(NoUserPluginsDirectoryError);
  });
});

describe("a write boundary that vanished while its plugin directory resolves", () => {
  it("is refused as unsafe, not dereferenced", async () => {
    const fs = new FaultingFileAdapter({}, [PLUGIN_DIR]);
    fs.failOn("realpath", BOUNDARY, errnoError("ENOENT"));

    await expect(
      assertUserScopeWriteBoundary({ fs, home: HOME }, registeredTools().aiProfile(TOOL.cursor), {
        pluginName: "aidd-test",
        files: [
          new InstallationFile({
            relativePath: "aidd-test/a.md",
            content: "new bytes",
            hash: new FileHash("a".repeat(32)),
          }),
        ],
      })
    ).rejects.toThrow(PluginDirectoryOutsideBoundaryError);
  });
});
