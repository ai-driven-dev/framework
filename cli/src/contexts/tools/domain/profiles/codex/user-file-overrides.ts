import { isDeepStrictEqual } from "node:util";
import {
  InstallationFile,
  type UserFileOverrides,
  type UserFileSettingOverrides,
} from "../../../../../kernel/file.js";
import type { Hasher } from "../../../../../kernel/ports/hasher.js";
import type { UserFileOverridesCapability } from "../../capabilities/plugins-capability.js";
import { parseToml, stringifyToml } from "./toml.js";

const MODEL_KEYS: ReadonlySet<string> = new Set(["model", "model_reasoning_effort"]);

/** Accepts only canonical generated TOML whose sole differences are explicit model settings. */
export function captureCodexAgentModelOverride(
  generated: string,
  installed: string,
  previousHash?: string,
  hasher?: Hasher
): UserFileSettingOverrides | null {
  try {
    const desired = parseToml(generated);
    const current = parseToml(installed);
    if (stringifyToml(desired) !== generated || stringifyToml(current) !== installed) return null;

    const desiredWithoutModel = { ...desired };
    const currentWithoutModel = { ...current };
    for (const key of MODEL_KEYS) {
      delete desiredWithoutModel[key];
      delete currentWithoutModel[key];
    }
    const matchesCurrent = isDeepStrictEqual(desiredWithoutModel, currentWithoutModel);
    const matchesPrevious =
      previousHash !== undefined &&
      hasher !== undefined &&
      hasher.hash(stringifyToml(currentWithoutModel)).value === previousHash;
    if (!matchesCurrent && !matchesPrevious) return null;

    const override: Record<string, string> = {};
    if (desired.model !== undefined && current.model === undefined) return null;
    if (
      desired.model_reasoning_effort !== undefined &&
      current.model_reasoning_effort === undefined
    )
      return null;
    if (current.model !== desired.model) {
      if (current.model !== undefined) {
        if (typeof current.model !== "string" || current.model.trim().length === 0) return null;
        override.model = current.model;
      }
    }
    if (current.model_reasoning_effort !== desired.model_reasoning_effort) {
      if (current.model_reasoning_effort !== undefined) {
        if (
          typeof current.model_reasoning_effort !== "string" ||
          current.model_reasoning_effort.trim().length === 0
        )
          return null;
        override.model_reasoning_effort = current.model_reasoning_effort;
      }
    }
    return override;
  } catch {
    return null;
  }
}

/** Adds retained per-user settings before the ownership hash is computed. */
export function applyCodexAgentModelOverrides(
  files: readonly InstallationFile[],
  overrides: UserFileOverrides,
  hasher: Hasher
): InstallationFile[] {
  validateCodexAgentOverrides(overrides);
  return files.map((file) => {
    const override = overrides[file.relativePath];
    if (override === undefined) return file;
    const agent = parseToml(file.content);
    Object.assign(agent, override);
    const content = stringifyToml(agent);
    return new InstallationFile({
      relativePath: file.relativePath,
      content,
      hash: hasher.hash(content),
      mergeStrategy: file.mergeStrategy,
      frameworkPath: file.frameworkPath,
    });
  });
}

function validateCodexAgentOverrides(overrides: UserFileOverrides, pluginName?: string): void {
  for (const [path, settings] of Object.entries(overrides)) {
    if (
      (pluginName !== undefined && !codexUserFileOverrides.canPreserve(path, pluginName)) ||
      Object.keys(settings).some((key) => !MODEL_KEYS.has(key))
    ) {
      throw new Error(`Unsupported user file setting for '${path}'.`);
    }
  }
}

export const codexUserFileOverrides: UserFileOverridesCapability = {
  canPreserve(relativePath, pluginName) {
    return (
      relativePath.startsWith(`agents/${pluginName}-`) &&
      relativePath.endsWith(".toml") &&
      !relativePath.includes("\\") &&
      !relativePath
        .split("/")
        .some((segment) => segment === "" || segment === "." || segment === "..")
    );
  },
  validate: validateCodexAgentOverrides,
  capture(generated, installed, previousHash, hasher) {
    return captureCodexAgentModelOverride(generated, installed, previousHash, hasher);
  },
  apply(files, overrides, hasher) {
    return applyCodexAgentModelOverrides(files, overrides, hasher);
  },
};
