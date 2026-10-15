import { join } from "node:path";
import { parseFrontmatter } from "../../../kernel/markdown.js";
import { AIDD_CONFIG_FILENAME, AIDD_DIR } from "../../../kernel/paths.js";
import type { FileReader } from "../../../kernel/ports/file-reader.js";
import { isAiToolId } from "../../../kernel/tool.js";
import type { AiTool, HasAgents } from "../../tools/domain/contracts.js";
import type { HostPluginRegistryReader } from "../../tools/domain/ports/host-plugin-registry-reader.js";
import { getAiToolConfig, resolvePluginsCapability } from "../../tools/domain/registry.js";
import { type DelegationResolution, parseDelegation } from "../domain/delegation.js";
import type { ManifestRepository } from "../domain/ports/manifest-repository.js";
import { resolveBaseDirFromRecord } from "./plugin/plugin-target-resolution.js";

function hasAgents(tool: AiTool<unknown>): tool is AiTool<HasAgents> {
  return "agents" in (tool.capabilities as object);
}

/** Reads project suggestions and installed artifacts. It neither writes settings nor starts agents. */
export class ResolveDelegationUseCase {
  constructor(
    private readonly fs: FileReader,
    private readonly manifest: ManifestRepository,
    private readonly registries: ReadonlyMap<string, HostPluginRegistryReader>
  ) {}

  async execute(options: {
    projectRoot: string;
    home: string;
    env: NodeJS.ProcessEnv;
    task: string;
    tool: string;
  }): Promise<DelegationResolution> {
    if (!isAiToolId(options.tool))
      throw new Error(`Unknown tool "${options.tool}"; use an installed AI tool identifier.`);
    const tool = getAiToolConfig(options.tool);
    const configPath = join(options.projectRoot, AIDD_DIR, AIDD_CONFIG_FILENAME);
    const raw = (await this.fs.fileExists(configPath)) ? await this.fs.readFile(configPath) : null;
    const suggestion = parseDelegation(raw, options.task, options.tool, configPath);
    const base = {
      task: options.task,
      tool: options.tool,
      effectiveRuntime: "unknown" as const,
      nativeSurface: "agent-configuration" as const,
      diagnostics: [],
    };
    if (suggestion === undefined) return { ...base, configured: false, requested: {}, native: {} };
    if (!hasAgents(tool) || tool.capabilities.agents.params.delegation === undefined)
      throw new Error(
        `${tool.displayName} does not support delegation resolution; select a supported tool.`
      );
    const capability = tool.capabilities.agents.params.delegation;
    const { plugin, role } = suggestion;
    const artifact = tool.buildContracts?.flat?.().artifacts.agents;
    const flatPath = artifact?.supported ? artifact.path(plugin, `agents/${role}.md`) : undefined;
    const paths: { path: string; mode: "flat" | "marketplace" }[] = [];
    if (flatPath !== undefined)
      paths.push({ path: join(options.projectRoot, flatPath), mode: "flat" });
    const personal = {
      path: capability.userPath(options.home, options.env, plugin, role),
      mode: "flat" as const,
    };
    if (capability.personalAgentsFirst) paths.unshift(personal);
    else paths.push(personal);
    const findAgent = async (): Promise<DelegationResolution | undefined> => {
      for (const candidate of paths) {
        if (!(await this.fs.fileExists(candidate.path))) continue;
        const native = capability.resolveNative(suggestion.requested, candidate.mode);
        const content = await this.fs.readFile(candidate.path);
        const declared =
          capability.readName?.(content) ?? parseFrontmatter(content).frontmatter.name;
        const name =
          typeof declared === "string" && declared !== ""
            ? declared
            : candidate.mode === "marketplace"
              ? role
              : `${plugin}-${role}`;
        return {
          ...base,
          nativeSurface: capability.nativeSurface?.(candidate.mode) ?? "agent-configuration",
          configured: true,
          canonicalAgent: suggestion.canonical,
          requested: suggestion.requested,
          native,
          diagnostics: capability.diagnostics?.(content, suggestion.requested) ?? [],
          agent: { name: capability.identity(name, plugin, candidate.mode, role), ...candidate },
        };
      }
      return undefined;
    };
    const flat = await findAgent();
    if (flat !== undefined) return flat;
    const manifest = await this.manifest.load();
    const recorded = manifest?.getPlugins(options.tool).find((entry) => entry.name === plugin);
    const plugins = resolvePluginsCapability(options.tool);
    if (plugins?.nativeActivation === null && capability.marketplacePath !== undefined) {
      const baseDir =
        recorded === undefined
          ? plugins.resolvePluginsBaseDir(options.projectRoot, options.home)
          : resolveBaseDirFromRecord(
              recorded.scope,
              options.tool,
              options.projectRoot,
              () => options.home
            );
      const pluginDir = plugins.pluginOutputDir(plugin);
      if (pluginDir !== null)
        paths.push({
          path: capability.marketplacePath(join(baseDir, pluginDir), role),
          mode: "marketplace",
        });
    }
    const registry = this.registries.get(options.tool);
    const unavailable: string[] = [];
    if (registry !== undefined && capability.marketplacePath !== undefined) {
      const reading = await registry.read(options.projectRoot, true);
      if (reading.unreadable !== undefined)
        throw new Error(
          `${reading.location}: cannot verify installed agent (${reading.unreadable}); repair the native plugin registry or install a project agent.`
        );
      for (const [ref, entry] of reading.refs ?? []) {
        if (!ref.startsWith(`${plugin}@`)) continue;
        if (entry.activationUnverified !== undefined)
          unavailable.push(`${ref}: ${entry.activationUnverified}`);
        else if (!entry.enabled)
          unavailable.push(
            `${ref} is disabled; enable this plugin in ${tool.displayName}, then retry.`
          );
        else if (entry.installPath !== undefined)
          paths.push({
            path: capability.marketplacePath(entry.installPath, role),
            mode: "marketplace",
          });
      }
    }
    const installed = await findAgent();
    if (installed !== undefined) return installed;
    if (unavailable.length > 0)
      throw new Error(`Agent ${suggestion.canonical} unavailable: ${unavailable.join(" ")}`);
    throw new Error(
      `Agent ${suggestion.canonical} not found for ${tool.displayName}; install the plugin or its native agent, then retry. Checked: ${paths.map((entry) => entry.path).join(", ")}.`
    );
  }
}
