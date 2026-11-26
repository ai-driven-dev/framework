import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ResolveSafeUserScopeFiles } from "../../../../../src/contexts/machine-claims/application/ownership/resolve-safe-user-scope-files.use-case.js";
import type { ReportingUserScopeReach } from "../../../../../src/contexts/machine-claims/application/ownership/user-scope-boundary.js";
import {
  EditedAfterInstallError,
  UnprovenInstallDigestError,
} from "../../../../../src/contexts/machine-claims/contract/machine-claims.error.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
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

const userScopeFilesSafeToDelete = (
  reach: ReportingUserScopeReach,
  recorded: MachinePlugin,
  tool: Parameters<ResolveSafeUserScopeFiles["execute"]>[1]
) => new ResolveSafeUserScopeFiles(reach).execute(recorded, tool);

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

describe("a profile that declares no plugins at all", () => {
  const noPlugins = { ...registeredTools().aiProfile(TOOL.cursor), plugins: () => null };

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
});
