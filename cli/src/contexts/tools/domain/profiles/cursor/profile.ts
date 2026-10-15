import { join } from "node:path";
import { AgentsCapability } from "../../capabilities/agents-capability.js";
import { CommandsCapability } from "../../capabilities/commands-capability.js";
import { CONFIG_MCP } from "../../capabilities/config-refs.js";
import { McpCapability } from "../../capabilities/mcp-capability.js";
import { PluginsCapability } from "../../capabilities/plugins-capability.js";
import { RulesCapability } from "../../capabilities/rules-capability.js";
import { SkillsCapability } from "../../capabilities/skills-capability.js";
import type {
  AiTool,
  HasAgents,
  HasCommands,
  HasMcp,
  HasPlugins,
  HasRules,
  HasSkills,
} from "../../contracts.js";
import {
  buildAiddCommandFilePath,
  convertCommandFrontmatter,
  stripToolSuffix,
} from "../../formats/command.js";
import { embeddedAgentOptions } from "../../formats/delegation-options.js";
import { CURSOR_PLUGIN_ROOT_TOKEN } from "../../formats/plugin-root-token.js";
import { registerTool } from "../../registry.js";
import { buildCursorContract, buildCursorFlatContract } from "./build.js";

const DIRECTORY = ".cursor/";
const TOOL_SUFFIX = ".cursor.md";
const MDC_EXT = ".mdc";

function toMdc(fileName: string): string {
  return fileName.endsWith(".md") ? `${fileName.slice(0, -3)}${MDC_EXT}` : fileName;
}

