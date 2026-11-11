import { CapabilityConfigError } from "../../../../kernel/errors.js";

export class HooksCapability {
  readonly consumes: readonly string[];

  constructor(
    readonly params: {
      outputPath: string;
      mergeStrategy?: "user-prime" | "none";
      entrySection?: string;
      consumes?: readonly string[];
    }
  ) {
    if (/^([/\\]|[A-Za-z]:)/.test(params.outputPath)) {
      throw new CapabilityConfigError(`hooks outputPath "${params.outputPath}" must be relative.`);
    }
    if (params.outputPath.split(/[/\\]/).includes("..")) {
      throw new CapabilityConfigError(
        `hooks outputPath "${params.outputPath}" must stay in the project.`
      );
    }
    this.consumes = params.consumes ?? [];
  }

  buildOutputPath(): string {
    return this.params.outputPath;
  }

  getMergeStrategy(): "user-prime" | "none" {
    return this.params.mergeStrategy ?? "user-prime";
  }

  getEntrySection(): string | null {
    return this.params.entrySection ?? null;
  }

  accepts(relativePath: string): boolean {
    return relativePath === this.params.outputPath;
  }

  equals(other: HooksCapability): boolean {
    return (
      this.params.outputPath === other.params.outputPath &&
      this.params.mergeStrategy === other.params.mergeStrategy &&
      this.params.entrySection === other.params.entrySection
    );
  }
}
