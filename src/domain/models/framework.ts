import type { IdeToolId } from "./tool-ids.js";

export const TOOLS_PLACEHOLDER = "{{TOOLS}}/";
export const DOCS_PLACEHOLDER = "{{DOCS}}/";
export const AT_TOOLS_PLACEHOLDER = "@{{TOOLS}}/";
export const AT_DOCS_PLACEHOLDER = "@{{DOCS}}/";

export const CONFIG_MCP = "mcp";
export const CONFIG_VSCODE_SETTINGS = "vscodeSettings";
export const CONFIG_VSCODE_EXTENSIONS = "vscodeExtensions";
export const CONFIG_VSCODE_KEYBINDINGS = "vscodeKeybindings";
export const CONFIG_COPILOT_VSCODE_SETTINGS = "copilotVscodeSettings";
export const CONFIG_OPENCODE = "opencode";

export const TEMPLATE_AGENTS_MD = "agentsMd";

export const SCRIPT_UPDATE_MEMORY = "updateMemory";

export const GITKEEP_FILE = ".gitkeep";
export const FRAMEWORK_CONFIG_PREFIX = "config/";

export interface ContentSection {
  readonly name: string;
  readonly directory: string;
  readonly entryFile: string | null;
}

export interface TemplateRef {
  readonly name: string;
  readonly path: string;
}

export interface ConfigRef {
  readonly name: string;
  readonly path: string;
  readonly requiredIdeId?: IdeToolId;
}

export interface ScriptRef {
  readonly name: string;
  readonly path: string;
  readonly invocation: string;
}

export class FrameworkDescriptor {
  readonly version: string;
  readonly contentSections: readonly ContentSection[];
  readonly templateRefs: readonly TemplateRef[];
  readonly configRefs: readonly ConfigRef[];
  readonly scriptRefs: readonly ScriptRef[];

  constructor(params: {
    version: string;
    contentSections: ContentSection[];
    templateRefs: TemplateRef[];
    configRefs: ConfigRef[];
    scriptRefs: ScriptRef[];
  }) {
    this.version = params.version;
    this.contentSections = Object.freeze([...params.contentSections]);
    this.templateRefs = Object.freeze([...params.templateRefs]);
    this.configRefs = Object.freeze([...params.configRefs]);
    this.scriptRefs = Object.freeze([...params.scriptRefs]);
  }

  getContentSection(name: string): ContentSection | undefined {
    return this.contentSections.find((s) => s.name === name);
  }

  getTemplate(name: string): TemplateRef | undefined {
    return this.templateRefs.find((t) => t.name === name);
  }

  getConfig(name: string): ConfigRef | undefined {
    return this.configRefs.find((c) => c.name === name);
  }

  getScript(name: string): ScriptRef | undefined {
    return this.scriptRefs.find((s) => s.name === name);
  }
}

/**
 * Returns true if the given value refers to a local path or tarball
 * rather than a remote repository reference (owner/repo or version tag).
 */
export function isLocalPath(value: string): boolean {
  return (
    value.startsWith("/") ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.endsWith(".tar.gz") ||
    value.endsWith(".tgz")
  );
}
