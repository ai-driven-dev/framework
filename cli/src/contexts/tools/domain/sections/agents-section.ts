import { parseFrontmatter, serializeFrontmatter } from "../../../../shared/domain/markdown.js";
import type { AgentFrontmatter } from "../formats/agent-format.js";
import { ForeignSuffixFilter } from "../profile/foreign-suffix-filter.js";
import { ToolSuffix } from "../profile/tool-suffix.js";

function agentNameFromFrontmatter(
  fm: Record<string, unknown>,
  fileName?: string
): string | undefined {
  const base = fileName?.slice(fileName.lastIndexOf("/") + 1);
  const name = fm.name ?? base?.replace(/\.md$/, "");
  return typeof name === "string" ? name : undefined;
}

function toTomlBasename(toolSuffix: string, fileName: string): string {
  const basename = fileName.slice(fileName.lastIndexOf("/") + 1);
  if (basename.endsWith(toolSuffix)) {
    return `${basename.slice(0, -toolSuffix.length)}.toml`;
  }
  if (basename.endsWith(".md")) {
    return `${basename.slice(0, -3)}.toml`;
  }
  return `${basename}.toml`;
}

type AgentsSectionParams = {
  directory: string;
  toolSuffix: string;
  format: "markdown" | "toml";
  /** The host's own agent frontmatter, shared with its built distributions. */
  frontmatter: AgentFrontmatter;
  /** How frontmatter strings are quoted; `double` for readers that keep single quotes. */
  quote?: "single" | "double";
  /** Writes the agent file when the host's format is not markdown frontmatter. */
  serialize?: (frontmatter: Record<string, unknown>, body: string) => string;
  buildInstallPath?: (fileName: string) => string | null;
};

export class AgentsSection {
  readonly #params: AgentsSectionParams;
  readonly #suffix: ToolSuffix;
  readonly #foreignSuffixes: ForeignSuffixFilter;

  constructor(params: AgentsSectionParams) {
    this.#params = params;
    this.#suffix = new ToolSuffix(params.toolSuffix);
    this.#foreignSuffixes = ForeignSuffixFilter.keeping(params.toolSuffix);
  }

  buildInstallPath(relativeFileName: string): string | null {
    if (this.#params.buildInstallPath) return this.#params.buildInstallPath(relativeFileName);
    const basename = relativeFileName.slice(relativeFileName.lastIndexOf("/") + 1);
    if (this.#params.format === "toml") {
      return `${this.#params.directory}agents/${toTomlBasename(this.#params.toolSuffix, basename)}`;
    }
    return this.#suffix.strip(`${this.#params.directory}agents/${basename}`);
  }

  accepts(relativePath: string): boolean {
    return relativePath.startsWith(this.#params.directory);
  }

  acceptsFileName(fileName: string): boolean {
    return this.#foreignSuffixes.accepts(fileName);
  }

  convertFrontmatter(fm: Record<string, unknown>, fileName?: string): Record<string, unknown> {
    return this.#params.frontmatter({ ...fm, name: agentNameFromFrontmatter(fm, fileName) });
  }

  serialize(frontmatter: Record<string, unknown>, body: string): string {
    if (this.#params.serialize) return this.#params.serialize(frontmatter, body);
    return serializeFrontmatter(frontmatter, body, this.#params.quote);
  }

  deserialize(content: string): { frontmatter: Record<string, unknown>; body: string } {
    return parseFrontmatter(content);
  }

  equals(other: AgentsSection): boolean {
    return (
      this.#params.directory === other.#params.directory &&
      this.#params.toolSuffix === other.#params.toolSuffix &&
      this.#params.format === other.#params.format
    );
  }
}
