import "../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  assertProjectHooksRemovable,
  assertProjectHooksUnchanged,
  removeProjectHooks,
} from "../../../../../src/contexts/framework/application/shared/remove-project-hooks.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import {
  errnoError,
  FaultingFileAdapter,
} from "../../../../helpers/ports/faulting-file-adapter.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";

const PROJECT_ROOT = "/test-project";
const PLUGIN = "aidd-context";
const OTHER = "aidd-dev";
const HOOKS_PATH = join(PROJECT_ROOT, ".cursor", "hooks.json");
const SCRIPT_PATH = join(PROJECT_ROOT, ".cursor", "hooks", PLUGIN, "pre.js");

function entry(plugin: string): { command: string } {
  return { command: `node ./.cursor/hooks/${plugin}/pre.js` };
}

function hooksFile(...plugins: string[]): string {
  return JSON.stringify({ version: 1, hooks: { preToolUse: plugins.map(entry) } });
}

function plugin(options: { entry?: boolean; script?: string } = {}): InstalledPlugin {
  const command = entry(PLUGIN).command;
  return InstalledPlugin.fromJSON({
    name: PLUGIN,
    source: { kind: "local", path: "/src" },
    version: "1.0.0",
    strict: false,
    files: {},
    scope: "user",
    projectHooks: {
      entries: options.entry
        ? [
            {
              event: "preToolUse",
              command,
              digest: createHash("md5")
                .update(JSON.stringify(entry(PLUGIN)))
                .digest("hex"),
            },
          ]
        : [],
      scripts:
        options.script === undefined
          ? {}
          : {
              [`.cursor/hooks/${PLUGIN}/pre.js`]: createHash("md5")
                .update(options.script)
                .digest("hex"),
            },
    },
  });
}

