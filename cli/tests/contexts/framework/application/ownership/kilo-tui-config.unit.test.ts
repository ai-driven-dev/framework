import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  planKiloTuiInstall,
  planKiloTuiRemoval,
} from "../../../../../src/contexts/framework/application/ownership/tui/kilo-tui-config.js";
import { FileAdapter } from "../../../../../src/runtime/filesystem/file-adapter.js";
import { HasherAdapter } from "../../../../../src/runtime/filesystem/hasher-adapter.js";

const dirs: string[] = [];
const fs = new FileAdapter(new HasherAdapter());

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "kilo-tui-"));
  dirs.push(root);
  const dir = join(root, ".kilo");
  await mkdir(dir);
  return { root, dir };
}
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("Kilo TUI shared configuration", () => {
  it("preserves comments, other plugins and unrelated settings through install and removal", async () => {
    const { root, dir } = await fixture();
    const path = join(dir, "tui.jsonc");
    await writeFile(
      path,
      '{\n  // User plugins\n  "plugin": ["./one.js", "./two.js"],\n  /* preferences */ "theme": "dark",\n}\n'
    );
    const installed = await planKiloTuiInstall(fs, dir, root);
    expect(installed.content).toContain("// User plugins");
    expect(installed.content).toContain("/* preferences */");
    expect(installed.content).toContain('"./one.js"');
    expect(installed.content).toContain('"./two.js"');
    await writeFile(path, installed.content);
    const removed = await planKiloTuiRemoval(fs, dir, root, installed.provenance);
    expect(removed.content).toContain("// User plugins");
    expect(removed.content).toContain("/* preferences */");
    expect(removed.content).toContain('"./one.js"');
    expect(removed.content).toContain('"./two.js"');
    expect(removed.content).not.toContain("aidd-maintenance");
  });

  it("refuses unowned entries and later manual removal", async () => {
    const { root, dir } = await fixture();
    const plan = await planKiloTuiInstall(fs, dir, root);
    await writeFile(plan.path, plan.content);
    await expect(planKiloTuiInstall(fs, dir, root)).rejects.toThrow("without ownership");
    await writeFile(plan.path, "{}\n");
    await expect(planKiloTuiInstall(fs, dir, root, plan.provenance)).rejects.toThrow("was removed");
  });

  it("refuses symlink escapes before reading or writing", async () => {
    const { root, dir } = await fixture();
    const outside = await mkdtemp(join(tmpdir(), "kilo-outside-"));
    dirs.push(outside);
    await writeFile(join(outside, "settings.json"), "{}");
    await symlink(join(outside, "settings.json"), join(dir, "tui.json"));
    await expect(planKiloTuiInstall(fs, dir, root)).rejects.toThrow("outside project root");
    expect(await readFile(join(outside, "settings.json"), "utf8")).toBe("{}");
  });
});
