import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LegacyHookAdapter } from "../../../../../src/contexts/telemetry/infrastructure/switch/legacy-hook-adapter.js";
import { git, initRepository, sandboxGitEnv } from "../../../../helpers/git-sandbox.js";

const DELEGATE =
  "#!/bin/sh\n# Installed by `aidd telemetry on`, removed by `aidd telemetry off`.\nexit 0\n";
let root: string;
let repo: string;
let env: NodeJS.ProcessEnv;
let adapter: LegacyHookAdapter;

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "aidd-hook-")));
  env = sandboxGitEnv(root);
  repo = join(root, "repo");
  initRepository(repo, env);
  adapter = new LegacyHookAdapter(env);
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const common = () => join(repo, ".git", "hooks");
const put = (path: string, text: string) => {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, text);
};
const callOf = (dir: string) => `sh "${join(dir, "aidd-session-trailer.sh")}" "$@"`;

describe("the commit hook of the previous version", () => {
  it("finds no line where there is no hook file", async () => {
    put(join(common(), "aidd-session-trailer.sh"), DELEGATE);
    expect(await adapter.clean(repo)).toEqual({
      lineRemoved: false,
      delegateRemoved: true,
      stillCalledBy: [],
    });
  });

  it("leaves a hook that has no such line exactly as it is", async () => {
    put(join(common(), "prepare-commit-msg"), "#!/bin/sh\necho hi\n");
    expect(await adapter.clean(repo)).toMatchObject({ lineRemoved: false });
    expect(readFileSync(join(common(), "prepare-commit-msg"), "utf8")).toBe("#!/bin/sh\necho hi\n");
  });

  it("removes the script from the directory a manager's job looks in, when core.hooksPath moved the hooks", async () => {
    git(repo, env, "config", "core.hooksPath", ".husky/_");
    put(join(common(), "aidd-session-trailer.sh"), DELEGATE);
    const result = await adapter.clean(repo);
    expect(result).toMatchObject({ delegateRemoved: true });
    expect(existsSync(join(common(), "aidd-session-trailer.sh"))).toBe(false);
  });

  it("keeps the script in that directory while a manager still calls it", async () => {
    git(repo, env, "config", "core.hooksPath", ".husky/_");
    put(join(common(), "aidd-session-trailer.sh"), DELEGATE);
    put(join(repo, "lefthook.yml"), "run: aidd-session-trailer.sh\n");
    expect(await adapter.clean(repo)).toEqual({
      lineRemoved: false,
      delegateRemoved: false,
      stillCalledBy: ["lefthook.yml"],
    });
    expect(existsSync(join(common(), "aidd-session-trailer.sh"))).toBe(true);
  });

  it("removes the script from both places it may have been written", async () => {
    const moved = join(repo, ".husky", "_");
    git(repo, env, "config", "core.hooksPath", ".husky/_");
    put(join(moved, "aidd-session-trailer.sh"), DELEGATE);
    put(join(moved, "prepare-commit-msg"), `#!/bin/sh\n${callOf(moved)}\n`);
    put(join(common(), "aidd-session-trailer.sh"), DELEGATE);
    expect(await adapter.clean(repo)).toMatchObject({ lineRemoved: true, delegateRemoved: true });
    expect(existsSync(join(moved, "aidd-session-trailer.sh"))).toBe(false);
    expect(existsSync(join(common(), "aidd-session-trailer.sh"))).toBe(false);
  });

  it("names no caller when there is no script to keep", async () => {
    put(join(repo, "lefthook.yml"), "run: aidd-session-trailer.sh\n");
    put(join(repo, ".lefthook.yaml"), "# aidd-session-trailer.sh\n");
    expect(await adapter.clean(repo)).toEqual({
      lineRemoved: false,
      delegateRemoved: false,
      stillCalledBy: [],
    });
  });

  it("names every file that still calls the script it keeps", async () => {
    put(join(common(), "aidd-session-trailer.sh"), DELEGATE);
    put(
      join(common(), "prepare-commit-msg"),
      `#!/bin/sh\n. other\nsh "$DIR/aidd-session-trailer.sh"\n`
    );
    put(join(repo, ".husky", "prepare-commit-msg"), "aidd-session-trailer.sh\n");
    put(join(repo, "lefthook.yaml"), "aidd-session-trailer.sh\n");
    put(join(repo, ".lefthook.yml"), "aidd-session-trailer.sh\n");
    expect((await adapter.clean(repo)).stillCalledBy).toEqual([
      "prepare-commit-msg",
      ".husky/prepare-commit-msg",
      "lefthook.yaml",
      ".lefthook.yml",
    ]);
  });
});
