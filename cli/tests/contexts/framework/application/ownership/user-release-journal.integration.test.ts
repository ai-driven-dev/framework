import "../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { UserReleaseJournal } from "../../../../../src/contexts/framework/application/ownership/release/user-release-journal.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import { UserManifestRepositoryAdapter } from "../../../../../src/contexts/framework/infrastructure/user-manifest-repository-adapter.js";
import { UserReleaseJournalStoreAdapter } from "../../../../../src/contexts/framework/infrastructure/user-release-journal-store.js";
import { InstallationFile } from "../../../../../src/kernel/file.js";
import { atomicWriteFile } from "../../../../../src/runtime/filesystem/atomic-write.js";
import { FileAdapter } from "../../../../../src/runtime/filesystem/file-adapter.js";
import { HasherAdapter } from "../../../../../src/runtime/filesystem/hasher-adapter.js";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

class InterruptingFiles extends FileAdapter {
  stop = false;
  afterWrite?: (path: string) => Promise<void>;
  override async writeFile(path: string, content: string): Promise<void> {
    if (this.stop && path.endsWith("b.md")) {
      this.stop = false;
      throw new Error("interrupted");
    }
    await super.writeFile(path, content);
    await this.afterWrite?.(path);
  }
}

async function fixture() {
  const home = await mkdtemp(join(tmpdir(), "aidd-release-journal-"));
  dirs.push(home);
  const root = join(home, ".config", "opencode");
  await mkdir(join(root, "skills"), { recursive: true });
  await writeFile(join(root, "skills/a.md"), "old");
  const hasher = new HasherAdapter();
  const fs = new InterruptingFiles(hasher);
  const repo = new UserManifestRepositoryAdapter(() => join(home, ".config/aidd"), atomicWriteFile);
  const source = {
    kind: "git-subdir",
    url: "https://github.com/ai-driven-dev/framework.git",
    path: "plugins/aidd-context",
    ref: "v5.12.0",
  } as const;
  const plugin = InstalledPlugin.fromMetadata(
    "aidd-context",
    "2.9.0",
    source,
    false,
    "user",
    "aidd-framework"
  ).withFiles(new Map([["skills/a.md", hasher.hash("old").value]]));
  const old = Manifest.create();
  old.addTool("opencode", "5.0.0", []);
  old.addPlugin("opencode", plugin);
  await repo.save(old);
  const a = new InstallationFile({
    relativePath: "skills/a.md",
    content: "new",
    hash: hasher.hash("new"),
  });
  const b = new InstallationFile({
    relativePath: "skills/b.md",
    content: "added",
    hash: hasher.hash("added"),
  });
  const next = Manifest.fromJSON(old.toJSON());
  next.updatePlugin(
    "opencode",
    plugin.withVersion("2.10.0").withFiles(
      new Map([
        [a.relativePath, a.hash.value],
        [b.relativePath, b.hash.value],
      ])
    )
  );
  return {
    home,
    root,
    fs,
    repo,
    old,
    next,
    files: [a, b],
    journal: new UserReleaseJournal(fs, hasher, repo, {
      home: () => home,
      store: new UserReleaseJournalStoreAdapter(() => repo.path),
    }),
  };
}

