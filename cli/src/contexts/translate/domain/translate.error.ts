import { AiddError } from "../../../shared/domain/shared.error.js";

export class FlatMergeTargetNotJsonError extends AiddError {
  readonly code = "flat-merge-target-not-json";
  constructor(shownPath: string, parseMessage: string) {
    super(`${shownPath} is not valid JSON (${parseMessage}); left untouched.`);
    this.name = "FlatMergeTargetNotJsonError";
  }
}

export class FlatTargetExistsError extends AiddError {
  readonly code = "flat-target-exists";
  constructor(targetPath: string, pluginName: string) {
    super(
      `Flat build conflict: '${targetPath}' already exists (plugin '${pluginName}'). ` +
        "Re-run with --force to overwrite."
    );
    this.name = "FlatTargetExistsError";
  }
}

export class FrameworkPlaceholderInPluginError extends AiddError {
  readonly code = "framework-placeholder-in-plugin";
  constructor(pluginName: string, relativePath: string) {
    super(
      `Framework placeholder '@{{TOOLS}}/' is not allowed inside plugin '${pluginName}' (file: ${relativePath}).`
    );
    this.name = "FrameworkPlaceholderInPluginError";
  }
}

export class InvalidBuildPathsError extends AiddError {
  readonly code = "invalid-build-paths";
  constructor(sourceDir: string, outDir: string) {
    super(
      `Refusing to build: --out '${outDir}' and --source '${sourceDir}' must not contain each other.`
    );
    this.name = "InvalidBuildPathsError";
  }
}

export class JsonSchemaValidationError extends AiddError {
  readonly code = "json-schema-validation";
  constructor(errors: string[]) {
    super(`Manifest validation failed: ${errors.join("; ")}`);
    this.name = "JsonSchemaValidationError";
  }
}

export class MarketplaceOutDirNotEmptyError extends AiddError {
  readonly code = "marketplace-out-dir-not-empty";
  constructor(outDir: string) {
    super(
      `Refusing to build: '${outDir}' is not empty. ` +
        "Re-run with --force to overwrite files this build produces, or choose an empty --out directory."
    );
    this.name = "MarketplaceOutDirNotEmptyError";
  }
}

export class OutDirNotDirectoryError extends AiddError {
  readonly code = "out-dir-not-directory";
  constructor(outDir: string) {
    super(`Refusing to build: --out '${outDir}' does not exist or is not a directory.`);
    this.name = "OutDirNotDirectoryError";
  }
}
