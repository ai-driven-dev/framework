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

export class FrameworkDescriptor {
  readonly version: string;
  readonly contentSections: readonly ContentSection[];
  readonly templateRefs: readonly TemplateRef[];
  readonly configRefs: readonly ConfigRef[];

  constructor(params: {
    version: string;
    contentSections: ContentSection[];
    templateRefs: TemplateRef[];
    configRefs: ConfigRef[];
  }) {
    this.version = params.version;
    this.contentSections = Object.freeze([...params.contentSections]);
    this.templateRefs = Object.freeze([...params.templateRefs]);
    this.configRefs = Object.freeze([...params.configRefs]);
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

  static fromJson(data: unknown): FrameworkDescriptor {
    if (data === null || typeof data !== "object") {
      throw new Error("Invalid framework.json: expected an object.");
    }

    const raw = data as Record<string, unknown>;

    if (typeof raw.version !== "string" || raw.version.trim() === "") {
      throw new Error("Invalid framework.json: missing or empty 'version' field.");
    }

    if (raw.content === null || typeof raw.content !== "object") {
      throw new Error("Invalid framework.json: missing 'content' field.");
    }

    const contentRecord = raw.content as Record<string, unknown>;
    const names = Object.keys(contentRecord);

    if (names.length === 0) {
      throw new Error("Invalid framework.json: 'content' must have at least one section.");
    }

    const contentSections: ContentSection[] = names.map((name) => {
      const section = contentRecord[name];
      if (section === null || typeof section !== "object") {
        throw new Error(`Invalid framework.json: content section '${name}' must be an object.`);
      }
      const s = section as Record<string, unknown>;

      if (typeof s.directory !== "string") {
        throw new Error(`Invalid framework.json: content section '${name}' missing 'directory'.`);
      }
      const entryFile =
        s.entryFile === null || s.entryFile === undefined ? null : String(s.entryFile);

      return {
        name,
        directory: s.directory,
        entryFile,
      };
    });

    const templateRefs: TemplateRef[] = [];
    if (raw.templates !== null && typeof raw.templates === "object") {
      for (const [name, path] of Object.entries(raw.templates as Record<string, unknown>)) {
        if (typeof path === "string") {
          templateRefs.push({ name, path });
        }
      }
    }

    const configRefs: ConfigRef[] = [];
    if (raw.config !== null && typeof raw.config === "object") {
      for (const [name, path] of Object.entries(raw.config as Record<string, unknown>)) {
        if (typeof path === "string") {
          configRefs.push({ name, path });
        }
      }
    }

    return new FrameworkDescriptor({
      version: raw.version,
      contentSections,
      templateRefs,
      configRefs,
    });
  }
}
