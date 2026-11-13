import { mcpJsonToToml, mergeJsonUserPrime } from "../formats/mcp-format.js";

/** The config files a tool's MCP output may already live in. Tiers are tried in order; within the
 * first tier that has any file present, two present files make `conflict` throw, one is the answer.
 * `fallback` answers when no tier has a file. */
export type McpOutputPathCandidates = {
  readonly tiers: readonly (readonly string[])[];
  readonly fallback: string;
  readonly conflict: () => never;
};

export class McpCapability {
  readonly consumes: readonly string[];

  constructor(
    readonly params: {
      outputPath: string;
      format: "json" | "toml";
      entrySection?: string;
      mergeStrategy?: "user-prime" | "framework-prime" | "none";
      mergeFn?: (existing: string, incoming: string) => string;
      transformContent?: (content: string) => string;
      outputPathCandidates?: McpOutputPathCandidates;
      consumes?: readonly string[];
    }
  ) {
    this.consumes = params.consumes ?? [];
  }

  transform(mcpJson: string): string {
    const afterTransform = this.params.transformContent
      ? this.params.transformContent(mcpJson)
      : mcpJson;
    if (this.params.format === "toml") {
      return mcpJsonToToml(afterTransform);
    }
    return afterTransform;
  }

  /** `null` when the tool's output path is the fixed `outputPath`. */
  outputPathCandidates(): McpOutputPathCandidates | null {
    return this.params.outputPathCandidates ?? null;
  }

  merge(existing: string, incoming: string): string {
    if (this.params.mergeFn !== undefined) {
      return this.params.mergeFn(existing, incoming);
    }
    if (this.params.mergeStrategy === "none") {
      return incoming;
    }
    return mergeJsonUserPrime(existing, incoming);
  }

  accepts(relativePath: string): boolean {
    return relativePath === this.params.outputPath;
  }

  equals(other: McpCapability): boolean {
    return (
      this.params.outputPath === other.params.outputPath &&
      this.params.format === other.params.format &&
      this.params.entrySection === other.params.entrySection &&
      this.params.mergeStrategy === other.params.mergeStrategy
    );
  }
}
