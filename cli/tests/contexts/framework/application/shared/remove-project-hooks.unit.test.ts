import "../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { removeProjectHooks } from "../../../../../src/contexts/framework/application/shared/remove-project-hooks.js";
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

  it("unmerges only this plugin's entries and reports something undone when just the hooks file exists", async () => {
    const fs = new InMemoryFileAdapter({ [HOOKS_PATH]: hooksFile(PLUGIN, OTHER) });

    const undone = await removeProjectHooks(fs, plugin({ entry: true }), "cursor", PROJECT_ROOT);

    expect(undone).toBe(true);
    expect(JSON.parse(fs.getFile(HOOKS_PATH) ?? "null")).toStrictEqual({
      version: 1,
      hooks: { preToolUse: [entry(OTHER)] },
    });
  });

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
