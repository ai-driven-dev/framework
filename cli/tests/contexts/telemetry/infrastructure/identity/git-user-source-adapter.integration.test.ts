import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GitUserSourceAdapter } from "../../../../../src/contexts/telemetry/infrastructure/identity/git-user-source-adapter.js";
import { git, initRepository, sandboxGitEnv } from "../../../../helpers/git-sandbox.js";

let root: string;
let repo: string;
let global: string;
let env: NodeJS.ProcessEnv;
let source: GitUserSourceAdapter;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "aidd-git-user-"));
  global = join(root, "global.gitconfig");
  await writeFile(global, "");
  env = sandboxGitEnv(root, { GIT_CONFIG_GLOBAL: global });
  repo = join(root, "repo");
  initRepository(repo, env);
  source = new GitUserSourceAdapter(env);
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const set = (scope: "--local" | "--global", key: string, value: string) =>
  git(repo, env, "config", scope, key, value);

describe("who git says the person is, in a directory", () => {
  it("is nobody when neither a name nor an email is set", async () => {
    expect(await source.userIn(repo)).toBeNull();
  });

  it("is the name, before the email", async () => {
    set("--global", "user.email", "ada@example.com");
    set("--global", "user.name", "Ada Example");
    expect(await source.userIn(repo)).toBe("Ada Example");
  });

  it("is the email when no name is set", async () => {
    set("--global", "user.email", "ada@example.com");
    expect(await source.userIn(repo)).toBe("ada@example.com");
  });

  it("is the email when the name is set empty", async () => {
    set("--global", "user.name", "");
    set("--global", "user.email", "ada@example.com");
    expect(await source.userIn(repo)).toBe("ada@example.com");
  });

  it("is the clone's own name over the global one", async () => {
    set("--global", "user.name", "Ada Example");
    set("--local", "user.name", "Ada at Work");
    expect(await source.userIn(repo)).toBe("Ada at Work");
  });

  it("is the global name outside any repository", async () => {
    set("--global", "user.name", "Ada Example");
    expect(await source.userIn(root)).toBe("Ada Example");
  });
});
