import { basename, dirname, join } from "node:path";
import { parseFrontmatter } from "../../../../kernel/markdown.js";
import type { FileReader } from "../../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../../kernel/ports/file-writer.js";
import type { Hasher } from "../../../../kernel/ports/hasher.js";
import type { AgentsCapability } from "../../../tools/domain/capabilities/agents-capability.js";
import type { EnvironmentReader } from "../../../tools/domain/capabilities/plugins-capability.js";
import type { HasAgents } from "../../../tools/domain/contracts.js";
import {
  type AgentHost,
  type AgentProvider,
  agentModelOptions,
} from "../../../tools/domain/formats/agent-models.js";
import {
  mainModelTarget,
  mainModelValues,
  planMainModelInstall,
  planMainModelRemoval,
} from "../../../tools/domain/formats/main-model-config.js";
import { getAiToolConfig } from "../../../tools/domain/registry.js";
import {
  AGENT_INSTALLATIONS_PATH,
  type AgentInstallationStore,
  type AgentInstallations,
  MAIN_MODEL_INSTALLATIONS_PATH,
  type MainModelInstallations,
} from "../../domain/ports/agent-installation-store.js";
import { assertProjectPathWithinRoot } from "../ownership/project-path-boundary.js";

interface AgentTarget {
  projectRoot: string;
  host: AgentHost;
  /** Targets the IDE's user configuration directory instead of the project. */
  user?: UserAgentRoot;
}

interface AgentChange {
  path: string;
  content: string | null;
}

/** Where one host's agents, main settings and ownership registry live for a scope. */
interface AgentLocation {
  registryRoot: string;
  /** Creates the registry root when the scope owns it. */
  prepare?: () => Promise<void>;
  agentPath(name: string): string;
  settingsPath: string | null;
  guard(path: string): Promise<void>;
}

/** The user's home, environment and AIDD configuration directory, for user-scoped agents. */
export interface UserAgentRoot {
  home: string;
  env: EnvironmentReader;
  configDir: string;
}

