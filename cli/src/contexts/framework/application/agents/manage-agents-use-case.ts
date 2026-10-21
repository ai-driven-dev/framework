import { dirname, join } from "node:path";
import { parseFrontmatter } from "../../../../kernel/markdown.js";
import type { FileReader } from "../../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../../kernel/ports/file-writer.js";
import type { Hasher } from "../../../../kernel/ports/hasher.js";
import {
  type AgentHost,
  type AgentProvider,
  agentModelOptions,
} from "../../../tools/domain/formats/agent-models.js";
import {
  AGENT_INSTALLATIONS_PATH,
  type AgentInstallationStore,
  type AgentInstallations,
  MAIN_MODEL_INSTALLATIONS_PATH,
  type MainModelInstallations,
} from "../../domain/ports/agent-installation-store.js";
import { assertProjectPathWithinRoot } from "../ownership/project-path-boundary.js";
import {
  type AgentLocation,
  type AgentTarget,
  agentsCapability,
  resolveAgentLocation,
} from "./agent-location.js";
import {
  type FileChange,
  mainModelInstall,
  mainModelRemovals,
  readOptional,
} from "./main-model-changes.js";

/** A registry name maps to one file inside the agents directory, never a path. */
const AGENT_NAME = /^[a-z0-9][a-z0-9-]*$/;

