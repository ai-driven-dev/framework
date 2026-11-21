import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertScriptsNotUserOwned,
  type HooksDelivery,
  removeObsoleteScripts,
  writeProjectHookScripts,
} from "../../../../../src/contexts/installation/application/materialize/project-hook-scripts.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const PROJECT_ROOT = "/test-project";
const PLUGIN = "aidd-context";
const SCRIPT_RELATIVE = `.cursor/hooks/${PLUGIN}/pre.js`;
const SCRIPT_PATH = join(PROJECT_ROOT, SCRIPT_RELATIVE);

function delivery(options: {
  scripts?: readonly string[];
  previous?: ReadonlyMap<string, string>;
  overwriteEdited?: boolean;
}): HooksDelivery {
  const location = registeredTools().aiProfile(TOOL.cursor).projectHooksDelivery();
  if (location === null) throw new Error("cursor delivers project hooks");
  const hooks = (options.scripts ?? []).map((relativePath) => ({ relativePath, content: "code" }));
  const dist = new PluginDistribution({
    manifest: { name: PLUGIN, version: "1.0.0" },
    format: TOOL.claude,
    files: hooks,
    components: { commands: [], agents: [], rules: [], skills: [], hooks, mcp: [] },
  });
  return {
    dist,
    projectRoot: PROJECT_ROOT,
    location,
    previous: options.previous && { entries: [], scripts: options.previous },
    guard: { overwriteEdited: options.overwriteEdited },
  };
}

describe("assertScriptsNotUserOwned", () => {
  it("refuses a script already on disk that no earlier install recorded", async () => {
    const fs = new InMemoryFileAdapter({ [SCRIPT_PATH]: "user" });

    await expect(
      assertScriptsNotUserOwned(fs, delivery({ scripts: ["hooks/pre.js"] }))
    ).rejects.toThrow(/is user-owned; install refused/);
  });

  it("accepts a script an earlier install recorded", async () => {
    const fs = new InMemoryFileAdapter({ [SCRIPT_PATH]: "ours" });
    const previous = new Map([[SCRIPT_RELATIVE, FileHash.of("ours").value]]);

    await expect(
      assertScriptsNotUserOwned(fs, delivery({ scripts: ["hooks/pre.js"], previous }))
    ).resolves.toBeUndefined();
  });
});

describe("writeProjectHookScripts", () => {
  it("writes each script beside the hooks file and returns its digest, skipping the manifest", async () => {
    const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);

    const written = await writeProjectHookScripts(
      fs,
      delivery({ scripts: ["hooks/hooks.json", "hooks/pre.js"] })
    );

    expect([...written.keys()]).toStrictEqual([SCRIPT_RELATIVE]);
    expect(written.get(SCRIPT_RELATIVE)).toBe(FileHash.of(fs.getFile(SCRIPT_PATH) ?? "").value);
  });
});

describe("removeObsoleteScripts", () => {
  const previous = new Map([[SCRIPT_RELATIVE, FileHash.of("ours").value]]);

  it("deletes a recorded script the new install no longer ships", async () => {
    const fs = new InMemoryFileAdapter({ [SCRIPT_PATH]: "ours" });

    await removeObsoleteScripts(fs, delivery({ previous }), new Map());

    expect(fs.getFile(SCRIPT_PATH)).toBeUndefined();
  });

  it("keeps a script the new install still ships", async () => {
    const fs = new InMemoryFileAdapter({ [SCRIPT_PATH]: "ours" });

    await removeObsoleteScripts(fs, delivery({ previous }), new Map([[SCRIPT_RELATIVE, "x"]]));

    expect(fs.getFile(SCRIPT_PATH)).toBe("ours");
  });

  it("refuses an edited script unless told to overwrite edits", async () => {
    const fs = new InMemoryFileAdapter({ [SCRIPT_PATH]: "edited" });

    await expect(removeObsoleteScripts(fs, delivery({ previous }), new Map())).rejects.toThrow(
      /was edited during reinstall; removal refused/
    );
    await removeObsoleteScripts(fs, delivery({ previous, overwriteEdited: true }), new Map());

    expect(fs.getFile(SCRIPT_PATH)).toBeUndefined();
  });
});