/** A registry name maps to one file inside the agents directory, never a path. */
const AGENT_NAME = /^[a-z0-9][a-z0-9-]*$/;

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
    const capability = this.capability(options.host);
    const location = this.location(options);
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
      const retired: AgentChange[] = [];
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
      const mainChanges: AgentChange[] = [];
      if (options.main === true) {
        const main = await this.mainModelInstall(options, location, mainModels);
        if (main !== null) mainChanges.push(main);
      }
      return this.save(
        location.registryRoot,
        installed,
        mainModels,
        [...entries, ...retired],
        mainChanges
      );
    });
  }

  /** Writes the provider's main model into the host settings, recording what it replaces. */
  private async mainModelInstall(
    options: AgentTarget & { provider: AgentProvider },
    location: AgentLocation,
    mainModels: MainModelInstallations
  ): Promise<AgentChange | null> {
    const target = mainModelTarget(options.host);
    const path = location.settingsPath;
    if (target === null || path === null) return null;
    await location.guard(path);
    if ((await this.fs.fileExists(path, false)) && !(await this.fs.fileExists(path)))
      throw new Error(`Settings link is broken; fix it before installing agents: ${path}`);
    const content = await this.readOptional(path);
    for (const alternative of content === null ? (target.alternatives ?? []) : [])
      if (await this.fs.fileExists(join(dirname(path), alternative)))
        throw new Error(
          `Settings live in ${alternative}; move them to ${basename(path)} before installing agents.`
        );
    try {
      const plan = planMainModelInstall(
        content,
        target.format,
        mainModelValues(options.host, options.provider),
        mainModels[options.host]
      );
      mainModels[options.host] = plan.record;
      return { path, content: plan.content };
    } catch (error) {
      throw new Error(`Cannot set the main model in ${path}: ${(error as Error).message}`);
    }
  }

  /** Restores the settings each recorded main model replaced. */
  private async mainModelRemovals(
    target: Omit<AgentTarget, "host">,
    mainModels: MainModelInstallations,
    onlyHost?: AgentHost
  ): Promise<AgentChange[]> {
    const changes: AgentChange[] = [];
    for (const [host, record] of Object.entries(mainModels)) {
      if (onlyHost !== undefined && host !== onlyHost) continue;
      const settings = mainModelTarget(host as AgentHost);
      const location = this.location({ ...target, host: host as AgentHost });
      if (settings === null || location.settingsPath === null || record === undefined) continue;
      await location.guard(location.settingsPath);
      const content = await this.readOptional(location.settingsPath);
      const next = planMainModelRemoval(content, settings.format, record);
      if (next !== content) changes.push({ path: location.settingsPath, content: next });
    }
    return changes;
  }

  private async readOptional(path: string): Promise<string | null> {
    return (await this.fs.fileExists(path)) ? this.fs.readFile(path) : null;
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
    changes: readonly AgentChange[],
    mainChanges: readonly AgentChange[] = []
  ): Promise<number> {
    const previous: AgentChange[] = [];
    const agentPaths = new Set(changes.map((change) => change.path));
    try {
      for (const change of [...changes, ...mainChanges]) {
        const content = await this.readOptional(change.path);
        if (content === change.content) continue;
        previous.push({ path: change.path, content });
        await this.write(change);
      }
      for (const registry of [AGENT_INSTALLATIONS_PATH, MAIN_MODEL_INSTALLATIONS_PATH]) {
        const path = join(root, registry);
        previous.push({ path, content: await this.readOptional(path) });
      }
      await this.store.save(root, installed);
      await this.store.saveMainModels(root, mainModels);
      return previous.filter((change) => agentPaths.has(change.path)).length;
    } catch (error) {
      const restored = await Promise.allSettled(
        previous.reverse().map(async (change) => {
          if ((await this.readOptional(change.path)) !== change.content) await this.write(change);
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
  private async write({ path, content }: AgentChange): Promise<void> {
    if (content !== null) {
      const target = (await this.fs.fileExists(path)) ? await this.fs.realpath(path) : path;
      await this.fs.writeFile(target, content);
    } else {
      await this.fs.deleteFile(path);
      if (await this.fs.fileExists(path)) throw new Error(`Could not remove agent: ${path}`);
    }
  }

  async remove(options: AgentTarget): Promise<number> {
    const location = this.location(options);
    await location.prepare?.();
    return this.exclusively(location.registryRoot, async () => {
      const installed = await this.load(location.registryRoot);
      const entries = await this.removable(options, installed, options.host);
      const mainModels = await this.store.loadMainModels(location.registryRoot);
      const main = await this.mainModelRemovals(options, mainModels, options.host);
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
      const main = await this.mainModelRemovals(
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

  private capability(host: AgentHost): AgentsCapability {
    return (getAiToolConfig(host).capabilities as HasAgents).agents;
  }

  private location(target: AgentTarget): AgentLocation {
    const capability = this.capability(target.host);
    const settings = mainModelTarget(target.host);
    const file = (name: string) => {
      const path = capability.buildInstallPath(`${name}.md`);
      if (path === null) throw new Error(`Agent ${name} has no native install path.`);
      return path;
    };
    const user = target.user;
    if (user === undefined) {
      const root = target.projectRoot;
      return {
        registryRoot: root,
        agentPath: (name) => join(root, file(name)),
        settingsPath: settings === null ? null : join(root, settings.path),
        guard: (path) => assertProjectPathWithinRoot(this.fs, root, path),
      };
    }
    const directory = capability.params.userDirectory?.(user.home, user.env);
    if (directory === undefined) throw new Error(`${target.host} has no user-level agents.`);
    const configDir = user.configDir;
    return {
      registryRoot: configDir,
      prepare: () => this.fs.createDirectory(configDir),
      agentPath: (name) => join(directory, "agents", basename(file(name))),
      settingsPath: settings === null ? null : join(directory, settings.userPath),
      guard: async () => {},
    };
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
      const location = this.location({ ...target, host: host as AgentHost });
      for (const [name, hash] of Object.entries(entries)) {
        const path = location.agentPath(name);
        await this.assertOwned(location, path, hash);
        if (await this.fs.fileExists(path)) paths.push(path);
      }
    }
    return paths;
  }
}
