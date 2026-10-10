import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RepositoryDeclarationsAdapter } from "../../../../../src/contexts/telemetry/infrastructure/forget/repository-declarations-adapter.js";
import { git, initRepository, sandboxGitEnv } from "../../../../helpers/git-sandbox.js";

let root: string;
let repo: string;
let env: NodeJS.ProcessEnv;

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "aidd-declarations-")));
  env = sandboxGitEnv(root);
  repo = join(root, "repo");
  initRepository(repo, env);
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const config = (...keys: string[]) => {
  for (const key of keys) git(repo, env, "config", "--local", key, "v");
};
const listed = () => git(repo, env, "config", "--local", "--list");

describe("the declarations in a repository's git config", () => {
  it("counts none where there are none", async () => {
    expect(await new RepositoryDeclarationsAdapter(env).count(repo)).toEqual({
      taskKeys: 0,
      consent: false,
    });
  });

  it("counts the three keys of every branch, dotted and upper-case names included", async () => {
    config(
      "branch.main.aiddTask",
      "branch.feat/a.b.aiddTicket",
      "branch.Feat/X.aiddDeclaredAt",
      "branch.main.remote",
      "branch.main.aiddOther",
      "aidd.task",
      "other.aiddTask"
    );
    expect(await new RepositoryDeclarationsAdapter(env).count(repo)).toEqual({
      taskKeys: 3,
      consent: false,
    });
  });

  it("removes exactly those keys, and says how many", async () => {
    config(
      "branch.main.aiddTask",
      "branch.feat/a.b.aiddTicket",
      "branch.Feat/X.aiddDeclaredAt",
      "branch.main.remote",
      "branch.main.aiddOther"
    );
    expect(await new RepositoryDeclarationsAdapter(env).clear(repo)).toEqual({
      taskKeys: 3,
      consent: false,
    });
    const left = listed();
    expect(left).toContain("branch.main.remote=v");
    expect(left).toContain("branch.main.aiddother=v");
    expect(left).not.toMatch(/aiddtask|aiddticket|aidddeclaredat/);
  });

  it("counts and removes the consent beside the task keys, and nothing like it", async () => {
    config("aidd.telemetry", "branch.main.aiddTask", "aidd.telemetryx", "aidd.other");
    const adapter = new RepositoryDeclarationsAdapter(env);
    expect(await adapter.count(repo)).toEqual({ taskKeys: 1, consent: true });
    expect(await adapter.clear(repo)).toEqual({ taskKeys: 1, consent: true });
    const left = listed();
    expect(left).not.toMatch(/aidd\.telemetry=|aiddtask/);
    expect(left).toContain("aidd.telemetryx=v");
    expect(left).toContain("aidd.other=v");
    expect(await adapter.count(repo)).toEqual({ taskKeys: 0, consent: false });
  });

  it("clears nothing where there is nothing", async () => {
    expect(await new RepositoryDeclarationsAdapter(env).clear(repo)).toEqual({
      taskKeys: 0,
      consent: false,
    });
  });

  it("does not read a key as an option", async () => {
    config("branch.-x.aiddTask");
    expect(await new RepositoryDeclarationsAdapter(env).clear(repo)).toMatchObject({
      taskKeys: 1,
    });
  });

  it("fails where git cannot read the config", async () => {
    const outside = join(root, "not-a-repo");
    mkdirSync(outside);
    await expect(new RepositoryDeclarationsAdapter(env).count(outside)).rejects.toThrow(
      /could not be read/
    );
  });
});

describe("a git that refuses to remove a key", () => {
  /** A `git` on the path that answers a removal with the given status and anything else as git. */
  function gitAnswering(status: number): NodeJS.ProcessEnv {
    const real = execFileSync("which", ["git"], { encoding: "utf8" }).trim();
    const bin = join(root, "bin");
    mkdirSync(bin);
    const script = join(bin, "git");
    writeFileSync(
      script,
      `#!/bin/sh\ncase "$*" in *--unset-all*) exit ${status};; esac\nexec "${real}" "$@"\n`
    );
    chmodSync(script, 0o755);
    return { ...env, PATH: `${bin}:${env.PATH ?? ""}` };
  }

  it("fails when removing is refused", async () => {
    config("branch.main.aiddTask");
    await expect(new RepositoryDeclarationsAdapter(gitAnswering(3)).clear(repo)).rejects.toThrow(
      /branch.main.aiddtask could not be removed/
    );
  });

  it("takes a key that is already gone for removed", async () => {
    config("branch.main.aiddTask");
    await expect(new RepositoryDeclarationsAdapter(gitAnswering(5)).clear(repo)).resolves.toEqual({
      taskKeys: 1,
      consent: false,
    });
  });
});
