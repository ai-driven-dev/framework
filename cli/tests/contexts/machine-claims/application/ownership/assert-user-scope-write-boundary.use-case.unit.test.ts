import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { AssertUserScopeWriteBoundary } from "../../../../../src/contexts/machine-claims/application/ownership/assert-user-scope-write-boundary.use-case.js";
import type {
  UserScopeReach,
  UserScopeWrite,
} from "../../../../../src/contexts/machine-claims/application/ownership/user-scope-boundary.js";
import {
  NoUserPluginsDirectoryError,
  PluginDirectoryDisappearedError,
  PluginDirectoryOutsideBoundaryError,
  UpdateParentEscapesBoundaryError,
  UpdatePathEscapesPluginError,
} from "../../../../../src/contexts/machine-claims/contract/machine-claims.error.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../../src/shared/domain/installation-file.js";
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
const _HASH = FileHash.of(CONTENT).value;

function _plugin(files: Record<string, string>): MachinePlugin {
  return new MachinePlugin({ name: "aidd-test", files });
}

const assertUserScopeWriteBoundary = (
  reach: UserScopeReach,
  tool: Parameters<AssertUserScopeWriteBoundary["execute"]>[0],
  write: UserScopeWrite
) => new AssertUserScopeWriteBoundary(reach).execute(tool, write);

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

describe("a profile that declares no plugins at all", () => {
  const noPlugins = { ...registeredTools().aiProfile(TOOL.cursor), plugins: () => null };
  const file = new InstallationFile({
    relativePath: "aidd-test/a.md",
    content: "new bytes",
    hash: new FileHash("a".repeat(32)),
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
