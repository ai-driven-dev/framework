import { join } from "node:path";
import { PluginNotFoundError } from "../../../domain/errors.js";
import { parseFrontmatter, serializeFrontmatter } from "../../../domain/formats/markdown.js";
import { DOCS_DIR } from "../../../domain/models/paths.js";
import type { Plugin } from "../../../domain/models/plugin.js";
import { SyncPolicy } from "../../../domain/models/sync-policy.js";
import type { AiToolId } from "../../../domain/models/tool-ids.js";
import { AI_TOOL_IDS } from "../../../domain/models/tool-ids.js";
import type { FileSystem } from "../../../domain/ports/file-system.js";
import type { Hasher } from "../../../domain/ports/hasher.js";
import type { Logger } from "../../../domain/ports/logger.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import type { Prompter } from "../../../domain/ports/prompter.js";
import type {
  AiTool,
  HasAgents,
  HasCommands,
  HasRules,
  HasSkills,
  UserFileSectionKey,
} from "../../../domain/tools/contracts.js";
import { getToolConfig, isAiTool, type ToolId } from "../../../domain/tools/registry.js";
import { InputRequiredError, NoManifestError, ToolNotInstalledError } from "../../errors.js";
import type { SyncPluginsUseCase } from "./sync-plugins-use-case.js";

function canonicalFrameworkKey(frameworkPath: string): string {
  for (const id of AI_TOOL_IDS) {
    const suffix = `.${id}.md`;
    if (frameworkPath.endsWith(suffix)) {
      return frameworkPath.slice(0, -suffix.length);
    }
  }
  return frameworkPath;
}

type SyncCapabilities = HasAgents & HasSkills & Partial<HasCommands & HasRules>;

interface SyncOptions {
  projectRoot: string;
  docsDir?: string;
  sourceTool?: ToolId;
  targetTools?: ToolId[];
  force?: boolean;
  includeUserFiles?: boolean;
  interactive?: boolean;
  pluginName?: string;
  includePlugins?: boolean;
}

interface SyncFileResult {
  relativePath: string;
  conflict: boolean;
  skipped: boolean;
  written: boolean;
  deleted?: boolean;
}

interface SyncToolResult {
  targetToolId: ToolId;
  files: SyncFileResult[];
}

interface PropagateModifiedCtx {
  sourceManifestFiles: ReadonlyArray<{
    relativePath: string;
    hash: { value: string };
    frameworkPath?: string;
  }>;
  sourceConfig: AiTool<unknown>;
  targetConfig: AiTool<unknown>;
  targetManifestMap: Map<string, { value: string }>;
  targetByFrameworkPath: Map<string, string>;
  fileResults: SyncFileResult[];
  projectRoot: string;
  docsDir: string;
  force: boolean;
}

interface SyncResult {
  sourceTool: ToolId;
  tools: SyncToolResult[];
  totalWritten: number;
  totalDeleted: number;
  totalConflicts: number;
  totalSkipped: number;
}

function getSectionKeyFromFrameworkPath(frameworkPath: string): UserFileSectionKey | null {
  if (frameworkPath.startsWith("agents/"))
    return { section: "agents", key: frameworkPath.slice("agents/".length) };
  if (frameworkPath.startsWith("commands/"))
    return { section: "commands", key: frameworkPath.slice("commands/".length) };
  if (frameworkPath.startsWith("rules/"))
    return { section: "rules", key: frameworkPath.slice("rules/".length) };
  if (frameworkPath.startsWith("skills/"))
    return { section: "skills", key: frameworkPath.slice("skills/".length) };
  return null;
}

function getSyncCapabilities(config: AiTool<unknown>): SyncCapabilities {
  return config.capabilities as SyncCapabilities;
}

function reverseConvertSection(
  config: AiTool<unknown>,
  sectionKey: UserFileSectionKey,
  frontmatter: Record<string, unknown>
): Record<string, unknown> {
  const caps = getSyncCapabilities(config);
  if (sectionKey.section === "agents") return caps.agents.reverseConvertFrontmatter(frontmatter);
  if (sectionKey.section === "commands")
    return caps.commands?.reverseConvertFrontmatter(frontmatter) ?? frontmatter;
  if (sectionKey.section === "rules")
    return caps.rules?.reverseConvertFrontmatter(frontmatter) ?? frontmatter;
  return caps.skills.reverseConvertFrontmatter(frontmatter);
}

