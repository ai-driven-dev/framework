import { join } from "node:path";
import { parseFrontmatter } from "../../../../kernel/markdown.js";
import type { FileReader } from "../../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../../kernel/ports/file-writer.js";
import type { Hasher } from "../../../../kernel/ports/hasher.js";
import type { AgentsCapability } from "../../../tools/domain/capabilities/agents-capability.js";
import type { HasAgents } from "../../../tools/domain/contracts.js";
import {
  type AgentHost,
  type AgentProvider,
  agentModelOptions,
} from "../../../tools/domain/formats/agent-models.js";
import { getAiToolConfig } from "../../../tools/domain/registry.js";
import {
  AGENT_INSTALLATIONS_PATH,
  type AgentInstallationStore,
  type AgentInstallations,
} from "../../domain/ports/agent-installation-store.js";
import { assertProjectPathWithinRoot } from "../ownership/project-path-boundary.js";

interface AgentTarget {
  projectRoot: string;
  host: AgentHost;
}

interface AgentChange {
  path: string;
  content: string | null;
}

export class ManageAgentsUseCase {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly store: AgentInstallationStore,
    private readonly hasher: Hasher,
    private readonly sources: Readonly<Record<string, string>>
  ) {}

  async install(options: AgentTarget & { provider: AgentProvider }): Promise<number> {
    const capability = this.capability(options.host);
    const entries = Object.entries(this.sources).map(([name, source]) => {
      const { frontmatter, body } = parseFrontmatter(source);
      const role = typeof frontmatter.name === "string" ? frontmatter.name : name;
      const model = agentModelOptions(options.host, options.provider, role);
      return {
        name,
        path: this.path(options.projectRoot, capability, name),
        content: capability.serialize(
          { ...capability.convertFrontmatter({ ...frontmatter, name }, `${name}.md`), ...model },
          body
        ),
      };
    });
    return this.exclusively(options.projectRoot, async () => {
      const installed = await this.load(options.projectRoot);
      for (const entry of entries)
        await this.assertOwned(
          options.projectRoot,
          entry.path,
          installed[options.host]?.[entry.name]
        );
      installed[options.host] = {
        ...installed[options.host],
        ...Object.fromEntries(
          entries.map(({ name, content }) => [name, this.hasher.hash(content)])
        ),
      };
      return this.save(options.projectRoot, installed, entries);
    });
  }

  private async exclusively<T>(root: string, action: () => Promise<T>): Promise<T> {
    await assertProjectPathWithinRoot(this.fs, root, join(root, AGENT_INSTALLATIONS_PATH));
    return this.store.withExclusiveAccess(root, action);
  }

  private async save(
    root: string,
    installed: AgentInstallations,
    changes: readonly AgentChange[]
  ): Promise<number> {
    const previous: AgentChange[] = [];
    try {
      for (const change of changes) {
        const content = (await this.fs.fileExists(change.path))
          ? await this.fs.readFile(change.path)
          : null;
        if (content === change.content) continue;
        previous.push({ path: change.path, content });
        await this.write(change);
      }
      await this.store.save(root, installed);
      return previous.length;
    } catch (error) {
      const restored = await Promise.allSettled(
        previous.reverse().map(async (change) => {
          const content = (await this.fs.fileExists(change.path))
            ? await this.fs.readFile(change.path)
            : null;
          if (content !== change.content) await this.write(change);
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

  private async write({ path, content }: AgentChange): Promise<void> {
    if (content !== null) await this.fs.writeFile(path, content);
    else {
      await this.fs.deleteFile(path);
      if (await this.fs.fileExists(path)) throw new Error(`Could not remove agent: ${path}`);
    }
  }

  async remove(options: AgentTarget): Promise<number> {
    return this.exclusively(options.projectRoot, async () => {
      const installed = await this.load(options.projectRoot);
      const entries = await this.removable(options.projectRoot, installed, options.host);
      delete installed[options.host];
      return this.save(
        options.projectRoot,
        installed,
        entries.map((path) => ({ path, content: null }))
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
    await this.removable(projectRoot, await this.load(projectRoot));
  }

  async removeAll(projectRoot: string, afterRemoval?: () => Promise<void>): Promise<number> {
    return this.exclusively(projectRoot, async () => {
      const entries = await this.removable(projectRoot, await this.load(projectRoot));
      const count = await this.save(
        projectRoot,
        {},
        entries.map((path) => ({ path, content: null }))
      );
      await afterRemoval?.();
      return count;
    });
  }

  private capability(host: AgentHost): AgentsCapability {
    return (getAiToolConfig(host).capabilities as HasAgents).agents;
  }

  private path(root: string, capability: AgentsCapability, name: string): string {
    const path = capability.buildInstallPath(`${name}.md`);
    if (path === null) throw new Error(`Agent ${name} has no native install path.`);
    return join(root, path);
  }

  private async load(root: string): Promise<AgentInstallations> {
    await assertProjectPathWithinRoot(this.fs, root, join(root, AGENT_INSTALLATIONS_PATH));
    const installed = await this.store.load(root);
    for (const entries of Object.values(installed)) {
      for (const name of Object.keys(entries)) {
        if (!Object.hasOwn(this.sources, name)) throw new Error(`Unknown managed agent: ${name}`);
      }
    }
    return installed;
  }

  private async assertOwned(
    root: string,
    path: string,
    expected: ReturnType<Hasher["hash"]> | undefined
  ): Promise<void> {
    await assertProjectPathWithinRoot(this.fs, root, path);
    if (!(await this.fs.fileExists(path))) return;
    if (expected === undefined) throw new Error(`Agent file is not owned by AIDD: ${path}`);
    if (!(await this.fs.readFileHash(path)).equals(expected))
      throw new Error(`Agent file was modified; preserve or move it before continuing: ${path}`);
  }

  private async removable(
    root: string,
    installed: AgentInstallations,
    onlyHost?: AgentHost
  ): Promise<string[]> {
    const paths: string[] = [];
    for (const [host, entries] of Object.entries(installed)) {
      if (onlyHost !== undefined && host !== onlyHost) continue;
      const capability = this.capability(host as AgentHost);
      for (const [name, hash] of Object.entries(entries)) {
        const path = this.path(root, capability, name);
        await this.assertOwned(root, path, hash);
        if (await this.fs.fileExists(path)) paths.push(path);
      }
    }
    return paths;
  }
}
