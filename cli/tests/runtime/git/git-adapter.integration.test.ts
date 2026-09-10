import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sessionTrailerHookLine } from "../../../src/contexts/telemetry/domain/formats/commit-session-trailer.js";
import { FileAdapter } from "../../../src/runtime/filesystem/file-adapter.js";
import { HasherAdapter } from "../../../src/runtime/filesystem/hasher-adapter.js";
import { GitAdapter } from "../../../src/runtime/git/git-adapter.js";
import { environmentWithoutGitVariables } from "../../../src/runtime/git/git-environment.js";

const DELEGATE = "aidd-session-trailer.sh";
const SCRIPT = "#!/bin/sh\necho delegate\n";

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args],
    { cwd, encoding: "utf8", env: environmentWithoutGitVariables() }
  );
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout.trim();
}

describe("GitAdapter", () => {
  let root: string;
  let hooksDir: string;
  let adapter: GitAdapter;

  beforeEach(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), "aidd-git-adapter-")));
    git(root, "init", "-q");
    hooksDir = join(root, ".git", "hooks");
    adapter = new GitAdapter(new FileAdapter(new HasherAdapter()));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
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

    // A mode bit is POSIX: on Windows `access(X_OK)` answers like `F_OK`.
    it.skipIf(process.platform === "win32")(
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
  });
});