function convertSection(
  config: AiTool<unknown>,
  sectionKey: UserFileSectionKey,
  frontmatter: Record<string, unknown>
): Record<string, unknown> {
  const caps = getSyncCapabilities(config);
  if (sectionKey.section === "agents") return caps.agents.convertFrontmatter(frontmatter);
  if (sectionKey.section === "commands")
    return caps.commands?.convertFrontmatter(frontmatter, sectionKey.key) ?? frontmatter;
  if (sectionKey.section === "rules")
    return caps.rules?.convertFrontmatter(frontmatter) ?? frontmatter;
  return caps.skills.convertFrontmatter(frontmatter);
}

function transformContent(
  content: string,
  sourceConfig: AiTool<unknown>,
  targetConfig: AiTool<unknown>,
  sectionKey: UserFileSectionKey,
  docsDir: string
): string {
  const { frontmatter, body } = parseFrontmatter(content);
  const canonicalFrontmatter = reverseConvertSection(sourceConfig, sectionKey, frontmatter);
  const targetFrontmatter = convertSection(targetConfig, sectionKey, canonicalFrontmatter);
  const canonicalBody = sourceConfig.reverseRewriteContent(body, docsDir);
  const targetBody = targetConfig.rewriteContent(canonicalBody, docsDir);
  return serializeFrontmatter(targetFrontmatter, targetBody);
}

function buildTargetPath(
  targetConfig: AiTool<unknown>,
  sectionKey: UserFileSectionKey
): string | null {
  const caps = getSyncCapabilities(targetConfig);
  if (sectionKey.section === "agents") return caps.agents.buildUserFilePath(sectionKey.key);
  if (sectionKey.section === "commands")
    return caps.commands?.buildInstallPath(sectionKey.key) ?? null;
  if (sectionKey.section === "rules") return caps.rules?.buildInstallPath(sectionKey.key) ?? null;
  return caps.skills.buildInstallPath(sectionKey.key);
}

function buildReverseComponentMap(plugin: Plugin): Map<string, string> {
  const rev = new Map<string, string>();
  for (const [installPath, componentPath] of plugin.componentPaths) {
    rev.set(componentPath, installPath);
  }
  return rev;
}

