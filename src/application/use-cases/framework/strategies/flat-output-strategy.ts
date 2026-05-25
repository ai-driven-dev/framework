import { basename, join, relative } from "node:path";
import { FlatTargetExistsError, OutDirNotDirectoryError } from "../../../../domain/errors.js";
import { stripAgentFrontmatter } from "../../../../domain/formats/agent-frontmatter-strip.js";
import { rewriteClaudeRootInJson } from "../../../../domain/formats/claude-root-path-rewrite.js";
import {
  FLAT_MCP_OUTPUT_PATH,
  flatAgentPath,
  flatHooksFile,
  flatHooksScriptPath,
  flatMcpKeyPrefix,
  flatSkillPath,
  resolveClaudeRootSuffixForFlat,
} from "../../../../domain/formats/copilot-flat-paths.js";
import { parseFrontmatter, serializeFrontmatter } from "../../../../domain/formats/markdown.js";
import { rewriteRelativeLinks } from "../../../../domain/formats/relative-link-rewrite.js";
import { mergeVscodeMcp } from "../../../../domain/formats/vscode-mcp-merge.js";
import {
  PLUGIN_AGENT_INPUT_EXT,
  PLUGIN_HOOKS_RELATIVE,
  PLUGIN_MCP_RELATIVE,
} from "../../../../domain/models/framework-build.js";
import type { FileReader } from "../../../../domain/ports/file-reader.js";
import type { FileWriter } from "../../../../domain/ports/file-writer.js";
import { assertNoToolsPlaceholder } from "../shared-plugin-helpers.js";
import type { BuildOutputStrategy } from "./build-output-strategy.js";

