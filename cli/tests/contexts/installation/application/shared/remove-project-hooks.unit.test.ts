import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assertProjectHooksUnchanged } from "../../../../../src/contexts/installation/application/shared/assert-project-hooks-unchanged.js";
import {
  assertProjectHooksRemovable,
  removeProjectHooks,
} from "../../../../../src/contexts/installation/application/shared/remove-project-hooks.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import {
  errnoError,
  FaultingFileAdapter,
} from "../../../../shared/testing/faulting-file-adapter.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { saying } from "../../../../shared/testing/saying.builder.js";

import {
  entry,
  HOOKS_PATH,
  hooksFile,
  OTHER,
  PLUGIN,
  PROJECT_ROOT,
  aCursorHooksPlugin as plugin,
  SCRIPT_PATH,
} from "../../testing/project-hooks-removal.builder.js";

const { cursor } = TOOL;

describe("removeProjectHooks", () => {
  it("removes an edited entry and an edited script when told to overwrite edits", async () => {
    const edited = JSON.stringify({
      version: 1,
      hooks: { preToolUse: [{ ...entry(PLUGIN), timeout: 99 }, entry(OTHER)] },
    });
    const fs = new InMemoryFileAdapter({ [HOOKS_PATH]: edited, [SCRIPT_PATH]: "user edit" });
    const installed = plugin({ entry: true, script: "installed script" });

    await expect(
      removeProjectHooks({
        fs,
        plugin: installed,
        tool: registeredTools().aiProfile(cursor),
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(saying(/edited after install; detach refused\. Rerun aidd sync --force/));
    expect(
      await removeProjectHooks({
        fs,
        plugin: installed,
        tool: registeredTools().aiProfile(cursor),
        projectRoot: PROJECT_ROOT,
        guard: {
          overwriteEdited: true,
        },
      })
    ).toBe(true);

    expect(JSON.parse(fs.getFile(HOOKS_PATH) ?? "null").hooks).toStrictEqual({
      preToolUse: [entry(OTHER)],
    });
    expect(fs.getFile(SCRIPT_PATH)).toBeUndefined();
  });

  it.each([
    '{ "version": 1, "hooks": {} }',
    '{ "version": 1 }',
    JSON.stringify({ hooks: { preToolUse: [{ command: 42 }, entry(OTHER)] } }),
    JSON.stringify({
      hooks: { preToolUse: [{ command: `node ./x/.cursor/hooks/${PLUGIN}/mine.sh` }] },
    }),
  ])("preserves a hooks file with no contribution byte-for-byte: %s", async (content) => {
    const fs = new InMemoryFileAdapter({ [HOOKS_PATH]: content });

    expect(
      await removeProjectHooks({
        fs,
        plugin: plugin(),
        tool: registeredTools().aiProfile(cursor),
        projectRoot: PROJECT_ROOT,
      })
    ).toBe(false);

    expect(fs.getFile(HOOKS_PATH)).toBe(content);
  });

  it("preflights reordered recorded entries without changing hooks or scripts", async () => {
    const first = { ...entry(PLUGIN), timeout: 25 };
    const second = { command: `node ./.cursor/hooks/${PLUGIN}/post.js` };
    const content = JSON.stringify({
      hooks: { postToolUse: [second], preToolUse: [entry(OTHER), first] },
    });
    const fs = new InMemoryFileAdapter({ [HOOKS_PATH]: content, [SCRIPT_PATH]: "script" });
    const installed = RecordedPlugin.fromJSON({
      ...plugin().toJSON(),
      projectHooks: {
        entries: [
          {
            event: "preToolUse",
            command: first.command,
            digest: FileHash.of(JSON.stringify(first)).value,
          },
          {
            event: "postToolUse",
            command: second.command,
            digest: FileHash.of(JSON.stringify(second)).value,
          },
        ],
        scripts: {},
      },
    });

    await expect(
      assertProjectHooksRemovable({
        fs,
        plugin: installed,
        tool: registeredTools().aiProfile(cursor),
        projectRoot: PROJECT_ROOT,
      })
    ).resolves.toBeUndefined();
    await expect(
      assertProjectHooksUnchanged({
        fs,
        pluginName: PLUGIN,
        provenance: installed.provenance.projectHooks,
        tool: registeredTools().aiProfile(cursor),
        projectRoot: PROJECT_ROOT,
      })
    ).resolves.toStrictEqual({ existing: content });

    expect(fs.getFile(HOOKS_PATH)).toBe(content);
    expect(fs.getFile(SCRIPT_PATH)).toBe("script");
    expect(
      await removeProjectHooks({
        fs,
        plugin: installed,
        tool: registeredTools().aiProfile(cursor),
        projectRoot: PROJECT_ROOT,
      })
    ).toBe(true);
    expect(JSON.parse(fs.getFile(HOOKS_PATH) ?? "null").hooks).toStrictEqual({
      preToolUse: [entry(OTHER)],
    });
  });

  it("refuses a removed recorded entry before removing its script", async () => {
    const content = hooksFile(OTHER);
    const script = "installed script";
    const fs = new InMemoryFileAdapter({ [HOOKS_PATH]: content, [SCRIPT_PATH]: script });

    await expect(
      assertProjectHooksRemovable({
        fs,
        plugin: plugin({ entry: true, script }),
        tool: registeredTools().aiProfile(cursor),
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(saying(/edited after install/));

    expect(fs.getFile(HOOKS_PATH)).toBe(content);
    expect(fs.getFile(SCRIPT_PATH)).toBe(script);
  });

  it("does not recreate a tracked script already removed by the user", async () => {
    const content = hooksFile(OTHER);
    const fs = new InMemoryFileAdapter({ [HOOKS_PATH]: content });

    expect(
      await removeProjectHooks({
        fs,
        plugin: plugin({ script: "installed script" }),
        tool: registeredTools().aiProfile(cursor),
        projectRoot: PROJECT_ROOT,
      })
    ).toBe(false);

    expect(fs.getFile(HOOKS_PATH)).toBe(content);
    expect(fs.getFile(SCRIPT_PATH)).toBeUndefined();
  });

  it("leaves a tool that keeps hooks in its plugin directory untouched and reports nothing undone", async () => {
    const fs = new InMemoryFileAdapter({ [HOOKS_PATH]: hooksFile(PLUGIN) });

    expect(
      await removeProjectHooks({
        fs,
        plugin: plugin({ entry: true }),
        tool: registeredTools().aiProfile(TOOL.opencode),
        projectRoot: PROJECT_ROOT,
      })
    ).toBe(false);
    expect(fs.getFile(HOOKS_PATH)).toBe(hooksFile(PLUGIN));
  });

  it("reports nothing undone when neither the hooks file nor the script directory exists", async () => {
    const fs = new FaultingFileAdapter({}, [PROJECT_ROOT]);
    fs.failOn("deleteDirectory", `${PROJECT_ROOT}/.cursor/hooks/${PLUGIN}/`, errnoError("EPERM"));

    expect(
      await removeProjectHooks({
        fs,
        plugin: plugin(),
        tool: registeredTools().aiProfile(cursor),
        projectRoot: PROJECT_ROOT,
      })
    ).toBe(false);
  });

  it("removes only recorded entries and scripts while preserving untracked files in the same plugin directory", async () => {
    const script = "module.exports = () => {};";
    const notePath = join(PROJECT_ROOT, ".cursor", "hooks", PLUGIN, "user-note.md");
    const otherScript = join(PROJECT_ROOT, ".cursor", "hooks", OTHER, "pre.js");
    const fs = new InMemoryFileAdapter({
      [HOOKS_PATH]: hooksFile(PLUGIN, OTHER),
      [SCRIPT_PATH]: script,
      [notePath]: "user note",
      [otherScript]: "other plugin script",
    });

    const undone = await removeProjectHooks({
      fs,
      plugin: plugin({ entry: true, script }),
      tool: registeredTools().aiProfile(cursor),
      projectRoot: PROJECT_ROOT,
    });

    expect(undone).toBe(true);
    expect(JSON.parse(fs.getFile(HOOKS_PATH) ?? "null")).toStrictEqual({
      version: 1,
      hooks: { preToolUse: [entry(OTHER)] },
    });
    expect(fs.getFile(SCRIPT_PATH)).toBeUndefined();
    expect(fs.getFile(notePath)).toBe("user note");
    expect(fs.getFile(otherScript)).toBe("other plugin script");
  });

  it("removes entries an older install wrote without a matcher, their digests still matching", async () => {
    const script = "module.exports = () => {};";
    const fs = new InMemoryFileAdapter({
      [HOOKS_PATH]: hooksFile(PLUGIN, OTHER),
      [SCRIPT_PATH]: script,
    });

    await removeProjectHooks({
      fs,
      plugin: plugin({ entry: true, script }),
      tool: registeredTools().aiProfile(cursor),
      projectRoot: PROJECT_ROOT,
    });

    expect(JSON.parse(fs.getFile(HOOKS_PATH) ?? "null")).toStrictEqual({
      version: 1,
      hooks: { preToolUse: [entry(OTHER)] },
    });
  });

  it.each(["metadata", "event"] as const)(
    "refuses changed hook %s despite an unchanged command, before deleting any tracked script",
    async (change) => {
      const script = "module.exports = () => {};";
      const current = JSON.stringify({
        version: 1,
        hooks: {
          [change === "event" ? "postToolUse" : "preToolUse"]: [
            change === "metadata" ? { ...entry(PLUGIN), timeout: 99 } : entry(PLUGIN),
            entry(OTHER),
          ],
        },
      });
      const fs = new InMemoryFileAdapter({
        [HOOKS_PATH]: current,
        [SCRIPT_PATH]: script,
      });

      await expect(
        removeProjectHooks({
          fs,
          plugin: plugin({ entry: true, script }),
          tool: registeredTools().aiProfile(cursor),
          projectRoot: PROJECT_ROOT,
        })
      ).rejects.toThrow(saying(/edited after install/));

      expect(fs.getFile(HOOKS_PATH)).toBe(current);
      expect(fs.getFile(SCRIPT_PATH)).toBe(script);
    }
  );

  it("removes the script directory and reports something undone when only the scripts exist", async () => {
    const script = "module.exports = () => {};";
    const fs = new InMemoryFileAdapter({ [SCRIPT_PATH]: script });

    const undone = await removeProjectHooks({
      fs,
      plugin: plugin({ script }),
      tool: registeredTools().aiProfile(cursor),
      projectRoot: PROJECT_ROOT,
    });

    expect(undone).toBe(true);
    expect(fs.listAll()).toStrictEqual([]);
  });

  it("propagates a failure to read the hooks file other than its absence", async () => {
    const fs = new FaultingFileAdapter({}, [PROJECT_ROOT]);
    fs.failOn("readFile", HOOKS_PATH, errnoError("EACCES"));

    await expect(
      removeProjectHooks({
        fs,
        plugin: plugin(),
        tool: registeredTools().aiProfile(cursor),
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow("EACCES: planted by the test");
  });
});
