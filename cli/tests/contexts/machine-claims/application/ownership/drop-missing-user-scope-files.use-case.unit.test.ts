import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DropMissingUserScopeFiles } from "../../../../../src/contexts/machine-claims/application/ownership/drop-missing-user-scope-files.use-case.js";
import type { UserScopeReach } from "../../../../../src/contexts/machine-claims/application/ownership/user-scope-boundary.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
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

const withoutMissingFiles = (
  reach: UserScopeReach,
  recorded: MachinePlugin,
  tool: Parameters<DropMissingUserScopeFiles["execute"]>[1]
) => new DropMissingUserScopeFiles(reach).execute(recorded, tool);

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

describe("a profile that declares no plugins at all", () => {
  const noPlugins = { ...registeredTools().aiProfile(TOOL.cursor), plugins: () => null };

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
});
