export const TOOLS_PLACEHOLDER = "{{TOOLS}}/";
export const DOCS_PLACEHOLDER = "{{DOCS}}/";
export const AT_TOOLS_PLACEHOLDER = "@{{TOOLS}}/";
export const AT_DOCS_PLACEHOLDER = "@{{DOCS}}/";

export const SECTION_COMMANDS = "commands";
export const SECTION_RULES = "rules";
export const SECTION_AGENTS = "agents";
export const SECTION_SKILLS = "skills";

export const CONFIG_MCP = "mcp";
export const CONFIG_VSCODE_SETTINGS = "vscodeSettings";
export const CONFIG_VSCODE_EXTENSIONS = "vscodeExtensions";
export const CONFIG_VSCODE_KEYBINDINGS = "vscodeKeybindings";
export const CONFIG_OPENCODE = "opencode";

export const TEMPLATE_AGENTS_MD = "agentsMd";

export const SCRIPT_UPDATE_MEMORY = "updateMemory";

export const GITKEEP_FILE = ".gitkeep";

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
