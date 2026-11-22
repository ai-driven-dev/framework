import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { removeProjectHooks } from "../../../../../src/contexts/installation/application/shared/remove-project-hooks.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

import {
  HOOKS_PATH,
  hooksFile,
  OTHER,
  PLUGIN,
  PROJECT_ROOT,
  aCursorHooksPlugin as plugin,
  SCRIPT_PATH,
} from "../../testing/project-hooks-removal.builder.js";

const { cursor } = TOOL;

describe("removeProjectHooks refuses what it cannot prove", () => {
  it.each([
    ["entries", {}],
    ["scripts", {}],
    ["entries", { overwriteEdited: true }],
    ["scripts", { overwriteEdited: true }],
  ] as const)(
    "refuses a legacy install with only %s present, guard %o, before changing any files",
    async (present, guard) => {
      const content = hooksFile(PLUGIN);
      const fs = new InMemoryFileAdapter(
        present === "entries" ? { [HOOKS_PATH]: content } : { [SCRIPT_PATH]: "legacy" }
      );
      const legacy = RecordedPlugin.fromJSON({ ...plugin().toJSON(), projectHooks: undefined });

      await expect(
        removeProjectHooks({
          fs,
          plugin: legacy,
          tool: registeredTools().aiProfile(cursor),
          projectRoot: PROJECT_ROOT,
          guard,
        })
      ).rejects.toThrow(
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
      const invalid = RecordedPlugin.fromJSON({
        ...installed,
        projectHooks: {
          entries: installed.projectHooks?.entries ?? [],
          scripts: { [`.cursor/hooks/${PLUGIN}/pre.js`]: digest },
        },
      });

      await expect(
        removeProjectHooks({
          fs,
          plugin: invalid,
          tool: registeredTools().aiProfile(cursor),
          projectRoot: PROJECT_ROOT,
        })
      ).rejects.toThrow(
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
    const invalid = RecordedPlugin.fromJSON({
      ...installed,
      projectHooks: {
        entries: installed.projectHooks?.entries ?? [],
        scripts: { [path]: FileHash.of(script).value },
      },
    });

    await expect(
      removeProjectHooks({
        fs,
        plugin: invalid,
        tool: registeredTools().aiProfile(cursor),
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(`Cursor hook script path '${path}' has unproven provenance; detach refused.`);

    expect(fs.getFile(HOOKS_PATH)).toBe(content);
    expect(fs.getFile(join(PROJECT_ROOT, path))).toBe(script);
  });

  it.each([".cursor/hooks/aidd-dev/pre.js", "/foreign/pre.js"])(
    "still refuses an unproven recorded script path %s when told to overwrite edits",
    async (path) => {
      const script = "installed script";
      const fs = new InMemoryFileAdapter({
        [HOOKS_PATH]: hooksFile(PLUGIN),
        [join(PROJECT_ROOT, path)]: script,
      });
      const installed = plugin({ entry: true }).toJSON();
      const invalid = RecordedPlugin.fromJSON({
        ...installed,
        projectHooks: {
          entries: installed.projectHooks?.entries ?? [],
          scripts: { [path]: FileHash.of(script).value },
        },
      });

      await expect(
        removeProjectHooks({
          fs,
          plugin: invalid,
          tool: registeredTools().aiProfile(cursor),
          projectRoot: PROJECT_ROOT,
          guard: {
            overwriteEdited: true,
          },
        })
      ).rejects.toThrow(`Cursor hook script path '${path}' has unproven provenance`);

      expect(fs.getFile(join(PROJECT_ROOT, path))).toBe(script);
    }
  );

  it("refuses an unproven entry digest even when told to overwrite edits", async () => {
    const installed = plugin({ entry: true }).toJSON();
    const invalid = RecordedPlugin.fromJSON({
      ...installed,
      projectHooks: {
        entries: (installed.projectHooks?.entries ?? []).map((e) => ({ ...e, digest: "x" })),
        scripts: {},
      },
    });
    const fs = new InMemoryFileAdapter({ [HOOKS_PATH]: hooksFile(PLUGIN) });

    await expect(
      removeProjectHooks({
        fs,
        plugin: invalid,
        tool: registeredTools().aiProfile(cursor),
        projectRoot: PROJECT_ROOT,
        guard: {
          overwriteEdited: true,
        },
      })
    ).rejects.toThrow(`Cursor project hooks for '${PLUGIN}' have an unproven install digest`);
  });

  it("refuses a hooks.json symlink outside the project even when its entries match the install digest", async () => {
    const content = hooksFile(PLUGIN, OTHER);
    const foreignPath = "/foreign/hooks.json";
    const fs = new InMemoryFileAdapter({ [HOOKS_PATH]: content, [foreignPath]: content });
    fs.setSymlink(HOOKS_PATH, foreignPath);
    const write = vi.spyOn(fs, "writeFile");
    const remove = vi.spyOn(fs, "deleteFile");

    await expect(
      removeProjectHooks({
        fs,
        plugin: plugin({ entry: true }),
        tool: registeredTools().aiProfile(cursor),
        projectRoot: PROJECT_ROOT,
      })
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
      removeProjectHooks({
        fs,
        plugin: plugin({ script }),
        tool: registeredTools().aiProfile(cursor),
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(/outside.*project|escapes.*project/);

    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(fs.getFile(foreignPath)).toBe(script);
  });

  it("refuses a legacy hook with no install digest instead of deleting by plugin name", async () => {
    const fs = new InMemoryFileAdapter({
      [HOOKS_PATH]: hooksFile(PLUGIN),
      [SCRIPT_PATH]: "legacy",
    });
    const legacy = RecordedPlugin.fromJSON({
      name: PLUGIN,
      source: { kind: "local", path: "/src" },
      version: "1.0.0",
      strict: false,
      files: {},
      scope: "user",
    });
    await expect(
      removeProjectHooks({
        fs,
        plugin: legacy,
        tool: registeredTools().aiProfile(cursor),
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(/unproven/);
    expect(fs.getFile(HOOKS_PATH)).toBe(hooksFile(PLUGIN));
    expect(fs.getFile(SCRIPT_PATH)).toBe("legacy");
  });
});
