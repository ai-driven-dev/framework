import { AiddError } from "../../../shared/domain/shared.error.js";

export class ElevatedPermissionUpdateError extends AiddError {
  readonly code = "elevated-permission-update";
  constructor(readonly installCommand: string) {
    super();
  }
}

export class FrameworkResolutionError extends AiddError {
  readonly code = "framework-resolution";
  constructor(readonly detail: string) {
    super();
  }
}

export class PackageManagerDetectionError extends AiddError {
  readonly code = "package-manager-detection";
  constructor(readonly commands: readonly string[]) {
    super();
  }
}

export class UpdateError extends AiddError {
  readonly code = "update";
}