export class FlatOutputStrategy implements BuildOutputStrategy {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly force: boolean,
    private readonly absOut: string,
    private readonly isDirectory: (path: string) => Promise<boolean>
  ) {}

  async preBuild(outDir: string): Promise<void> {
    const exists = await this.fs.fileExists(outDir);
    if (!exists || !(await this.isDirectory(outDir))) {
      throw new OutDirNotDirectoryError(outDir);
    }
  }

  async writePluginManifest(): Promise<number> {
    return 0;
  }

  async writeAgents(pluginName: string, pluginSrc: string): Promise<number> {
    const agentsSrc = join(pluginSrc, "agents");
    if (!(await this.fs.fileExists(agentsSrc))) return 0;
    const files = await this.fs.listFilesRecursive(agentsSrc);
    let count = 0;
    for (const absPath of files) {
      if (!absPath.endsWith(PLUGIN_AGENT_INPUT_EXT)) continue;
      count += await this.writeAgentFile(pluginName, absPath, agentsSrc);
    }
    return count;
  }

  private async writeAgentFile(
    pluginName: string,
    absPath: string,
    agentsSrc: string
  ): Promise<number> {
    const content = await this.fs.readFile(absPath);
    const srcRelPath = `agents/${relative(agentsSrc, absPath).replace(/\\/g, "/")}`;
    assertNoToolsPlaceholder(content, pluginName, srcRelPath);
    const agentBaseName = basename(absPath);
    const flatRelPath = flatAgentPath(pluginName, agentBaseName);
    const destPath = join(this.absOut, flatRelPath);
    await this.checkCollision(destPath, pluginName);
    const { frontmatter, body } = parseFrontmatter(content);
    const stripped = stripAgentFrontmatter(frontmatter);
    const rewrittenBody = rewriteRelativeLinks(body, {
      currentFilePluginRelative: flatRelPath,
      resolveTargetPath: (rel) => this.resolveTargetForMd(pluginName, rel, flatRelPath),
    });
    await this.fs.writeFile(destPath, serializeFrontmatter(stripped, rewrittenBody));
    return 1;
  }

  async writeSkills(pluginName: string, pluginSrc: string): Promise<number> {
    const skillsSrc = join(pluginSrc, "skills");
    if (!(await this.fs.fileExists(skillsSrc))) return 0;
    const files = await this.fs.listFilesRecursive(skillsSrc);
    let count = 0;
    for (const absPath of files) {
      count += await this.writeSkillFile(pluginName, absPath, skillsSrc);
    }
    return count;
  }

  private async writeSkillFile(
    pluginName: string,
    absPath: string,
    skillsSrc: string
  ): Promise<number> {
    const relFromSkills = relative(skillsSrc, absPath).replace(/\\/g, "/");
    const flatRelPath = flatSkillPath(pluginName, relFromSkills);
    const destPath = join(this.absOut, flatRelPath);
    await this.checkCollision(destPath, pluginName);
    const content = await this.fs.readFile(absPath);
    if (absPath.endsWith(".md")) {
      assertNoToolsPlaceholder(content, pluginName, relFromSkills);
      const rewritten = rewriteRelativeLinks(content, {
        currentFilePluginRelative: flatRelPath,
        resolveTargetPath: (rel) => this.resolveTargetForMd(pluginName, rel, flatRelPath),
      });
      await this.fs.writeFile(destPath, rewritten);
    } else {
      await this.fs.writeFile(destPath, content);
    }
    return 1;
  }

  async writeHooks(pluginName: string, pluginSrc: string): Promise<number> {
    const hooksSrc = join(pluginSrc, PLUGIN_HOOKS_RELATIVE);
    if (!(await this.fs.fileExists(hooksSrc))) return 0;
    const jsonCount = await this.writeHooksJson(pluginName, hooksSrc);
    const scriptCount = await this.writeHooksSiblings(pluginName, pluginSrc);
    return jsonCount + scriptCount;
  }

  private async writeHooksJson(pluginName: string, hooksSrc: string): Promise<number> {
    const raw = await this.fs.readFile(hooksSrc);
    const parsed = JSON.parse(raw) as unknown;
    const rewritten = rewriteClaudeRootInJson(parsed, (suffix) =>
      resolveClaudeRootSuffixForFlat(suffix, pluginName, "relative")
    );
    const destPath = join(this.absOut, flatHooksFile(pluginName));
    await this.checkCollision(destPath, pluginName);
    await this.fs.writeFile(destPath, `${JSON.stringify(rewritten, null, 2)}\n`);
    return 1;
  }

  private async writeHooksSiblings(pluginName: string, pluginSrc: string): Promise<number> {
    const hooksDir = join(pluginSrc, "hooks");
    const files = await this.fs.listFilesRecursive(hooksDir);
    let count = 0;
    for (const absPath of files) {
      if (absPath.endsWith("hooks.json")) continue;
      const relPath = relative(hooksDir, absPath).replace(/\\/g, "/");
      const destPath = join(this.absOut, flatHooksScriptPath(pluginName, relPath));
      await this.checkCollision(destPath, pluginName);
      await this.fs.writeFile(destPath, await this.fs.readFile(absPath));
      count++;
    }
    return count;
  }

  async writeMcp(pluginName: string, pluginSrc: string): Promise<number> {
    const mcpSrc = join(pluginSrc, PLUGIN_MCP_RELATIVE);
    if (!(await this.fs.fileExists(mcpSrc))) return 0;
    const raw = await this.fs.readFile(mcpSrc);
    const parsed = JSON.parse(raw) as { mcpServers?: Record<string, unknown> };
    const rawServers = parsed.mcpServers ?? {};
    const prefix = flatMcpKeyPrefix(pluginName);
    const prefixed = this.prefixMcpServers(rawServers, prefix, pluginName);
    const mcpDest = join(this.absOut, FLAT_MCP_OUTPUT_PATH);
    const existingContent = (await this.fs.fileExists(mcpDest))
      ? await this.fs.readFile(mcpDest)
      : null;
    const { mergedContent, collisions } = mergeVscodeMcp(existingContent, prefixed, this.force);
    if (collisions.length > 0) {
      throw new FlatTargetExistsError(mcpDest, pluginName);
    }
    await this.fs.writeFile(mcpDest, mergedContent);
    return 1;
  }

  async postBuild(): Promise<number> {
    return 0;
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async checkCollision(destPath: string, pluginName: string): Promise<void> {
    if (!this.force && (await this.fs.fileExists(destPath))) {
      throw new FlatTargetExistsError(destPath, pluginName);
    }
  }

  private prefixMcpServers(
    rawServers: Record<string, unknown>,
    prefix: string,
    pluginName: string
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawServers)) {
      const rewritten = rewriteClaudeRootInJson(value, (suffix) =>
        resolveClaudeRootSuffixForFlat(suffix, pluginName, "absolute", this.absOut)
      );
      result[`${prefix}${key}`] = rewritten;
    }
    return result;
  }

  private resolveTargetForMd(
    pluginName: string,
    pluginRelPath: string,
    _currentFlatRelPath: string
  ): string {
    if (pluginRelPath.startsWith("agents/")) {
      const baseName = basename(pluginRelPath);
      return flatAgentPath(pluginName, baseName);
    }
    if (pluginRelPath.startsWith("skills/")) {
      const rest = pluginRelPath.slice("skills/".length);
      return flatSkillPath(pluginName, rest);
    }
    return pluginRelPath;
  }
}
