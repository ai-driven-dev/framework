import { execFile } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { GitCloner } from "../../../../src/contexts/distribution/infrastructure/git-cloner-adapter.js";
import { PluginFetcherAdapter } from "../../../../src/contexts/distribution/infrastructure/plugin-fetcher-adapter.js";
import { PnpmInstallerAdapter } from "../../../../src/contexts/distribution/infrastructure/pnpm-installer-adapter.js";
import { FileAdapter } from "../../../../src/shared/infrastructure/file-adapter.js";
import { FixturePluginFetcher } from "../../../shared/testing/fixture-plugin-fetcher.fake.js";
import {
  describePluginFetcherContract,
  PLUGIN_MANIFEST,
  type PluginFetcherSubject,
} from "../testing/plugin-fetcher.contract.js";

const execFileAsync = promisify(execFile);
const PLUGIN_JSON = '{ "name": "remote-plugin", "version": "1.0.0" }';
const GIT_IDENTITY = {
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

async function writePlugin(directory: string): Promise<void> {
  await mkdir(join(directory, ".claude-plugin"), { recursive: true });
  await writeFile(join(directory, PLUGIN_MANIFEST), PLUGIN_JSON);
}

/** A local git repository holding one plugin, never the network. */
async function commitPlugin(repository: string): Promise<void> {
  const git = (...args: string[]) =>
    execFileAsync("git", ["-c", "commit.gpgsign=false", ...args], {
      cwd: repository,
      env: { ...process.env, ...GIT_IDENTITY, GIT_DIR: undefined, GIT_WORK_TREE: undefined },
    });
  await writePlugin(repository);
  await git("init", "-b", "main");
  await git("add", ".");
  await git("commit", "-m", "init");
}

async function sandbox(): Promise<{ root: string; repository: string }> {
  const root = await realpath(await mkdtemp(join(tmpdir(), "aidd-fetcher-contract-")));
  const repository = join(root, "remote");
  await mkdir(repository);
  await commitPlugin(repository);
  return { root, repository };
}

describePluginFetcherContract(
  "by the fixture",
  async () => {
    const { root, repository } = await sandbox();
    const remote = { kind: "url", url: pathToFileURL(repository).href } as const;
    const fetcher = new FixturePluginFetcher();
    fetcher.register(remote, repository);
    return {
      fetcher,
      cacheDir: join(root, "cache"),
      remote,
      unknownRemote: { kind: "url", url: pathToFileURL(join(root, "absent")).href },
      localPath: repository,
      dispose: () => rm(root, { recursive: true, force: true }),
    } satisfies PluginFetcherSubject;
  },
  { missingLocalPath: "the fixture hands back any local path, existing or not" }
);

describePluginFetcherContract("by PluginFetcherAdapter on a local git remote", async () => {
  const { root, repository } = await sandbox();
  return {
    fetcher: new PluginFetcherAdapter(
      new FileAdapter(),
      new GitCloner(),
      new PnpmInstallerAdapter()
    ),
    cacheDir: join(root, "cache"),
    remote: { kind: "url", url: pathToFileURL(repository).href },
    unknownRemote: { kind: "url", url: pathToFileURL(join(root, "absent")).href },
    localPath: repository,
    dispose: () => rm(root, { recursive: true, force: true }),
  } satisfies PluginFetcherSubject;
});
