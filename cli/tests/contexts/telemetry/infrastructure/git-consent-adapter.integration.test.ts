import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CloneIdentity } from "../../../../src/contexts/telemetry/domain/consent/clone-identity.js";
import { readCloneIdentity } from "../../../../src/contexts/telemetry/infrastructure/consent/clone-identity-reader.js";
import { GitConsentAdapter } from "../../../../src/contexts/telemetry/infrastructure/git-consent-adapter.js";
import { git, initRepository, sandboxGitEnv } from "../../../helpers/git-sandbox.js";

let root: string;
let repo: string;
let env: NodeJS.ProcessEnv;
let consent: GitConsentAdapter;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "aidd-git-consent-"));
  env = sandboxGitEnv(root);
  repo = join(root, "repo");
  initRepository(repo, env);
  consent = new GitConsentAdapter(env);
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("a clone's consent in its git config", () => {
  it("is unset until something sets it", async () => {
    expect(await consent.read(repo)).toEqual({ kind: "value", value: null });
  });

  it("is written to the repository's own config, and read back", async () => {
    await consent.set(repo, "2");
    expect(await consent.read(repo)).toEqual({ kind: "value", value: "2" });
    expect(git(repo, env, "config", "--local", "--get", "aidd.telemetry").trim()).toBe("2");
    await consent.set(repo, "off");
    expect(await consent.read(repo)).toEqual({ kind: "value", value: "off" });
  });

  it("is seen by a linked worktree, which shares the clone's config", async () => {
    await consent.set(repo, "2");
    const linked = join(root, "linked");
    git(repo, env, "worktree", "add", "-q", "-b", "feat/y", linked);
    expect(await consent.read(linked)).toEqual({ kind: "value", value: "2" });
  });

  it("is not read from a committed .aidd/config.json", async () => {
    await mkdir(join(repo, ".aidd"));
    await writeFile(
      join(repo, ".aidd", "config.json"),
      '{"telemetry":{"enabled":true,"version":2}}'
    );
    git(repo, env, "add", ".");
    git(repo, env, "commit", "-q", "-m", "config");
    expect(await consent.read(repo)).toEqual({ kind: "value", value: null });
  });

  it("is not read from the user's global git config", async () => {
    const globalConfig = join(root, "global-gitconfig");
    await writeFile(globalConfig, "[aidd]\n\ttelemetry = 2\n");
    const withGlobal = { ...env, GIT_CONFIG_GLOBAL: globalConfig };
    expect(git(repo, withGlobal, "config", "--get", "aidd.telemetry").trim()).toBe("2");
    expect(await new GitConsentAdapter(withGlobal).read(repo)).toEqual({
      kind: "value",
      value: null,
    });
  });

  it("drops only the final newline of a value", async () => {
    await consent.set(repo, "a b");
    expect(await consent.read(repo)).toEqual({ kind: "value", value: "a b" });
  });

  it("fails to set a value where git cannot write", async () => {
    const plain = join(root, "plain");
    await mkdir(plain);
    await expect(consent.set(plain, "2")).rejects.toThrow(/aidd\.telemetry could not be set/);
  });

  it("is unreadable when git cannot read the repository's config", async () => {
    await writeFile(join(repo, ".git", "config"), "[core\n  broken");
    expect(await consent.read(repo)).toEqual({ kind: "unreadable" });
  });

  describe("read from the clone itself", () => {
    const identityOf = async (path: string): Promise<CloneIdentity> => {
      const found = await readCloneIdentity(path);
      if (typeof found === "string" || found === null) throw new Error(`no identity for ${path}`);
      return found;
    };

    it("is the key of the common git dir, whether or not a working tree of it exists", async () => {
      const clone = await identityOf(join(repo, ".git"));
      expect(await consent.readClone(clone)).toEqual({ kind: "value", value: null });
      await consent.set(repo, "2");
      const linked = join(root, "linked");
      git(repo, env, "worktree", "add", "-q", "-b", "feat/y", linked);
      await rm(linked, { recursive: true });
      expect(await consent.readClone(clone)).toEqual({ kind: "value", value: "2" });
      await consent.set(repo, "off");
      expect(await consent.readClone(clone)).toEqual({ kind: "value", value: "off" });
    });

    it("is gone when the clone is", async () => {
      const clone = await identityOf(join(repo, ".git"));
      await rm(repo, { recursive: true });
      expect(await consent.readClone(clone)).toEqual({ kind: "gone" });
    });

    it("is gone when another clone is at the path now, and says nothing of it", async () => {
      const clone = await identityOf(join(repo, ".git"));
      // Moved aside, not deleted: the file system may give a deleted directory's inode to the next.
      await rename(repo, `${repo}.old`);
      initRepository(repo, env);
      await consent.set(repo, "2");
      expect(await consent.readClone(clone)).toEqual({ kind: "gone" });
    });

    it.each([
      ["device", { dev: "0" }],
      ["inode", { ino: "1" }],
      ["birth time", { birthtimeMs: 1 }],
    ])("is gone when the %s is not the clone's", async (_name, change) => {
      const clone = await identityOf(join(repo, ".git"));
      expect(await consent.readClone({ ...clone, ...change })).toEqual({ kind: "gone" });
    });

    it("is unreadable, and not gone, when the file system can no longer identify the path", async () => {
      const clone = await identityOf(join(repo, ".git"));
      const blind = new GitConsentAdapter(env, async () => "unidentified");
      expect(await blind.readClone(clone)).toEqual({ kind: "unreadable" });
    });

    it("is unreadable when git cannot read the clone's config", async () => {
      const clone = await identityOf(join(repo, ".git"));
      await writeFile(join(repo, ".git", "config"), "[core\n  broken");
      expect(await consent.readClone(clone)).toEqual({ kind: "unreadable" });
    });

    it("is not read from the user's global git config", async () => {
      const clone = await identityOf(join(repo, ".git"));
      const globalConfig = join(root, "global-gitconfig");
      await writeFile(globalConfig, "[aidd]\n\ttelemetry = 2\n");
      const withGlobal = { ...env, GIT_CONFIG_GLOBAL: globalConfig };
      expect(await new GitConsentAdapter(withGlobal).readClone(clone)).toEqual({
        kind: "value",
        value: null,
      });
    });
  });
});
