import { mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cloneKey } from "../../../../src/contexts/telemetry/domain/consent/clone-identity.js";
import { GitConsentAdapter } from "../../../../src/contexts/telemetry/infrastructure/git/git-consent-adapter.js";
import { readCloneIdentity } from "../../../../src/contexts/telemetry/infrastructure/storage/consent/clone-identity-reader.js";
import { git, initRepository, sandboxGitEnv } from "../../../shared/testing/git-sandbox.builder.js";
import { cloneOf } from "../testing/clone.builder.js";
import {
  type ConsentSourceSubject,
  describeConsentSourceContract,
} from "../testing/consent-source.contract.js";
import { FakeConsents } from "../testing/fake-consents.fake.js";

const ROOT = "/work/app";

describeConsentSourceContract("the fake", async (): Promise<ConsentSourceSubject> => {
  const fake = new FakeConsents();
  const clone = cloneOf(`${ROOT}/.git`);
  fake.cloneSays(clone, null);
  return {
    source: fake,
    root: ROOT,
    clone,
    set: async (value) => {
      fake.values.set(ROOT, value);
      fake.cloneSays(clone, value);
    },
    breakConfig: async () => {
      fake.unreadable.add(ROOT);
      fake.unreadableClones.add(cloneKey(clone));
    },
    removeClone: async () => {
      fake.clones.delete(cloneKey(clone));
    },
    replaceClone: async () => {
      fake.replacedClones.add(cloneKey(clone));
    },
    dispose: async () => undefined,
  };
});

describeConsentSourceContract("git config", async (): Promise<ConsentSourceSubject> => {
  const base = await mkdtemp(join(tmpdir(), "aidd-consent-contract-"));
  const env = sandboxGitEnv(base);
  const root = join(base, "repo");
  initRepository(root, env);
  const clone = await readCloneIdentity(join(root, ".git"));
  if (typeof clone === "string" || clone === null) throw new Error("the clone has no identity");
  return {
    source: new GitConsentAdapter(env),
    root,
    clone,
    set: async (value) => {
      git(root, env, "config", "--local", "aidd.telemetry", value);
    },
    breakConfig: () => writeFile(join(root, ".git", "config"), "[core\n  broken"),
    removeClone: () => rm(root, { recursive: true }),
    replaceClone: async () => {
      // Moved aside, not deleted: the file system may give a deleted directory's inode to the next.
      await rename(root, `${root}.old`);
      initRepository(root, env);
    },
    dispose: () => rm(base, { recursive: true, force: true }),
  };
});