export const cursor: AiTool<HasAgents & HasSkills & HasCommands & HasRules & HasMcp & HasPlugins> =
  {
    kind: "ai",
    toolId: "cursor",
    distributionProbes: {
      manifest: [".cursor-plugin/plugin.json"],
      marketplace: [".cursor-plugin/marketplace.json"],
    },
    directory: DIRECTORY,
    toolSuffix: TOOL_SUFFIX,
    displayName: "Cursor",
    signalDir: ".cursor/commands",
    configOutputPaths: { "settings.json": ".cursor/settings.json" },
    buildContracts: { marketplace: buildCursorContract, flat: buildCursorFlatContract },

    capabilities: {
      agents: new AgentsCapability({
        directory: DIRECTORY,
        toolSuffix: TOOL_SUFFIX,
        format: "markdown",
        delegation: {
          userPath: (home, _env, plugin, role) =>
            join(home, ".cursor", "agents", `${plugin}-${role}.md`),
          identity: (name, plugin, mode, role) => {
            const expected = `${plugin}-${role}`;
            if (mode === "marketplace" && name !== expected)
              throw new Error(
                `Plugin agent ${name} has a collision-prone name; reinstall its translated plugin to obtain ${expected}.`
              );
            return name;
          },
          resolveNative: (requested, mode) => {
            if (mode === "marketplace") {
              if (requested.effort !== undefined)
                throw new Error(
                  "Cursor plugin spawn does not accept effort; choose an advertised model slug or omit effort to inherit."
                );
              return requested.model === undefined ? {} : { model: requested.model };
            }
            return embeddedAgentOptions(requested, (model, effort) => {
              if (!/^[a-zA-Z0-9_.-]+$/.test(effort))
                throw new Error(
                  "Invalid effort option: use a model parameter value without spaces or brackets."
                );
              const open = model.indexOf("[");
              const malformed = () =>
                new Error(
                  "Malformed model option group: use one [key=value,...] group with unique keys before specifying effort."
                );
              if (open === -1) {
                if (model.includes("]")) throw malformed();
                return `${model}[effort=${effort}]`;
              }
              if (
                open === 0 ||
                model.indexOf("[", open + 1) !== -1 ||
                model.indexOf("]") !== model.length - 1
              )
                throw malformed();
              const keys = new Set<string>();
              let selectedEffort: string | undefined;
              for (const option of model.slice(open + 1, -1).split(",")) {
                const equals = option.indexOf("=");
                const key = option.slice(0, equals);
                const value = option.slice(equals + 1);
                if (
                  equals < 1 ||
                  value === "" ||
                  value.includes("=") ||
                  /\s/.test(option) ||
                  keys.has(key)
                )
                  throw malformed();
                keys.add(key);
                if (key === "effort") selectedEffort = value;
              }
              if (selectedEffort !== undefined) {
                if (selectedEffort === effort) return model;
                throw new Error(
                  "Conflicting model effort option: remove [effort=...] before specifying a different effort."
                );
              }
              return `${model.slice(0, -1)},effort=${effort}]`;
            });
          },
          marketplacePath: (root, role) => join(root, "agents", `${role}.md`),
          nativeSurface: (mode) => (mode === "marketplace" ? "spawn" : "agent-configuration"),
        },
      }),
      skills: new SkillsCapability({
        directory: DIRECTORY,
        toolSuffix: TOOL_SUFFIX,
        buildInstallPath: (fileName) =>
          `${DIRECTORY}skills/${stripToolSuffix(TOOL_SUFFIX, fileName)}`,
        convertFrontmatter: (fm) => fm,
      }),
      commands: new CommandsCapability({
        directory: DIRECTORY,
        toolSuffix: TOOL_SUFFIX,
        buildInstallPath: (fileName) => buildAiddCommandFilePath(DIRECTORY, fileName),
        convertFrontmatter: (fm, relativeFileName) =>
          convertCommandFrontmatter(fm, relativeFileName),
      }),
      rules: new RulesCapability({
        directory: DIRECTORY,
        toolSuffix: TOOL_SUFFIX,
        buildInstallPath: (fileName) =>
          `${DIRECTORY}rules/${toMdc(stripToolSuffix(TOOL_SUFFIX, fileName))}`,
        convertFrontmatter: (fm) => {
          const { paths, globs, description } = fm;
          const patterns = Array.isArray(paths) ? paths : Array.isArray(globs) ? globs : null;
          if (patterns === null || patterns.length === 0) {
            if (fm.alwaysApply === false && description !== undefined) {
              return { description, alwaysApply: false };
            }
            return {};
          }
          const result: Record<string, unknown> = {};
          if (description !== undefined) result.description = description;
          return {
            ...result,
            globs: JSON.stringify(patterns).replace(/,/g, ", "),
            alwaysApply: false,
          };
        },
      }),
      mcp: new McpCapability({
        outputPath: `${DIRECTORY}mcp.json`,
        format: "json",
        entrySection: "mcpServers",
        consumes: [CONFIG_MCP],
      }),
      plugins: new PluginsCapability({
        mode: "native",
        // Empty so the translator computes pluginRoot as `<pluginName>/`, giving base-relative
        // keys such as "aidd-context/commands/foo.md".
        pluginsDir: "",
        pluginManifestRelativePath: null,
        // Cursor auto-discovers mcp.json at a plugin's root but never a plugin-scope
        // hooks.json — three probes fired zero of seven events. Only a project-scope
        // .cursor/hooks.json is ever observed firing, so `hooksDestination` routes hooks there;
        // `hooksRelativePath` and `hooksContentFormat` stay declared for the shape they
        // describe but are no longer read for Cursor's own install.
        acceptsHooks: true,
        pluginRootToken: CURSOR_PLUGIN_ROOT_TOKEN,
        hooksRelativePath: "hooks.json",
        hooksContentFormat: "flat",
        hooksDestination: "project",
        projectHooksRelativePath: ".cursor/hooks.json",
        acceptsMcp: true,
        mcpRelativePath: "mcp.json",
        installScope: "user",
        userPluginsDir: (h) => join(h, ".cursor", "plugins", "local"),
      }),
    },

    rewriteContent(content: string): string {
      return content
        .replace(
          /(@?)\.cursor\/commands\/(\d+)[_-][^/]+\/([^\s]+)/g,
          "$1.cursor/commands/aidd/$2/$3"
        )
        .replace(/(@\.cursor\/rules\/[^\s]+)\.md\b/g, "$1.mdc");
    },
  };

registerTool(cursor);
