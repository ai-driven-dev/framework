import { AiddError } from "../../../shared/domain/shared.error.js";

export class FlatMergeTargetNotJsonError extends AiddError {
  readonly code = "flat-merge-target-not-json";
  constructor(
    readonly shownPath: string,
    readonly parseMessage: string
  ) {
    super();
  }
}

export class FlatTargetExistsError extends AiddError {
  readonly code = "flat-target-exists";
  constructor(
    readonly targetPath: string,
    readonly pluginName: string
  ) {
    super();
  }
}

export class FrameworkPlaceholderInPluginError extends AiddError {
  readonly code = "framework-placeholder-in-plugin";
  constructor(
    readonly pluginName: string,
    readonly relativePath: string
  ) {
    super();
  }
}

export class InvalidBuildPathsError extends AiddError {
  readonly code = "invalid-build-paths";
  constructor(
    readonly sourceDir: string,
    readonly outDir: string
  ) {
    super();
  }
}

export class JsonSchemaValidationError extends AiddError {
  readonly code = "json-schema-validation";
  constructor(readonly errors: string[]) {
    super();
  }
}

export class MarketplaceOutDirNotEmptyError extends AiddError {
  readonly code = "marketplace-out-dir-not-empty";
  constructor(readonly outDir: string) {
    super();
  }
}

export class OutDirNotDirectoryError extends AiddError {
  readonly code = "out-dir-not-directory";
  constructor(readonly outDir: string) {
    super();
  }
}
