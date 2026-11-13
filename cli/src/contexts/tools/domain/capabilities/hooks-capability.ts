import { CapabilityConfigError } from "../../../../kernel/errors.js";

type HooksCapabilityParams = {
  outputPath: string;
  mergeStrategy?: "user-prime" | "none";
  consumes?: readonly string[];
};

export class HooksCapability {
  readonly #params: HooksCapabilityParams;

  constructor(params: HooksCapabilityParams) {
    this.#params = params;
    if (/^([/\\]|[A-Za-z]:)/.test(params.outputPath)) {
      throw new CapabilityConfigError(`hooks outputPath "${params.outputPath}" must be relative.`);
    }
    if (params.outputPath.split(/[/\\]/).includes("..")) {
      throw new CapabilityConfigError(
        `hooks outputPath "${params.outputPath}" must stay in the project.`
      );
    }
  }

  consumes(configName: string): boolean {
    return this.#params.consumes?.includes(configName) ?? false;
  }

  outputPath(): string {
    return this.#params.outputPath;
  }

  mergeStrategy(): "user-prime" | "none" {
    return this.#params.mergeStrategy ?? "user-prime";
  }

  accepts(relativePath: string): boolean {
    return relativePath === this.#params.outputPath;
  }

  equals(other: HooksCapability): boolean {
    return (
      this.#params.outputPath === other.#params.outputPath &&
      this.#params.mergeStrategy === other.#params.mergeStrategy
    );
  }
}