describe("machine release journal", () => {
  it("finishes an interrupted update using only recorded old or new contents", async () => {
    const f = await fixture();
    f.fs.stop = true;
    await expect(
      f.journal.commit(f.old, f.next, "opencode", "aidd-context", f.files)
    ).rejects.toThrow("interrupted");
    expect(await readFile(join(f.root, "skills/a.md"), "utf8")).toBe("new");
    expect((await f.repo.load())?.getPlugins("opencode")[0]?.version).toBe("2.9.0");
    await f.journal.recover();
    expect(await readFile(join(f.root, "skills/b.md"), "utf8")).toBe("added");
    expect((await f.repo.load())?.getPlugins("opencode")[0]?.version).toBe("2.10.0");
    expect(await f.fs.fileExists(`${f.repo.path}.release-journal`)).toBe(false);
  });
  it("leaves later user edits untouched and refuses the entire recovery", async () => {
    const f = await fixture();
    f.fs.stop = true;
    await expect(
      f.journal.commit(f.old, f.next, "opencode", "aidd-context", f.files)
    ).rejects.toThrow("interrupted");
    await writeFile(join(f.root, "skills/a.md"), "user edit");
    await expect(f.journal.recover()).rejects.toThrow("changed during release update");
    expect(await readFile(join(f.root, "skills/a.md"), "utf8")).toBe("user edit");
    expect(await f.fs.fileExists(join(f.root, "skills/b.md"))).toBe(false);
  });
  it("refuses to claim an existing untracked target even if its bytes match", async () => {
    const f = await fixture();
    await writeFile(join(f.root, "skills/b.md"), "added");
    await expect(
      f.journal.commit(f.old, f.next, "opencode", "aidd-context", f.files)
    ).rejects.toThrow("changed during release update");
    expect(await readFile(join(f.root, "skills/a.md"), "utf8")).toBe("old");
    expect(await f.fs.fileExists(`${f.repo.path}.release-journal`)).toBe(false);
  });

  it("refuses a journal replaced with a symlink", async () => {
    const f = await fixture();
    f.fs.stop = true;
    await expect(
      f.journal.commit(f.old, f.next, "opencode", "aidd-context", f.files)
    ).rejects.toThrow("interrupted");
    const path = `${f.repo.path}.release-journal`;
    const content = await readFile(path, "utf8");
    const foreign = join(f.home, "foreign");
    await writeFile(foreign, content, { mode: 0o600 });
    await rm(path);
    await symlink(foreign, path);
    await expect(f.journal.recover()).rejects.toThrow();
    expect(await readFile(foreign, "utf8")).toBe(content);
    expect(await f.fs.fileExists(join(f.root, "skills/b.md"))).toBe(false);
  });

  it.skipIf(process.platform === "win32")(
    "refuses a journal readable by another user",
    async () => {
      const f = await fixture();
      f.fs.stop = true;
      await expect(
        f.journal.commit(f.old, f.next, "opencode", "aidd-context", f.files)
      ).rejects.toThrow("interrupted");
      await chmod(`${f.repo.path}.release-journal`, 0o644);
      await expect(f.journal.recover()).rejects.toThrow("not a private owned file");
      expect(await f.fs.fileExists(join(f.root, "skills/b.md"))).toBe(false);
    }
  );

  it("refuses a tampered relative path before writing outside the tool root", async () => {
    const f = await fixture();
    f.fs.stop = true;
    await expect(
      f.journal.commit(f.old, f.next, "opencode", "aidd-context", f.files)
    ).rejects.toThrow("interrupted");
    const path = `${f.repo.path}.release-journal`;
    const original = await readFile(path, "utf8");
    await writeFile(path, original.replace('"path":"skills/b.md"', '"path":"../outside.md"'));
    await expect(f.journal.recover()).rejects.toThrow("Invalid user release journal file");
    expect(await f.fs.fileExists(join(f.home, ".config/outside.md"))).toBe(false);
  });

  it("does not discard a manifest edit made while files were being written", async () => {
    const f = await fixture();
    f.fs.afterWrite = async (path) => {
      if (!path.endsWith("a.md")) return;
      const changed = Manifest.fromJSON(f.old.toJSON());
      changed.addTool("kilo", "5.0.0", []);
      await f.repo.save(changed);
      f.fs.afterWrite = undefined;
    };
    await expect(
      f.journal.commit(f.old, f.next, "opencode", "aidd-context", f.files)
    ).rejects.toThrow("Machine manifest changed");
    expect((await f.repo.load())?.hasTool("kilo")).toBe(true);
    expect(await f.fs.fileExists(`${f.repo.path}.release-journal`)).toBe(true);
  });

  it("removes obsolete owned files while retaining the target files and manifest", async () => {
    const f = await fixture();
    const plugin = f.next.getPlugins("opencode")[0];
    const added = f.files[1];
    f.next.updatePlugin(
      "opencode",
      plugin.withFiles(new Map([[added.relativePath, added.hash.value]]))
    );
    await f.journal.commit(f.old, f.next, "opencode", "aidd-context", [added]);
    expect(await f.fs.fileExists(join(f.root, "skills/a.md"))).toBe(false);
    expect(await readFile(join(f.root, "skills/b.md"), "utf8")).toBe("added");
    expect((await f.repo.load())?.getPlugins("opencode")[0]?.files).toEqual(
      new Map([[added.relativePath, added.hash.value]])
    );
    expect(await f.fs.fileExists(`${f.repo.path}.release-journal`)).toBe(false);
  });

  it("refuses a file also claimed by another machine plugin", async () => {
    const f = await fixture();
    const claimed = InstalledPlugin.fromJSON({
      ...f.old.getPlugins("opencode")[0].toJSON(),
      name: "another-plugin",
    });
    f.old.addPlugin("opencode", claimed);
    f.next.addPlugin("opencode", claimed);
    await f.repo.save(f.old);
    await expect(
      f.journal.commit(f.old, f.next, "opencode", "aidd-context", f.files)
    ).rejects.toThrow("ownership or digest mismatch");
    expect(await readFile(join(f.root, "skills/a.md"), "utf8")).toBe("old");
    expect(await f.fs.fileExists(join(f.root, "skills/b.md"))).toBe(false);
    expect(await f.fs.fileExists(`${f.repo.path}.release-journal`)).toBe(false);
  });

  it("refuses tampered target bytes before resuming an interrupted update", async () => {
    const f = await fixture();
    f.fs.stop = true;
    await expect(
      f.journal.commit(f.old, f.next, "opencode", "aidd-context", f.files)
    ).rejects.toThrow("interrupted");
    const path = `${f.repo.path}.release-journal`;
    const original = await readFile(path, "utf8");
    await writeFile(path, original.replace('"content":"added"', '"content":"tampered"'));
    await expect(f.journal.recover()).rejects.toThrow("ownership or digest mismatch");
    expect(await readFile(join(f.root, "skills/a.md"), "utf8")).toBe("new");
    expect(await f.fs.fileExists(join(f.root, "skills/b.md"))).toBe(false);
    expect((await f.repo.load())?.getPlugins("opencode")[0]?.version).toBe("2.9.0");
  });

  it.each([null, [], "not an object"])(
    "refuses a corrupted journal root without modifying owned files: %s",
    async (value) => {
      const f = await fixture();
      f.fs.stop = true;
      await expect(
        f.journal.commit(f.old, f.next, "opencode", "aidd-context", f.files)
      ).rejects.toThrow("interrupted");
      await writeFile(`${f.repo.path}.release-journal`, JSON.stringify(value));
      await expect(f.journal.recover()).rejects.toThrow("Invalid user release journal");
      expect(await readFile(join(f.root, "skills/a.md"), "utf8")).toBe("new");
      expect(await f.fs.fileExists(join(f.root, "skills/b.md"))).toBe(false);
      expect((await f.repo.load())?.getPlugins("opencode")[0]?.version).toBe("2.9.0");
    }
  );

  it.each([
    { field: "tool", value: "unknown-tool" },
    { field: "tool", value: null },
    { field: "plugin", value: "../other" },
    { field: "plugin", value: null },
    { field: "boundary", value: null },
    { field: "files", value: null },
  ])("rejects a malformed journal $field before applying it", async ({ field, value }) => {
    const f = await fixture();
    f.fs.stop = true;
    await expect(
      f.journal.commit(f.old, f.next, "opencode", "aidd-context", f.files)
    ).rejects.toThrow("interrupted");
    const path = `${f.repo.path}.release-journal`;
    const journal: Record<string, unknown> = JSON.parse(await readFile(path, "utf8"));
    journal[field] = value;
    await writeFile(path, JSON.stringify(journal));
    await expect(f.journal.recover()).rejects.toThrow("Invalid user release journal");
    expect(await f.fs.fileExists(join(f.root, "skills/b.md"))).toBe(false);
    expect((await f.repo.load())?.getPlugins("opencode")[0]?.version).toBe("2.9.0");
  });

  it.each([
    { field: "path", value: "/outside.md" },
    { field: "path", value: "skills\\outside.md" },
    { field: "path", value: "./skills/b.md" },
    { field: "path", value: "." },
    { field: "path", value: null },
    { field: "before", value: "not-a-hash" },
    { field: "after", value: "not-a-hash" },
    { field: "content", value: 42 },
    { field: "after", value: null },
    { field: "content", value: null },
  ])("rejects a malformed journal file $field before applying it", async ({ field, value }) => {
    const f = await fixture();
    f.fs.stop = true;
    await expect(
      f.journal.commit(f.old, f.next, "opencode", "aidd-context", f.files)
    ).rejects.toThrow("interrupted");
    const path = `${f.repo.path}.release-journal`;
    const journal: { files: Record<string, unknown>[] } = JSON.parse(await readFile(path, "utf8"));
    journal.files[1][field] = value;
    await writeFile(path, JSON.stringify(journal));
    await expect(f.journal.recover()).rejects.toThrow("Invalid user release journal file");
    expect(await f.fs.fileExists(join(f.root, "skills/b.md"))).toBe(false);
    expect((await f.repo.load())?.getPlugins("opencode")[0]?.version).toBe("2.9.0");
  });

  it("does not start another release while a journal needs recovery", async () => {
    const f = await fixture();
    f.fs.stop = true;
    await expect(
      f.journal.commit(f.old, f.next, "opencode", "aidd-context", f.files)
    ).rejects.toThrow("interrupted");
    await expect(
      f.journal.commit(f.old, f.next, "opencode", "aidd-context", f.files)
    ).rejects.toThrow("needs recovery first");
    expect(await f.fs.fileExists(join(f.root, "skills/b.md"))).toBe(false);
  });

  it("refuses a release that changes another tool's ownership", async () => {
    const f = await fixture();
    f.next.addTool("kilo", "5.0.0", []);
    await expect(
      f.journal.commit(f.old, f.next, "opencode", "aidd-context", f.files)
    ).rejects.toThrow("changes other machine ownership");
    expect(await readFile(join(f.root, "skills/a.md"), "utf8")).toBe("old");
    expect(await f.fs.fileExists(`${f.repo.path}.release-journal`)).toBe(false);
  });

  it("refuses a changed machine directory before resuming a journal", async () => {
    const f = await fixture();
    f.fs.stop = true;
    await expect(
      f.journal.commit(f.old, f.next, "opencode", "aidd-context", f.files)
    ).rejects.toThrow("interrupted");
    const path = `${f.repo.path}.release-journal`;
    const journal: { boundary: string } = JSON.parse(await readFile(path, "utf8"));
    journal.boundary = join(f.home, "other-directory");
    await writeFile(path, JSON.stringify(journal));
    await expect(f.journal.recover()).rejects.toThrow("Machine directory changed");
    expect(await f.fs.fileExists(join(f.root, "skills/b.md"))).toBe(false);
  });

  it.each(["duplicate", "missing", "mismatched bytes"])(
    "rejects %s target files before writing a journal",
    async (mode) => {
      const f = await fixture();
      const files =
        mode === "duplicate"
          ? [f.files[0], f.files[0], f.files[1]]
          : mode === "missing"
            ? [f.files[0]]
            : [
                new InstallationFile({
                  relativePath: f.files[0].relativePath,
                  content: "not the planned content",
                  hash: f.files[0].hash,
                }),
                f.files[1],
              ];
      await expect(
        f.journal.commit(f.old, f.next, "opencode", "aidd-context", files)
      ).rejects.toThrow(
        mode === "mismatched bytes" ? "Unverified target file" : "Duplicate or missing"
      );
      expect(await readFile(join(f.root, "skills/a.md"), "utf8")).toBe("old");
      expect(await f.fs.fileExists(`${f.repo.path}.release-journal`)).toBe(false);
    }
  );
});
