import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  SESSION_TRAILER_HOOK_HEADER,
  SESSION_TRAILER_TOKEN,
  sessionTrailerHookLine,
} from "../../../src/contexts/telemetry/domain/formats/commit-session-trailer.js";
import { FileAdapter } from "../../../src/runtime/filesystem/file-adapter.js";
import { HasherAdapter } from "../../../src/runtime/filesystem/hasher-adapter.js";
import { GitAdapter } from "../../../src/runtime/git/git-adapter.js";
import { environmentWithoutGitVariables } from "../../../src/runtime/git/git-environment.js";

const DELEGATE = "aidd-session-trailer.sh";
const SCRIPT = "#!/bin/sh\necho delegate\n";
/** A mode bit is POSIX: on Windows `access(X_OK)` answers like `F_OK`. */
const MODE_BITS_UNOBSERVABLE = process.platform === "win32";

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args],
    { cwd, encoding: "utf8", env: environmentWithoutGitVariables() }
  );
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout.trim();
}

async function commit(root: string, message: string): Promise<void> {
  await writeFile(join(root, `${Math.random()}.txt`), "x");
  git(root, "add", ".");
  git(root, "commit", "-q", "-m", message);
}

describe("GitAdapter", () => {
  let root: string;
  let outside: string;
  let hooksDir: string;
  let adapter: GitAdapter;

  beforeEach(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), "aidd-git-adapter-")));
    outside = await realpath(await mkdtemp(join(tmpdir(), "aidd-git-adapter-outside-")));
    git(root, "init", "-q");
    hooksDir = join(root, ".git", "hooks");
    adapter = new GitAdapter(new FileAdapter(new HasherAdapter()));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  });

  describe("isRepository", () => {
    it("answers true inside a repository", async () => {
      expect(await adapter.isRepository(root)).toBe(true);
    });

    it("answers false outside one", async () => {
      expect(await adapter.isRepository(outside)).toBe(false);
    });
  });

  describe("listTrackedFiles", () => {
    it("lists the tracked paths matching the pathspec, relative to the root", async () => {
      await mkdir(join(root, "aidd_docs", "runs"), { recursive: true });
      await writeFile(join(root, "aidd_docs", "runs", "a.jsonl"), "");
      await writeFile(join(root, "other.txt"), "");
      git(root, "add", ".");

      expect(await adapter.listTrackedFiles(root, "aidd_docs/runs/")).toStrictEqual([
        "aidd_docs/runs/a.jsonl",
      ]);
    });

    it("answers nothing outside a repository", async () => {
      expect(await adapter.listTrackedFiles(outside, "aidd_docs/runs/")).toStrictEqual([]);
    });
  });

  describe("hasHistoryFor", () => {
    it("is false while the pathspec is only staged", async () => {
      await writeFile(join(root, "tracked.txt"), "");
      git(root, "add", ".");

      expect(await adapter.hasHistoryFor(root, "tracked.txt")).toBe(false);
    });

    it("is false for a pathspec staged after other commits", async () => {
      await commit(root, "one");
      await writeFile(join(root, "tracked.txt"), "");
      git(root, "add", ".");

      expect(await adapter.hasHistoryFor(root, "tracked.txt")).toBe(false);
    });

    it("is true once a commit touched the pathspec", async () => {
      await writeFile(join(root, "tracked.txt"), "");
      git(root, "add", ".");
      git(root, "commit", "-q", "-m", "one");

      expect(await adapter.hasHistoryFor(root, "tracked.txt")).toBe(true);
    });

    it("is false outside a repository", async () => {
      expect(await adapter.hasHistoryFor(outside, "tracked.txt")).toBe(false);
    });
  });

  describe("installCommitMessageDelegate, when this CLI owns the hook", () => {
    it("writes the delegate executable and a hook calling it from scratch", async () => {
      const result = await adapter.installCommitMessageDelegate(root, DELEGATE, SCRIPT);

      const delegatePath = join(hooksDir, DELEGATE);
      expect(result).toStrictEqual({ lineAdded: true });
      expect(await readFile(delegatePath, "utf8")).toBe(SCRIPT);
      expect(await readFile(join(hooksDir, "prepare-commit-msg"), "utf8")).toBe(
        `${SESSION_TRAILER_HOOK_HEADER}\n${sessionTrailerHookLine(delegatePath)}\n`
      );
    });

    it("reports the delegate executable and the call site present afterwards", async () => {
      await adapter.installCommitMessageDelegate(root, DELEGATE, SCRIPT);

      expect(
        await adapter.readCommitTrailerSetup(root, DELEGATE, SESSION_TRAILER_TOKEN, 10)
      ).toStrictEqual({
        delegate: "executable",
        hookExecutable: true,
        callSite: "present",
        hookHasOtherContent: false,
        hooksDir,
      });
    });

    it("adds nothing the second time", async () => {
      await adapter.installCommitMessageDelegate(root, DELEGATE, SCRIPT);

      expect(await adapter.installCommitMessageDelegate(root, DELEGATE, SCRIPT)).toStrictEqual({
        lineAdded: false,
      });
    });

    it("appends one line to an existing hook, on its own line", async () => {
      await mkdir(hooksDir, { recursive: true });
      await writeFile(join(hooksDir, "prepare-commit-msg"), "#!/bin/sh\necho mine");

      await adapter.installCommitMessageDelegate(root, DELEGATE, SCRIPT);

      expect(await readFile(join(hooksDir, "prepare-commit-msg"), "utf8")).toBe(
        `#!/bin/sh\necho mine\n${sessionTrailerHookLine(join(hooksDir, DELEGATE))}\n`
      );
    });

    it("follows core.hooksPath rather than assuming .git/hooks", async () => {
      const custom = join(root, "my-hooks");
      git(root, "config", "core.hooksPath", "my-hooks");

      await adapter.installCommitMessageDelegate(root, DELEGATE, SCRIPT);

      expect(await readFile(join(custom, DELEGATE), "utf8")).toBe(SCRIPT);
    });

    it("installs nothing outside a repository", async () => {
      expect(await adapter.installCommitMessageDelegate(outside, DELEGATE, SCRIPT)).toStrictEqual({
        lineAdded: false,
      });
    });
  });

  describe("installCommitMessageDelegate, when a manager owns the hook", () => {
    it("lands the delegate in the common hooks directory and appends no line", async () => {
      await writeFile(join(root, "lefthook.yml"), "pre-commit:\n");

      const result = await adapter.installCommitMessageDelegate(root, DELEGATE, SCRIPT);

      expect(result).toStrictEqual({
        lineAdded: false,
        hookManager: "lefthook",
        managerCallsDelegate: false,
      });
      expect(await readFile(join(hooksDir, DELEGATE), "utf8")).toBe(SCRIPT);
      await expect(readFile(join(hooksDir, "prepare-commit-msg"), "utf8")).rejects.toThrow(
        /ENOENT/
      );
    });

    it("reads a lefthook config that names the delegate as already wired", async () => {
      await writeFile(join(root, ".lefthook.yaml"), `run: sh .git/hooks/${DELEGATE}\n`);

      expect(await adapter.installCommitMessageDelegate(root, DELEGATE, SCRIPT)).toStrictEqual({
        lineAdded: false,
        hookManager: "lefthook",
        managerCallsDelegate: true,
      });
    });

    it("reads husky's own prepare-commit-msg for the delegate", async () => {
      await mkdir(join(root, ".husky"), { recursive: true });
      await writeFile(join(root, ".husky", "prepare-commit-msg"), `sh ${DELEGATE}\n`);

      expect(await adapter.installCommitMessageDelegate(root, DELEGATE, SCRIPT)).toStrictEqual({
        lineAdded: false,
        hookManager: "husky",
        managerCallsDelegate: true,
      });
    });

    it("reads a husky directory holding no prepare-commit-msg as not wired", async () => {
      await mkdir(join(root, ".husky"), { recursive: true });

      expect(await adapter.installCommitMessageDelegate(root, DELEGATE, SCRIPT)).toStrictEqual({
        lineAdded: false,
        hookManager: "husky",
        managerCallsDelegate: false,
      });
    });

    it("ignores core.hooksPath under a manager", async () => {
      await writeFile(join(root, "lefthook.yml"), "");
      git(root, "config", "core.hooksPath", "my-hooks");

      await adapter.installCommitMessageDelegate(root, DELEGATE, SCRIPT);

      expect(await readFile(join(hooksDir, DELEGATE), "utf8")).toBe(SCRIPT);
    });

    it("installs nothing outside a repository, and names no manager", async () => {
      await writeFile(join(outside, "lefthook.yml"), "");

      expect(await adapter.installCommitMessageDelegate(outside, DELEGATE, SCRIPT)).toStrictEqual({
        lineAdded: false,
      });
    });
  });

  describe("removeCommitMessageDelegate", () => {
    it("drops the one line and deletes the delegate, leaving the rest of the hook", async () => {
      await mkdir(hooksDir, { recursive: true });
      await writeFile(join(hooksDir, "prepare-commit-msg"), "#!/bin/sh\necho mine\n");
      await adapter.installCommitMessageDelegate(root, DELEGATE, SCRIPT);

      const result = await adapter.removeCommitMessageDelegate(root, DELEGATE);

      expect(result).toStrictEqual({ removed: true });
      expect(await readFile(join(hooksDir, "prepare-commit-msg"), "utf8")).toBe(
        "#!/bin/sh\necho mine\n"
      );
      expect(await adapter.readCommitTrailerSetup(root, DELEGATE, "X", 1)).toStrictEqual({
        delegate: "absent",
        hookExecutable: true,
        callSite: "missing",
        hookHasOtherContent: true,
        hooksDir,
      });
    });

    it("reports nothing removed when nothing was installed", async () => {
      expect(await adapter.removeCommitMessageDelegate(root, DELEGATE)).toStrictEqual({
        removed: false,
      });
    });

    it("reports nothing removed from a hook that never called the delegate", async () => {
      await mkdir(hooksDir, { recursive: true });
      await writeFile(join(hooksDir, "prepare-commit-msg"), "#!/bin/sh\necho mine\n");

      expect(await adapter.removeCommitMessageDelegate(root, DELEGATE)).toStrictEqual({
        removed: false,
      });
      expect(await readFile(join(hooksDir, "prepare-commit-msg"), "utf8")).toBe(
        "#!/bin/sh\necho mine\n"
      );
    });

    it("drops the line even when a hand edit indented it", async () => {
      await mkdir(hooksDir, { recursive: true });
      const line = sessionTrailerHookLine(join(hooksDir, DELEGATE));
      await writeFile(join(hooksDir, "prepare-commit-msg"), `#!/bin/sh\n  ${line}\necho mine\n`);

      expect(await adapter.removeCommitMessageDelegate(root, DELEGATE)).toStrictEqual({
        removed: true,
      });
      expect(await readFile(join(hooksDir, "prepare-commit-msg"), "utf8")).toBe(
        "#!/bin/sh\necho mine\n"
      );
    });
    it.skipIf(MODE_BITS_UNOBSERVABLE)(
      "leaves a hook that was not executable as it found it",
      async () => {
        await mkdir(hooksDir, { recursive: true });
        await adapter.installCommitMessageDelegate(root, DELEGATE, SCRIPT);
        const hookPath = join(hooksDir, "prepare-commit-msg");
        await writeFile(
          hookPath,
          `#!/bin/sh\n${sessionTrailerHookLine(join(hooksDir, DELEGATE))}\n`
        );
        await chmod(hookPath, 0o644);

        await adapter.removeCommitMessageDelegate(root, DELEGATE);

        expect((await adapter.readCommitTrailerSetup(root, DELEGATE, "X", 1)).hookExecutable).toBe(
          false
        );
      }
    );

    it("counts a hand-deleted delegate whose line is still there as removed", async () => {
      await adapter.installCommitMessageDelegate(root, DELEGATE, SCRIPT);
      await rm(join(hooksDir, DELEGATE));

      expect(await adapter.removeCommitMessageDelegate(root, DELEGATE)).toStrictEqual({
        removed: true,
      });
    });

    it("counts a delegate whose line was hand-dropped as removed", async () => {
      await adapter.installCommitMessageDelegate(root, DELEGATE, SCRIPT);
      await writeFile(join(hooksDir, "prepare-commit-msg"), "#!/bin/sh\n");

      expect(await adapter.removeCommitMessageDelegate(root, DELEGATE)).toStrictEqual({
        removed: true,
      });
    });

    it("looks under the manager's directory and carries the manager facts", async () => {
      await writeFile(join(root, "lefthook.yml"), "");
      await adapter.installCommitMessageDelegate(root, DELEGATE, SCRIPT);

      expect(await adapter.removeCommitMessageDelegate(root, DELEGATE)).toStrictEqual({
        removed: true,
        hookManager: "lefthook",
        managerCallsDelegate: false,
      });
    });

    it("carries the manager facts outside a repository too", async () => {
      await writeFile(join(outside, "lefthook.yml"), "");

      expect(await adapter.removeCommitMessageDelegate(outside, DELEGATE)).toStrictEqual({
        removed: false,
        hookManager: "lefthook",
        managerCallsDelegate: false,
      });
    });
  });

  describe("readCommitTrailerSetup", () => {
    it("says no hook file and no delegate on a fresh repository", async () => {
      expect(await adapter.readCommitTrailerSetup(root, DELEGATE, "X", 1)).toStrictEqual({
        delegate: "absent",
        callSite: "no-hook-file",
        hookHasOtherContent: false,
        hooksDir,
      });
    });

    it("says no repository outside one", async () => {
      expect(await adapter.readCommitTrailerSetup(outside, DELEGATE, "X", 1)).toStrictEqual({
        delegate: "absent",
        callSite: "no-hook-file",
        hookHasOtherContent: false,
        hooksDirMissing: "no-repository",
      });
    });
    it.skipIf(MODE_BITS_UNOBSERVABLE)("reports a hook git would refuse to run", async () => {
      await mkdir(hooksDir, { recursive: true });
      await writeFile(join(hooksDir, "prepare-commit-msg"), "#!/bin/sh\n", { mode: 0o644 });

      expect(await adapter.readCommitTrailerSetup(root, DELEGATE, "X", 1)).toStrictEqual({
        delegate: "absent",
        hookExecutable: false,
        callSite: "missing",
        hookHasOtherContent: false,
        hooksDir,
      });
    });
    it.skipIf(MODE_BITS_UNOBSERVABLE)(
      "tells a delegate that is there but not executable from one that is missing",
      async () => {
        await mkdir(hooksDir, { recursive: true });
        await writeFile(join(hooksDir, DELEGATE), SCRIPT, { mode: 0o644 });

        expect((await adapter.readCommitTrailerSetup(root, DELEGATE, "X", 1)).delegate).toBe(
          "not-executable"
        );
      }
    );

    it("does not count the header the CLI writes as somebody else's content", async () => {
      await mkdir(hooksDir, { recursive: true });
      await writeFile(join(hooksDir, "prepare-commit-msg"), "#!/bin/sh\n\n  \n");

      expect(
        (await adapter.readCommitTrailerSetup(root, DELEGATE, "X", 1)).hookHasOtherContent
      ).toBe(false);
    });

    it("counts, among the last commits, those carrying the trailer", async () => {
      await commit(root, "plain");
      await commit(root, `stamped\n\n${SESSION_TRAILER_TOKEN}: abc`);
      await commit(root, "plain again");

      expect(
        (await adapter.readCommitTrailerSetup(root, DELEGATE, SESSION_TRAILER_TOKEN, 2))
          .recentlyCarrying
      ).toStrictEqual({ carrying: 1, examined: 2 });
    });

    it("leaves the count absent, not zero, when there is no history", async () => {
      expect(
        "recentlyCarrying" in (await adapter.readCommitTrailerSetup(root, DELEGATE, "X", 5))
      ).toBe(false);
    });

    it("reports the delegate under a manager's directory even when the hooks dir is elsewhere", async () => {
      await writeFile(join(root, "lefthook.yml"), `pre-commit: ${DELEGATE}`);
      git(root, "config", "core.hooksPath", "my-hooks");
      await adapter.installCommitMessageDelegate(root, DELEGATE, SCRIPT);

      expect(await adapter.readCommitTrailerSetup(root, DELEGATE, "X", 1)).toStrictEqual({
        delegate: "executable",
        callSite: "no-hook-file",
        hookHasOtherContent: false,
        hooksDir: join(root, "my-hooks"),
        hookManager: "lefthook",
        managerCallsDelegate: true,
      });
    });
  });
});