describe("removeProjectHooks", () => {
  it.each(["entries", "scripts"] as const)(
    "refuses a legacy install with only %s present before changing any files",
    async (present) => {
      const content = hooksFile(PLUGIN);
      const fs = new InMemoryFileAdapter(
        present === "entries" ? { [HOOKS_PATH]: content } : { [SCRIPT_PATH]: "legacy" }
      );
      const legacy = InstalledPlugin.fromJSON({ ...plugin().toJSON(), projectHooks: undefined });

      await expect(removeProjectHooks(fs, legacy, "cursor", PROJECT_ROOT)).rejects.toThrow(
        `Cursor project hooks for '${PLUGIN}' have an unproven legacy install digest; detach refused.`
      );

      expect(fs.getFile(HOOKS_PATH)).toBe(present === "entries" ? content : undefined);
      expect(fs.getFile(SCRIPT_PATH)).toBe(present === "scripts" ? "legacy" : undefined);
    }
  );

  it.each(["not-a-digest", `x${"a".repeat(32)}`, `${"a".repeat(32)}x`])(
    "refuses an unproven script digest %s before unmerging verified entries",
    async (digest) => {
      const script = "installed script";
      const content = hooksFile(PLUGIN, OTHER);
      const fs = new InMemoryFileAdapter({ [HOOKS_PATH]: content, [SCRIPT_PATH]: script });
      const installed = plugin({ entry: true }).toJSON();
      const invalid = InstalledPlugin.fromJSON({
        ...installed,
        projectHooks: {
          entries: installed.projectHooks?.entries ?? [],
          scripts: { [`.cursor/hooks/${PLUGIN}/pre.js`]: digest },
        },
      });

      await expect(removeProjectHooks(fs, invalid, "cursor", PROJECT_ROOT)).rejects.toThrow(
        `Cursor hook script '.cursor/hooks/${PLUGIN}/pre.js' has an unproven install digest; detach refused.`
      );

      expect(fs.getFile(HOOKS_PATH)).toBe(content);
      expect(fs.getFile(SCRIPT_PATH)).toBe(script);
    }
  );

  it.each([
    ".cursor/hooks/aidd-dev/pre.js",
    "/foreign/pre.js",
    ".cursor/hooks/aidd-context/../aidd-dev/pre.js",
    ".cursor/hooks/aidd-context/./pre.js",
    ".cursor/hooks/aidd-context/nested\\pre.js",
  ])("refuses an unproven recorded script path %s before unmerging hooks", async (path) => {
    const content = hooksFile(PLUGIN, OTHER);
    const script = "installed script";
    const fs = new InMemoryFileAdapter({
      [HOOKS_PATH]: content,
      [join(PROJECT_ROOT, path)]: script,
    });
    const installed = plugin({ entry: true }).toJSON();
    const invalid = InstalledPlugin.fromJSON({
      ...installed,
      projectHooks: {
        entries: installed.projectHooks?.entries ?? [],
        scripts: { [path]: createHash("md5").update(script).digest("hex") },
      },
    });

    await expect(removeProjectHooks(fs, invalid, "cursor", PROJECT_ROOT)).rejects.toThrow(
      `Cursor hook script path '${path}' has unproven provenance; detach refused.`
    );

    expect(fs.getFile(HOOKS_PATH)).toBe(content);
    expect(fs.getFile(join(PROJECT_ROOT, path))).toBe(script);
  });

  it.each([
    '{ "version": 1, "hooks": {} }',
    '{ "version": 1 }',
    JSON.stringify({ hooks: { preToolUse: [{ command: 42 }, entry(OTHER)] } }),
  ])("preserves a hooks file with no contribution byte-for-byte: %s", async (content) => {
    const fs = new InMemoryFileAdapter({ [HOOKS_PATH]: content });

    expect(await removeProjectHooks(fs, plugin(), "cursor", PROJECT_ROOT)).toBe(false);

    expect(fs.getFile(HOOKS_PATH)).toBe(content);
  });

  it("preflights reordered recorded entries without changing hooks or scripts", async () => {
    const first = { ...entry(PLUGIN), timeout: 25 };
    const second = { command: `node ./.cursor/hooks/${PLUGIN}/post.js` };
    const content = JSON.stringify({
      hooks: { postToolUse: [second], preToolUse: [entry(OTHER), first] },
    });
    const fs = new InMemoryFileAdapter({ [HOOKS_PATH]: content, [SCRIPT_PATH]: "script" });
    const installed = InstalledPlugin.fromJSON({
      ...plugin().toJSON(),
      projectHooks: {
        entries: [
          {
            event: "preToolUse",
            command: first.command,
            digest: createHash("md5").update(JSON.stringify(first)).digest("hex"),
          },
          {
            event: "postToolUse",
            command: second.command,
            digest: createHash("md5").update(JSON.stringify(second)).digest("hex"),
          },
        ],
        scripts: {},
      },
    });

    await expect(
      assertProjectHooksRemovable(fs, installed, "cursor", PROJECT_ROOT)
    ).resolves.toBeUndefined();
    await expect(
      assertProjectHooksUnchanged(fs, PLUGIN, installed.projectHooks, "cursor", PROJECT_ROOT)
    ).resolves.toStrictEqual({ existing: content });

    expect(fs.getFile(HOOKS_PATH)).toBe(content);
    expect(fs.getFile(SCRIPT_PATH)).toBe("script");
    expect(await removeProjectHooks(fs, installed, "cursor", PROJECT_ROOT)).toBe(true);
    expect(JSON.parse(fs.getFile(HOOKS_PATH) ?? "null").hooks).toStrictEqual({
      preToolUse: [entry(OTHER)],
    });
  });

  it("refuses a removed recorded entry before removing its script", async () => {
    const content = hooksFile(OTHER);
    const script = "installed script";
    const fs = new InMemoryFileAdapter({ [HOOKS_PATH]: content, [SCRIPT_PATH]: script });

    await expect(
      assertProjectHooksRemovable(fs, plugin({ entry: true, script }), "cursor", PROJECT_ROOT)
    ).rejects.toThrow(/edited after install/);

    expect(fs.getFile(HOOKS_PATH)).toBe(content);
    expect(fs.getFile(SCRIPT_PATH)).toBe(script);
  });

  it("does not recreate a tracked script already removed by the user", async () => {
    const content = hooksFile(OTHER);
    const fs = new InMemoryFileAdapter({ [HOOKS_PATH]: content });

    expect(
      await removeProjectHooks(fs, plugin({ script: "installed script" }), "cursor", PROJECT_ROOT)
    ).toBe(false);

    expect(fs.getFile(HOOKS_PATH)).toBe(content);
    expect(fs.getFile(SCRIPT_PATH)).toBeUndefined();
  });

  it("allows a legacy install with no project contribution and returns the existing hooks during preflight", async () => {
    const content = hooksFile(OTHER);
    const fs = new InMemoryFileAdapter({ [HOOKS_PATH]: content });

    await expect(
      assertProjectHooksUnchanged(fs, PLUGIN, undefined, "cursor", PROJECT_ROOT)
    ).resolves.toStrictEqual({ existing: content });
    await expect(
      assertProjectHooksUnchanged(fs, PLUGIN, undefined, "opencode", PROJECT_ROOT)
    ).resolves.toStrictEqual({ existing: null });

    expect(fs.getFile(HOOKS_PATH)).toBe(content);
  });
  it("refuses a hooks.json symlink outside the project even when its entries match the install digest", async () => {
    const content = hooksFile(PLUGIN, OTHER);
    const foreignPath = "/foreign/hooks.json";
    const fs = new InMemoryFileAdapter({ [HOOKS_PATH]: content, [foreignPath]: content });
    fs.setSymlink(HOOKS_PATH, foreignPath);
    const write = vi.spyOn(fs, "writeFile");
    const remove = vi.spyOn(fs, "deleteFile");

    await expect(
      removeProjectHooks(fs, plugin({ entry: true }), "cursor", PROJECT_ROOT)
    ).rejects.toThrow(/outside.*project|escapes.*project/);

    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(fs.getFile(foreignPath)).toBe(content);
  });

  it("refuses a hook script parent symlink outside the project despite matching bytes and digest", async () => {
    const script = "module.exports = () => {};";
    const foreignDir = "/foreign/script-dir";
    const foreignPath = join(foreignDir, "pre.js");
    const fs = new InMemoryFileAdapter({
      [SCRIPT_PATH]: script,
      [foreignPath]: script,
    });
    fs.setSymlink(join(PROJECT_ROOT, ".cursor", "hooks", PLUGIN), foreignDir);
    const write = vi.spyOn(fs, "writeFile");
    const remove = vi.spyOn(fs, "deleteFile");

    await expect(
      removeProjectHooks(fs, plugin({ script }), "cursor", PROJECT_ROOT)
    ).rejects.toThrow(/outside.*project|escapes.*project/);

    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(fs.getFile(foreignPath)).toBe(script);
  });

  it("leaves a tool that keeps hooks in its plugin directory untouched and reports nothing undone", async () => {
    const fs = new InMemoryFileAdapter({ [HOOKS_PATH]: hooksFile(PLUGIN) });

    expect(await removeProjectHooks(fs, plugin({ entry: true }), "opencode", PROJECT_ROOT)).toBe(
      false
    );
    expect(fs.getFile(HOOKS_PATH)).toBe(hooksFile(PLUGIN));
  });

  it("reports nothing undone when neither the hooks file nor the script directory exists", async () => {
    const fs = new FaultingFileAdapter();
    fs.failOn("deleteDirectory", `${PROJECT_ROOT}/.cursor/hooks/${PLUGIN}/`, errnoError("EPERM"));

    expect(await removeProjectHooks(fs, plugin(), "cursor", PROJECT_ROOT)).toBe(false);
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

    const undone = await removeProjectHooks(
      fs,
      plugin({ entry: true, script }),
      "cursor",
      PROJECT_ROOT
    );

    expect(undone).toBe(true);
    expect(JSON.parse(fs.getFile(HOOKS_PATH) ?? "null")).toStrictEqual({
      version: 1,
      hooks: { preToolUse: [entry(OTHER)] },
    });
    expect(fs.getFile(SCRIPT_PATH)).toBeUndefined();
    expect(fs.getFile(notePath)).toBe("user note");
    expect(fs.getFile(otherScript)).toBe("other plugin script");
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
        removeProjectHooks(fs, plugin({ entry: true, script }), "cursor", PROJECT_ROOT)
      ).rejects.toThrow(/edited after install/);

      expect(fs.getFile(HOOKS_PATH)).toBe(current);
      expect(fs.getFile(SCRIPT_PATH)).toBe(script);
    }
  );

  it("removes the script directory and reports something undone when only the scripts exist", async () => {
    const script = "module.exports = () => {};";
    const fs = new InMemoryFileAdapter({ [SCRIPT_PATH]: script });

    const undone = await removeProjectHooks(fs, plugin({ script }), "cursor", PROJECT_ROOT);

    expect(undone).toBe(true);
    expect(fs.listAll()).toStrictEqual([]);
  });

  it("propagates a failure to read the hooks file other than its absence", async () => {
    const fs = new FaultingFileAdapter();
    fs.failOn("readFile", HOOKS_PATH, errnoError("EACCES"));

    await expect(removeProjectHooks(fs, plugin(), "cursor", PROJECT_ROOT)).rejects.toThrow(
      "EACCES: planted by the test"
    );
  });

  it("refuses a legacy hook with no install digest instead of deleting by plugin name", async () => {
    const fs = new InMemoryFileAdapter({
      [HOOKS_PATH]: hooksFile(PLUGIN),
      [SCRIPT_PATH]: "legacy",
    });
    const legacy = InstalledPlugin.fromJSON({
      name: PLUGIN,
      source: { kind: "local", path: "/src" },
      version: "1.0.0",
      strict: false,
      files: {},
      scope: "user",
    });
    await expect(removeProjectHooks(fs, legacy, "cursor", PROJECT_ROOT)).rejects.toThrow(
      /unproven/
    );
    expect(fs.getFile(HOOKS_PATH)).toBe(hooksFile(PLUGIN));
    expect(fs.getFile(SCRIPT_PATH)).toBe("legacy");
  });
});
