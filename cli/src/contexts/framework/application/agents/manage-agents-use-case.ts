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

export class ManageAgentsUseCase {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly store: AgentInstallationStore,
    private readonly hasher: Hasher,
    private readonly sources: Readonly<Record<string, string>>
  ) {}

  async install(options: AgentTarget & { provider: AgentProvider }): Promise<number> {
    const model = agentModelOptions(options.host, options.provider);
    const installed = await this.load(options.projectRoot);
    const capability = this.capability(options.host);
    const entries = Object.entries(this.sources).map(([name, source]) => {
      const { frontmatter, body } = parseFrontmatter(source);
      return {
        name,
        path: this.path(options.projectRoot, capability, name),
        content: capability.serialize(
          { ...capability.convertFrontmatter({ ...frontmatter, name }, `${name}.md`), ...model },
          body
        ),
      };
    });
    for (const entry of entries)
      await this.assertOwned(
        options.projectRoot,
        entry.path,
        installed[options.host]?.[entry.name]
      );
    let written = 0;
    const hashes = { ...installed[options.host] };
    for (const { name, path, content } of entries) {
      const hash = this.hasher.hash(content);
      if (!(await this.fs.fileExists(path)) || !(await this.fs.readFileHash(path)).equals(hash)) {
        await this.fs.writeFile(path, content);
        written++;
      }
      hashes[name] = hash;
    }
    installed[options.host] = hashes;
    await this.store.save(options.projectRoot, installed);
    return written;
  }

  async remove(options: AgentTarget): Promise<number> {
    const installed = await this.load(options.projectRoot);
    const entries = await this.removable(options.projectRoot, installed, options.host);
    const count = await this.delete(entries);
    delete installed[options.host];
    await this.store.save(options.projectRoot, installed);
    return count;
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

  async removeAll(projectRoot: string): Promise<number> {
    const entries = await this.removable(projectRoot, await this.load(projectRoot));
    const count = await this.delete(entries);
    await this.store.save(projectRoot, {});
    return count;
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

  private async delete(paths: readonly string[]): Promise<number> {
    for (const path of paths) {
      await this.fs.deleteFile(path);
      if (await this.fs.fileExists(path)) throw new Error(`Could not remove agent: ${path}`);
    }
    return paths.length;
  }
}