export class SyncUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly hasher: Hasher,
    private readonly logger: Logger,
    private readonly prompter?: Prompter,
    private readonly syncPluginsUseCase?: SyncPluginsUseCase
  ) {}

  async execute(options: SyncOptions): Promise<SyncResult> {
    const { projectRoot, force = false, includeUserFiles = false, pluginName } = options;
    const manifest = await this.manifestRepo.load();
    if (manifest === null) throw new NoManifestError();

    if (pluginName !== undefined) {
      return this.executePluginSync(pluginName, projectRoot, manifest);
    }

    const docsDir = options.docsDir ?? DOCS_DIR;
    const { sourceTool, targetTools } = await this.selectSyncScope(
      options,
      manifest,
      options.interactive ?? false
    );
    const sourceConfigRaw = getToolConfig(sourceTool);
    if (!isAiTool(sourceConfigRaw)) {
      throw new InputRequiredError(`Source tool '${sourceTool}' does not support sync.`);
    }
    const sourceConfig = sourceConfigRaw;
    const sourceManifestFiles = manifest.getToolFiles(sourceTool);
    const sourceManifestMap = new Map(sourceManifestFiles.map((f) => [f.relativePath, f.hash]));

    const toolResults = await this.syncAllTargets(
      targetTools,
      sourceTool,
      sourceConfig,
      sourceManifestFiles,
      sourceManifestMap,
      manifest,
      projectRoot,
      docsDir,
      force,
      includeUserFiles
    );

    const totals = this.buildSyncTotals(sourceTool, toolResults);
    await this.maybeSyncPlugins(options, sourceTool, targetTools, projectRoot, force);
    return totals;
  }

  private async maybeSyncPlugins(
    options: SyncOptions,
    sourceTool: ToolId,
    targetTools: ToolId[],
    projectRoot: string,
    force: boolean
  ): Promise<void> {
    if (options.includePlugins === false || this.syncPluginsUseCase === undefined) return;
    const aiSourceId = AI_TOOL_IDS.find((id) => id === sourceTool);
    if (aiSourceId === undefined) return;
    const aiTargetIds = targetTools.filter((id): id is AiToolId =>
      (AI_TOOL_IDS as readonly string[]).includes(id)
    );
    if (aiTargetIds.length === 0) return;
    await this.syncPluginsUseCase.execute({
      projectRoot,
      sourceToolId: aiSourceId,
      targetToolIds: aiTargetIds,
      force,
      interactive: options.interactive,
    });
  }

  private async syncAllTargets(
    targetTools: ToolId[],
    sourceTool: ToolId,
    sourceConfig: AiTool<unknown>,
    sourceManifestFiles: ReadonlyArray<{
      relativePath: string;
      hash: { value: string };
      frameworkPath?: string;
    }>,
    sourceManifestMap: Map<string, { value: string }>,
    manifest: Awaited<ReturnType<ManifestRepository["load"]>> & object,
    projectRoot: string,
    docsDir: string,
    force: boolean,
    includeUserFiles: boolean
  ): Promise<SyncToolResult[]> {
    const toolResults: SyncToolResult[] = [];
    for (const targetToolId of targetTools) {
      this.logger.info(`Syncing ${sourceTool} → ${targetToolId}...`);
      const result = await this.syncOneTool(
        targetToolId,
        sourceConfig,
        sourceManifestFiles,
        sourceManifestMap,
        manifest,
        projectRoot,
        docsDir,
        force,
        includeUserFiles
      );
      toolResults.push(result);
    }
    return toolResults;
  }

  private async syncOneTool(
    targetToolId: ToolId,
    sourceConfig: AiTool<unknown>,
    sourceManifestFiles: ReadonlyArray<{
      relativePath: string;
      hash: { value: string };
      frameworkPath?: string;
    }>,
    sourceManifestMap: Map<string, { value: string }>,
    manifest: Awaited<ReturnType<ManifestRepository["load"]>> & object,
    projectRoot: string,
    docsDir: string,
    force: boolean,
    includeUserFiles: boolean
  ): Promise<SyncToolResult> {
    const targetConfigRaw = getToolConfig(targetToolId);
    if (!isAiTool(targetConfigRaw)) {
      return { targetToolId, files: [] };
    }
    const targetConfig = targetConfigRaw;
    const targetManifestFiles = manifest.getToolFiles(targetToolId);
    const targetManifestMap = new Map(targetManifestFiles.map((f) => [f.relativePath, f.hash]));
    const targetByFrameworkPath = new Map(
      targetManifestFiles
        .filter((f): f is typeof f & { frameworkPath: string } => f.frameworkPath !== undefined)
        .map((f) => [canonicalFrameworkKey(f.frameworkPath), f.relativePath])
    );
    const fileResults: SyncFileResult[] = [];
    await this.propagateModified({
      sourceManifestFiles,
      sourceConfig,
      targetConfig,
      targetManifestMap,
      targetByFrameworkPath,
      fileResults,
      projectRoot,
      docsDir,
      force,
    });
    await this.propagateAdded({
      sourceManifestMap,
      sourceConfig,
      targetConfig,
      fileResults,
      projectRoot,
      docsDir,
      includeUserFiles,
    });
    await this.propagateDeleted({
      sourceManifestFiles,
      targetByFrameworkPath,
      fileResults,
      projectRoot,
      docsDir,
    });
    await this.propagatePluginsModified(
      sourceConfig,
      targetConfig,
      manifest,
      fileResults,
      projectRoot,
      docsDir,
      force
    );
    await this.propagatePluginsDeleted(
      sourceConfig,
      targetConfig,
      manifest,
      fileResults,
      projectRoot
    );
    return { targetToolId, files: fileResults };
  }

  /** Resolves sourceTool and targetTools from options — prompts if interactive. */
  private async selectSyncScope(
    options: SyncOptions,
    manifest: Awaited<ReturnType<ManifestRepository["load"]>> & object,
    interactive: boolean
  ): Promise<{ sourceTool: ToolId; targetTools: ToolId[] }> {
    if (options.sourceTool !== undefined) {
      return this.resolveExplicitScope(options, manifest);
    }
    return this.resolveInteractiveScope(manifest, interactive, options.projectRoot);
  }

  private resolveExplicitScope(
    options: SyncOptions,
    manifest: Awaited<ReturnType<ManifestRepository["load"]>> & object
  ): { sourceTool: ToolId; targetTools: ToolId[] } {
    const sourceTool = options.sourceTool as ToolId;

    if (!manifest.hasTool(sourceTool)) {
      throw new ToolNotInstalledError(sourceTool, "Source tool");
    }

    const installedToolIds = manifest.getInstalledToolIds();

    if (installedToolIds.length < 2) {
      throw new InputRequiredError("Sync requires at least 2 installed tools.");
    }

    const targetTools =
      options.targetTools && options.targetTools.length > 0
        ? options.targetTools
        : installedToolIds.filter((id) => id !== sourceTool);

    for (const target of targetTools) {
      if (target === sourceTool) {
        throw new InputRequiredError("Source and target cannot be the same tool.");
      }
      if (!manifest.hasTool(target)) {
        throw new ToolNotInstalledError(target, "Target tool");
      }
    }

    return { sourceTool, targetTools };
  }

  private async resolveInteractiveScope(
    manifest: Awaited<ReturnType<ManifestRepository["load"]>> & object,
    interactive: boolean,
    projectRoot: string
  ): Promise<{ sourceTool: ToolId; targetTools: ToolId[] }> {
    if (!interactive || this.prompter === undefined) {
      throw new InputRequiredError("Source tool required in non-interactive mode.");
    }

    const { SyncStatusUseCase } = await import("./sync-status-use-case.js");
    const installedIds = manifest.getInstalledToolIds();

    if (installedIds.length < 2) {
      throw new InputRequiredError("Sync requires at least 2 installed tools.");
    }

    const modCounts = await new SyncStatusUseCase(this.fs).execute(
      manifest,
      installedIds as ToolId[],
      projectRoot
    );

    const hasAnyChanges = installedIds.some((id) => {
      const { modified, deleted } = modCounts[id] ?? { modified: 0, deleted: 0 };
      return modified > 0 || deleted > 0;
    });

    if (!hasAnyChanges) {
      return { sourceTool: installedIds[0] as ToolId, targetTools: [] };
    }

    return this.promptSyncScope(installedIds as ToolId[], modCounts, this.prompter);
  }

  private async promptSyncScope(
    installedIds: ToolId[],
    modCounts: Record<string, { modified: number; deleted: number }>,
    prompter: Prompter
  ): Promise<{ sourceTool: ToolId; targetTools: ToolId[] }> {
    const sourceChoices = installedIds.map((id) => {
      const { modified, deleted } = modCounts[id] ?? { modified: 0, deleted: 0 };
      const hasChanges = modified > 0 || deleted > 0;
      const parts: string[] = [];
      if (modified > 0) parts.push(`${modified} modified`);
      if (deleted > 0) parts.push(`${deleted} deleted`);
      const label = hasChanges ? ` (${parts.join(", ")})` : "";
      return {
        name: `${id}${label}`,
        value: id as ToolId,
        disabled: hasChanges ? false : "(no changes)",
      };
    });

    const sourceTool = await prompter.select("Source tool to sync from?", sourceChoices);

    const targetChoices = installedIds
      .filter((id) => id !== sourceTool)
      .map((id) => ({ name: id, value: id as ToolId }));

    const targetTools = await prompter.checkbox("Target tools?", targetChoices);
    if (targetTools.length === 0) throw new InputRequiredError("No target tools selected.");

    return { sourceTool, targetTools };
  }

  private async executePluginSync(
    pluginName: string,
    projectRoot: string,
    manifest: Awaited<ReturnType<ManifestRepository["load"]>> & object
  ): Promise<SyncResult> {
    const toolIds = AI_TOOL_IDS.filter((id) => manifest.hasTool(id)) as AiToolId[];
    let firstMatchedTool: ToolId | undefined;
    for (const toolId of toolIds) {
      const found = await this.syncPluginForTool(toolId, pluginName, projectRoot, manifest);
      if (found && firstMatchedTool === undefined) firstMatchedTool = toolId;
    }
    if (firstMatchedTool === undefined) throw new PluginNotFoundError(pluginName);
    await this.manifestRepo.save(manifest);
    return {
      sourceTool: firstMatchedTool,
      tools: [],
      totalWritten: 0,
      totalDeleted: 0,
      totalConflicts: 0,
      totalSkipped: 0,
    };
  }

  private async syncPluginForTool(
    toolId: AiToolId,
    pluginName: string,
    projectRoot: string,
    manifest: Awaited<ReturnType<ManifestRepository["load"]>> & object
  ): Promise<boolean> {
    const plugin = manifest.getPlugins(toolId).find((p) => p.name === pluginName);
    if (plugin === undefined) return false;
    const newFiles = new Map<string, string>();
    for (const [relativePath] of plugin.files.entries()) {
      const fullPath = join(projectRoot, relativePath);
      if (!(await this.fs.fileExists(fullPath))) continue;
      const content = await this.fs.readFile(fullPath);
      newFiles.set(relativePath, this.hasher.hash(content).value);
    }
    manifest.updatePlugin(toolId, plugin.withFiles(newFiles));
    return true;
  }

  private buildSyncTotals(sourceTool: ToolId, toolResults: SyncToolResult[]): SyncResult {
    const count = (pred: (f: SyncFileResult) => boolean) =>
      toolResults.reduce((s, t) => s + t.files.filter(pred).length, 0);

    return {
      sourceTool,
      tools: toolResults,
      totalWritten: count((f) => f.written),
      totalDeleted: count((f) => Boolean(f.deleted)),
      totalConflicts: count((f) => f.conflict && !f.written),
      totalSkipped: count((f) => f.skipped),
    };
  }

  private async propagatePluginsModified(
    sourceConfig: AiTool<unknown>,
    targetConfig: AiTool<unknown>,
    manifest: Awaited<ReturnType<ManifestRepository["load"]>> & object,
    fileResults: SyncFileResult[],
    projectRoot: string,
    docsDir: string,
    force: boolean
  ): Promise<void> {
    const sourcePlugins = manifest.getPlugins(sourceConfig.toolId);
    const targetPlugins = manifest.getPlugins(targetConfig.toolId);
    for (const srcPlugin of sourcePlugins) {
      const tgtPlugin = targetPlugins.find((p) => p.name === srcPlugin.name);
      if (tgtPlugin === undefined) continue;
      const targetByComponent = buildReverseComponentMap(tgtPlugin);
      for (const [srcRelPath, manifestHash] of srcPlugin.files) {
        await this.propagateOnePluginModified(
          srcRelPath,
          manifestHash,
          srcPlugin,
          targetByComponent,
          sourceConfig,
          targetConfig,
          fileResults,
          projectRoot,
          docsDir,
          force
        );
      }
    }
  }

  private async propagateOnePluginModified(
    srcRelPath: string,
    manifestHash: string,
    srcPlugin: Plugin,
    targetByComponent: Map<string, string>,
    sourceConfig: AiTool<unknown>,
    targetConfig: AiTool<unknown>,
    fileResults: SyncFileResult[],
    projectRoot: string,
    docsDir: string,
    force: boolean
  ): Promise<void> {
    const componentPath = srcPlugin.componentPaths.get(srcRelPath);
    if (componentPath === undefined) return;
    const sectionKey = getSectionKeyFromFrameworkPath(componentPath);
    if (sectionKey === null) return;
    const tgtRelPath = targetByComponent.get(componentPath);
    if (tgtRelPath === undefined) return;
    const diskSrcPath = join(projectRoot, srcRelPath);
    if (!(await this.fs.fileExists(diskSrcPath))) return;
    const diskHash = await this.fs.readFileHash(diskSrcPath);
    if (diskHash.value === manifestHash) return;
    const srcContent = await this.fs.readFile(diskSrcPath);
    const tgtContent = transformContent(
      srcContent,
      sourceConfig,
      targetConfig,
      sectionKey,
      docsDir
    );
    const diskTgtPath = join(projectRoot, tgtRelPath);
    if (
      (await this.fs.fileExists(diskTgtPath)) &&
      (await this.fs.readFile(diskTgtPath)) === tgtContent
    ) {
      fileResults.push({
        relativePath: tgtRelPath,
        conflict: false,
        skipped: true,
        written: false,
      });
      return;
    }
    if (!force && (await this.fs.fileExists(diskTgtPath))) {
      fileResults.push({
        relativePath: tgtRelPath,
        conflict: true,
        skipped: false,
        written: false,
      });
      return;
    }
    await this.fs.writeFile(diskTgtPath, tgtContent);
    fileResults.push({ relativePath: tgtRelPath, conflict: false, skipped: false, written: true });
  }

  private async propagatePluginsDeleted(
    sourceConfig: AiTool<unknown>,
    targetConfig: AiTool<unknown>,
    manifest: Awaited<ReturnType<ManifestRepository["load"]>> & object,
    fileResults: SyncFileResult[],
    projectRoot: string
  ): Promise<void> {
    const sourcePlugins = manifest.getPlugins(sourceConfig.toolId);
    const targetPlugins = manifest.getPlugins(targetConfig.toolId);
    for (const srcPlugin of sourcePlugins) {
      const tgtPlugin = targetPlugins.find((p) => p.name === srcPlugin.name);
      if (tgtPlugin === undefined) continue;
      const targetByComponent = buildReverseComponentMap(tgtPlugin);
      for (const [srcRelPath] of srcPlugin.files) {
        if (await this.fs.fileExists(join(projectRoot, srcRelPath))) continue;
        const componentPath = srcPlugin.componentPaths.get(srcRelPath);
        if (componentPath === undefined) continue;
        const tgtRelPath = targetByComponent.get(componentPath);
        if (tgtRelPath === undefined) continue;
        const diskTgtPath = join(projectRoot, tgtRelPath);
        if (!(await this.fs.fileExists(diskTgtPath))) continue;
        await this.fs.deleteFile(diskTgtPath);
        fileResults.push({
          relativePath: tgtRelPath,
          conflict: false,
          skipped: false,
          written: false,
          deleted: true,
        });
      }
    }
  }

  private async propagateModified(ctx: PropagateModifiedCtx): Promise<void> {
    const {
      sourceManifestFiles,
      sourceConfig,
      targetConfig,
      targetManifestMap,
      targetByFrameworkPath,
      fileResults,
      projectRoot,
      docsDir,
      force,
    } = ctx;

    for (const sourceManifestFile of sourceManifestFiles) {
      await this.propagateOneModified(
        sourceManifestFile,
        sourceConfig,
        targetConfig,
        targetManifestMap,
        targetByFrameworkPath,
        fileResults,
        projectRoot,
        docsDir,
        force
      );
    }
  }

  private async propagateOneModified(
    sourceManifestFile: { relativePath: string; hash: { value: string }; frameworkPath?: string },
    sourceConfig: AiTool<unknown>,
    targetConfig: AiTool<unknown>,
    targetManifestMap: Map<string, { value: string }>,
    targetByFrameworkPath: Map<string, string>,
    fileResults: SyncFileResult[],
    projectRoot: string,
    docsDir: string,
    force: boolean
  ): Promise<void> {
    const { relativePath, hash: manifestHash, frameworkPath } = sourceManifestFile;
    if (new SyncPolicy(docsDir).isProtected(relativePath) || frameworkPath === undefined) return;

    const diskSourcePath = join(projectRoot, relativePath);
    if (!(await this.fs.fileExists(diskSourcePath))) return;
    const diskSourceHash = await this.fs.readFileHash(diskSourcePath);
    if (diskSourceHash.value === manifestHash.value) return;

    const sectionKey = getSectionKeyFromFrameworkPath(frameworkPath);
    const targetRelativePath = targetByFrameworkPath.get(canonicalFrameworkKey(frameworkPath));
    if (sectionKey === null || targetRelativePath === undefined) return;

    const diskSourceContent = await this.fs.readFile(diskSourcePath);
    const targetContent = transformContent(
      diskSourceContent,
      sourceConfig,
      targetConfig,
      sectionKey,
      docsDir
    );

    const diskTargetPath = join(projectRoot, targetRelativePath);
    const diskTargetExists = await this.fs.fileExists(diskTargetPath);
    const conflict = await this.detectTargetConflict(
      diskTargetExists,
      diskTargetPath,
      targetRelativePath,
      targetManifestMap
    );

    if (diskTargetExists && (await this.fs.readFile(diskTargetPath)) === targetContent) {
      fileResults.push({
        relativePath: targetRelativePath,
        conflict: false,
        skipped: true,
        written: false,
      });
      return;
    }
    if (conflict && !force) {
      fileResults.push({
        relativePath: targetRelativePath,
        conflict: true,
        skipped: false,
        written: false,
      });
      return;
    }
    await this.fs.writeFile(diskTargetPath, targetContent);
    fileResults.push({ relativePath: targetRelativePath, conflict, skipped: false, written: true });
  }

  private async detectTargetConflict(
    diskTargetExists: boolean,
    diskTargetPath: string,
    targetRelativePath: string,
    targetManifestMap: Map<string, { value: string }>
  ): Promise<boolean> {
    if (!diskTargetExists) return false;
    const diskTargetHash = await this.fs.readFileHash(diskTargetPath);
    const targetManifestHash = targetManifestMap.get(targetRelativePath);
    return targetManifestHash !== undefined && diskTargetHash.value !== targetManifestHash.value;
  }

  private async propagateAdded(ctx: {
    sourceManifestMap: Map<string, { value: string }>;
    sourceConfig: AiTool<unknown>;
    targetConfig: AiTool<unknown>;
    fileResults: SyncFileResult[];
    projectRoot: string;
    docsDir: string;
    includeUserFiles: boolean;
  }): Promise<void> {
    const {
      sourceManifestMap,
      sourceConfig,
      targetConfig,
      fileResults,
      projectRoot,
      docsDir,
      includeUserFiles,
    } = ctx;
    if (!includeUserFiles) return;

    const sourceDirExists = await this.fs.fileExists(join(projectRoot, sourceConfig.directory));
    if (!sourceDirExists) return;

    const sourceDiskFiles = await this.fs.listDirectory(join(projectRoot, sourceConfig.directory));
    for (const diskRelative of sourceDiskFiles) {
      await this.propagateOneAdded(
        diskRelative,
        sourceManifestMap,
        sourceConfig,
        targetConfig,
        fileResults,
        projectRoot,
        docsDir
      );
    }
  }

  private async propagateOneAdded(
    diskRelative: string,
    sourceManifestMap: Map<string, { value: string }>,
    sourceConfig: AiTool<unknown>,
    targetConfig: AiTool<unknown>,
    fileResults: SyncFileResult[],
    projectRoot: string,
    docsDir: string
  ): Promise<void> {
    const sourceRelativePath = `${sourceConfig.directory}${diskRelative}`;
    if (
      new SyncPolicy(docsDir).isProtected(sourceRelativePath) ||
      sourceManifestMap.has(sourceRelativePath)
    )
      return;

    const sectionKey = sourceConfig.detectUserFileSectionKey(sourceRelativePath);
    if (sectionKey === null) return;

    const targetRelativePath = buildTargetPath(targetConfig, sectionKey);
    if (targetRelativePath === null) return;

    const diskSourceContent = await this.fs.readFile(join(projectRoot, sourceRelativePath));
    const targetContent = transformContent(
      diskSourceContent,
      sourceConfig,
      targetConfig,
      sectionKey,
      docsDir
    );

    const diskTargetPath = join(projectRoot, targetRelativePath);
    if (
      (await this.fs.fileExists(diskTargetPath)) &&
      (await this.fs.readFile(diskTargetPath)) === targetContent
    ) {
      fileResults.push({
        relativePath: targetRelativePath,
        conflict: false,
        skipped: true,
        written: false,
      });
      return;
    }

    await this.fs.writeFile(diskTargetPath, targetContent);
    fileResults.push({
      relativePath: targetRelativePath,
      conflict: false,
      skipped: false,
      written: true,
    });
  }

  private async propagateDeleted(ctx: {
    sourceManifestFiles: ReadonlyArray<{ relativePath: string; frameworkPath?: string }>;
    targetByFrameworkPath: Map<string, string>;
    fileResults: SyncFileResult[];
    projectRoot: string;
    docsDir: string;
  }): Promise<void> {
    const { sourceManifestFiles, targetByFrameworkPath, fileResults, projectRoot, docsDir } = ctx;
    for (const sourceManifestFile of sourceManifestFiles) {
      await this.propagateOneDeleted(
        sourceManifestFile,
        targetByFrameworkPath,
        fileResults,
        projectRoot,
        docsDir
      );
    }
  }

  private async propagateOneDeleted(
    sourceManifestFile: { relativePath: string; frameworkPath?: string },
    targetByFrameworkPath: Map<string, string>,
    fileResults: SyncFileResult[],
    projectRoot: string,
    docsDir: string
  ): Promise<void> {
    const { relativePath, frameworkPath } = sourceManifestFile;
    if (new SyncPolicy(docsDir).isProtected(relativePath) || frameworkPath === undefined) return;
    if (await this.fs.fileExists(join(projectRoot, relativePath))) return;

    const targetRelativePath = targetByFrameworkPath.get(canonicalFrameworkKey(frameworkPath));
    if (targetRelativePath === undefined) return;

    const diskTargetPath = join(projectRoot, targetRelativePath);
    if (!(await this.fs.fileExists(diskTargetPath))) return;

    await this.fs.deleteFile(diskTargetPath);
    fileResults.push({
      relativePath: targetRelativePath,
      conflict: false,
      skipped: false,
      written: false,
      deleted: true,
    });
  }
}
