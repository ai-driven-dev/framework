import { parseFrontmatter, serializeFrontmatter } from "../../../../kernel/markdown.js";
import type { AgentFrontmatter } from "../formats/agent-format.js";

function agentNameFromFrontmatter(
  fm: Record<string, unknown>,
  fileName?: string
): string | undefined {
  const base = fileName?.split("/").at(-1);
  const name = fm.name ?? base?.replace(/\.md$/, "");
  return typeof name === "string" ? name : undefined;
}

function stripSuffix(toolSuffix: string, fileName: string): string {
  const basename = fileName.split("/").at(-1) ?? fileName;
  const dir = fileName.slice(0, fileName.length - basename.length);
  if (basename.endsWith(toolSuffix)) {
    return `${dir}${basename.slice(0, -toolSuffix.length)}.md`;
  }
  return fileName;
}

function toTomlBasename(toolSuffix: string, fileName: string): string {
  const basename = fileName.split("/").at(-1) ?? fileName;
  if (basename.endsWith(toolSuffix)) {
    return `${basename.slice(0, -toolSuffix.length)}.toml`;
  }
  if (basename.endsWith(".md")) {
    return `${basename.slice(0, -3)}.toml`;
  }
  return `${basename}.toml`;
}

export class AgentsCapability {
  constructor(
    readonly params: {
      directory: string;
      toolSuffix: string;
      format: "markdown" | "toml";
      /** The host's own agent frontmatter, shared with its built distributions. */
      frontmatter: AgentFrontmatter;
      userFileExt?: string;
      /** How frontmatter strings are quoted; `double` for readers that keep single quotes. */
      quote?: "single" | "double";
      /** Writes the agent file when the host's format is not markdown frontmatter. */
      serialize?: (frontmatter: Record<string, unknown>, body: string) => string;
      buildInstallPath?: (fileName: string) => string | null;
    }
  ) {}

  buildOutputPath(agentName: string): string {
    return `${this.params.directory}agents/${agentName}${this.params.toolSuffix}`;
  }

  buildInstallPath(relativeFileName: string): string | null {
    if (this.params.buildInstallPath) return this.params.buildInstallPath(relativeFileName);
    const basename = relativeFileName.split("/").at(-1) ?? relativeFileName;
    if (this.params.format === "toml") {
      return `${this.params.directory}agents/${toTomlBasename(this.params.toolSuffix, basename)}`;
    }
    return stripSuffix(this.params.toolSuffix, `${this.params.directory}agents/${basename}`);
  }

  accepts(relativePath: string): boolean {
    return relativePath.startsWith(this.params.directory);
  }

  acceptsFileName(fileName: string, allToolSuffixes: readonly string[]): boolean {
    const basename = fileName.split("/").at(-1) ?? fileName;
    const otherSuffixes = allToolSuffixes.filter((s) => s !== this.params.toolSuffix);
    return !otherSuffixes.some((s) => basename.endsWith(s));
  }

  convertFrontmatter(fm: Record<string, unknown>, fileName?: string): Record<string, unknown> {
    return this.params.frontmatter({ ...fm, name: agentNameFromFrontmatter(fm, fileName) });
  }

  serialize(frontmatter: Record<string, unknown>, body: string): string {
    if (this.params.serialize) return this.params.serialize(frontmatter, body);
    return serializeFrontmatter(frontmatter, body, this.params.quote);
  }

  deserialize(content: string): { frontmatter: Record<string, unknown>; body: string } {
    return parseFrontmatter(content);
  }

  equals(other: AgentsCapability): boolean {
    return (
      this.params.directory === other.params.directory &&
      this.params.toolSuffix === other.params.toolSuffix &&
      this.params.format === other.params.format &&
      this.params.userFileExt === other.params.userFileExt
    );
  }
}