/** Installs, refreshes and removes the bundled agents, owning only the files it wrote. */
export class ManageAgentsUseCase {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly store: AgentInstallationStore,
    private readonly hasher: Hasher,
    private readonly sources: Readonly<Record<string, string>>
  ) {}

  /** `main` opts in to setting the main session model; without it the host settings stay as they are. */
  async install(
    options: AgentTarget & { provider: AgentProvider; main?: boolean }
  ): Promise<number> {
    const capability = agentsCapability(options.host);
    const location = resolveAgentLocation(this.fs, options);
    if (options.main === true && location.settingsPath === null)
      throw new Error(`${options.host} has no main model setting AIDD can write.`);
    const entries = Object.entries(this.sources).map(([name, source]) => {
      const { frontmatter, body } = parseFrontmatter(source);
      const role = typeof frontmatter.name === "string" ? frontmatter.name : name;
      const model = agentModelOptions(options.host, options.provider, role);
      return {
        name,
        path: location.agentPath(name),
        content: capability.serialize(
          { ...capability.convertFrontmatter({ ...frontmatter, name }, `${name}.md`), ...model },
          body
        ),
      };
    });
    await location.prepare?.();
    return this.exclusively(location.registryRoot, async () => {
      const installed = await this.load(location.registryRoot);
      const owned = installed[options.host] ?? {};
      for (const entry of entries) await this.assertOwned(location, entry.path, owned[entry.name]);
      // Roles no longer bundled: remove their unmodified files.
      const retired: FileChange[] = [];
      for (const [name, hash] of Object.entries(owned)) {
        if (Object.hasOwn(this.sources, name)) continue;
        const path = location.agentPath(name);
        await this.assertOwned(location, path, hash);
        retired.push({ path, content: null });
      }
      installed[options.host] = Object.fromEntries(
        entries.map(({ name, content }) => [name, this.hasher.hash(content)])
      );
      const mainModels = await this.store.loadMainModels(location.registryRoot);
      const main =
        options.main === true
          ? await mainModelInstall(this.fs, options, location, mainModels)
          : null;
      return this.save(
        location.registryRoot,
        installed,
        mainModels,
        [...entries, ...retired],
        main === null ? [] : [main]
      );
    });
  }

  async remove(options: AgentTarget): Promise<number> {
    const location = resolveAgentLocation(this.fs, options);
    await location.prepare?.();
    return this.exclusively(location.registryRoot, async () => {
      const installed = await this.load(location.registryRoot);
      const entries = await this.removable(options, installed, options.host);
      const mainModels = await this.store.loadMainModels(location.registryRoot);
      const main = await mainModelRemovals(this.fs, options, mainModels, options.host);
      delete installed[options.host];
      delete mainModels[options.host];
      return this.save(
        location.registryRoot,
        installed,
        mainModels,
        entries.map((path) => ({ path, content: null })),
        main
      );
    });
  }

  async preview(projectRoot: string): Promise<Array<{ toolId: AgentHost; fileCount: number }>> {
    const installed = await this.load(projectRoot);
    const tools: Array<{ toolId: AgentHost; fileCount: number }> = [];
    for (const host of Object.keys(installed)) {
      const entries = installed[host as AgentHost];
      if (entries !== undefined)
        tools.push({ toolId: host as AgentHost, fileCount: Object.keys(entries).length });
    }
    return tools;
  }

  async assertRemovable(projectRoot: string): Promise<void> {
    await this.removable({ projectRoot }, await this.load(projectRoot));
  }

  async removeAll(projectRoot: string, afterRemoval?: () => Promise<void>): Promise<number> {
    return this.exclusively(projectRoot, async () => {
      const entries = await this.removable({ projectRoot }, await this.load(projectRoot));
      const main = await mainModelRemovals(
        this.fs,
        { projectRoot },
        await this.store.loadMainModels(projectRoot)
      );
      const count = await this.save(
        projectRoot,
        {},
        {},
        entries.map((path) => ({ path, content: null })),
        main
      );
      await afterRemoval?.();
      return count;
    });
  }

  private async exclusively<T>(root: string, action: () => Promise<T>): Promise<T> {
    await assertProjectPathWithinRoot(this.fs, root, join(root, AGENT_INSTALLATIONS_PATH));
    return this.store.withExclusiveAccess(root, action);
  }

  /** Applies every change, then both registries; any failure restores all of them. */
  private async save(
    root: string,
    installed: AgentInstallations,
    mainModels: MainModelInstallations,
    changes: readonly FileChange[],
    mainChanges: readonly FileChange[] = []
  ): Promise<number> {
    const previous: FileChange[] = [];
    const agentPaths = new Set(changes.map((change) => change.path));
    try {
      for (const change of [...changes, ...mainChanges]) {
        const content = await readOptional(this.fs, change.path);
        if (content === change.content) continue;
        previous.push({ path: change.path, content });
        await this.write(change);
      }
      for (const registry of [AGENT_INSTALLATIONS_PATH, MAIN_MODEL_INSTALLATIONS_PATH]) {
        const path = join(root, registry);
        previous.push({ path, content: await readOptional(this.fs, path) });
      }
      await this.store.save(root, installed);
      await this.store.saveMainModels(root, mainModels);
      return previous.filter((change) => agentPaths.has(change.path)).length;
    } catch (error) {
      const restored = await Promise.allSettled(
        previous.reverse().map(async (change) => {
          if ((await readOptional(this.fs, change.path)) !== change.content)
            await this.write(change);
        })
      );
      const failures = restored.filter((result) => result.status === "rejected");
      if (failures.length > 0)
        throw new AggregateError(
          [error, ...failures.map((result) => result.reason)],
          "Agent update failed and rollback was incomplete. Preserve the registry and agent files before retrying."
        );
      throw error;
    }
  }

  /** Writes through an existing link, so linked settings files stay linked. */
  private async write({ path, content }: FileChange): Promise<void> {
    if (content !== null) {
      const target = (await this.fs.fileExists(path)) ? await this.fs.realpath(path) : path;
      await this.fs.writeFile(target, content);
    } else {
      await this.fs.deleteFile(path);
      if (await this.fs.fileExists(path)) throw new Error(`Could not remove agent: ${path}`);
    }
  }

  private async load(root: string): Promise<AgentInstallations> {
    await assertProjectPathWithinRoot(this.fs, root, join(root, AGENT_INSTALLATIONS_PATH));
    const installed = await this.store.load(root);
    for (const entries of Object.values(installed)) {
      for (const name of Object.keys(entries)) {
        if (!AGENT_NAME.test(name)) throw new Error(`Unknown managed agent: ${name}`);
      }
    }
    return installed;
  }

  private async assertOwned(
    location: AgentLocation,
    path: string,
    expected: ReturnType<Hasher["hash"]> | undefined
  ): Promise<void> {
    await location.guard(path);
    if (!(await this.fs.fileExists(path, false))) return;
    if (expected === undefined) throw new Error(`Agent file is not owned by AIDD: ${path}`);
    if (!(await this.fs.readFileHash(path)).equals(expected))
      throw new Error(`Agent file was modified; preserve or move it before continuing: ${path}`);
  }

  private async removable(
    target: Omit<AgentTarget, "host">,
    installed: AgentInstallations,
    onlyHost?: AgentHost
  ): Promise<string[]> {
    const paths: string[] = [];
    for (const [host, entries] of Object.entries(installed)) {
      if (onlyHost !== undefined && host !== onlyHost) continue;
      const location = resolveAgentLocation(this.fs, { ...target, host: host as AgentHost });
      // A user directory resolved elsewhere than at install would drop the record unseen.
      const names = Object.keys(entries);
      if (target.user !== undefined && names.length > 0) {
        const directory = dirname(location.agentPath(names[0] as string));
        if (!(await this.fs.fileExists(directory)))
          throw new Error(
            `No agents directory at ${directory}; restore the ${host} configuration directory used at install.`
          );
      }
      for (const [name, hash] of Object.entries(entries)) {
        const path = location.agentPath(name);
        await this.assertOwned(location, path, hash);
        if (await this.fs.fileExists(path)) paths.push(path);
      }
    }
    return paths;
  }
}
