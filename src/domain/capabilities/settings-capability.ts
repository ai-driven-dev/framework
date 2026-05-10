import type { MergeStrategy } from "../models/merge.js";
import type { ToolId } from "../models/tool-ids.js";

export class SettingsCapability {
  readonly consumes: readonly string[];
  readonly staticContent: string | undefined;
  readonly requiresTool: ToolId | undefined;

  constructor(
    readonly params: {
      outputPath: string;
      mergeStrategy: MergeStrategy;
      consumes?: readonly string[];
      staticContent?: string;
      requiresTool?: ToolId;
    }
  ) {
    if (params.consumes?.length && params.staticContent !== undefined) {
      throw new Error("SettingsCapability: set either 'consumes' or 'staticContent', not both.");
    }
    if (params.requiresTool !== undefined && params.staticContent === undefined) {
      throw new Error("SettingsCapability: 'requiresTool' is only meaningful with 'staticContent'.");
    }
    this.consumes = params.consumes ?? [];
    this.staticContent = params.staticContent;
    this.requiresTool = params.requiresTool;
  }

  accepts(relativePath: string): boolean {
    return relativePath === this.params.outputPath;
  }

  getMergeStrategy(): MergeStrategy {
    return this.params.mergeStrategy;
  }

  buildOutputPath(): string {
    return this.params.outputPath;
  }

  equals(other: SettingsCapability): boolean {
    return (
      this.params.outputPath === other.params.outputPath &&
      this.params.mergeStrategy === other.params.mergeStrategy
    );
  }
}
