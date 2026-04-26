import type { MergeStrategy } from "../models/merge.js";

export class SettingsCapability {
  readonly consumes: readonly string[];

  constructor(
    readonly params: {
      outputPath: string;
      mergeStrategy: MergeStrategy;
      consumes?: readonly string[];
    }
  ) {
    this.consumes = params.consumes ?? [];
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
