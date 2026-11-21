import { isAbsolute } from "node:path";
import { asPlainObject } from "./reading/plain-object.js";
import { InvalidPluginSourceError } from "./shared.error.js";
import {
  GITHUB_REPO_REGEX,
  NPM_PACKAGE_NAME_REGEX,
  type PluginSource,
  type PluginSourceGitHub,
  type PluginSourceGitSubdir,
  type PluginSourceLocal,
  type PluginSourceNpm,
  type PluginSourceUrl,
  SHA_REGEX,
} from "./source.js";

function assertString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new InvalidPluginSourceError(`"${field}" must be a non-empty string.`);
  }
  return value;
}

function optionalString(raw: Record<string, unknown>, field: string): string | undefined {
  const value = raw[field];
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new InvalidPluginSourceError(`"${field}" must be a string.`);
  }
  return value;
}

function optionalSha(raw: Record<string, unknown>): string | undefined {
  const value = optionalString(raw, "sha");
  if (value !== undefined && !SHA_REGEX.test(value)) {
    throw new InvalidPluginSourceError(`"sha" must be a 40-character lowercase hex string.`);
  }
  return value;
}

function parseGitHub(raw: Record<string, unknown>): PluginSourceGitHub {
  const repo = assertString(raw.repo, "repo");
  if (!GITHUB_REPO_REGEX.test(repo)) {
    throw new InvalidPluginSourceError(`"repo" must match owner/repo format.`);
  }
  return {
    kind: "github",
    repo,
    ref: optionalString(raw, "ref"),
    sha: optionalSha(raw),
  };
}

function parseUrl(raw: Record<string, unknown>): PluginSourceUrl {
  return {
    kind: "url",
    url: assertString(raw.url, "url"),
    ref: optionalString(raw, "ref"),
    sha: optionalSha(raw),
  };
}

function parseGitSubdir(raw: Record<string, unknown>): PluginSourceGitSubdir {
  return {
    kind: "git-subdir",
    url: assertString(raw.url, "url"),
    path: assertString(raw.path, "path"),
    ref: optionalString(raw, "ref"),
    sha: optionalSha(raw),
  };
}

function assertNpmPackageName(raw: Record<string, unknown>): string {
  const pkg = assertString(raw.package, "package");
  if (!NPM_PACKAGE_NAME_REGEX.test(pkg)) {
    throw new InvalidPluginSourceError(
      `"package" must be a valid npm package name (e.g. my-plugin or @scope/my-plugin). Got: "${pkg}"`
    );
  }
  return pkg;
}

function parseNpm(raw: Record<string, unknown>): PluginSourceNpm {
  return {
    kind: "npm",
    package: assertNpmPackageName(raw),
    version: optionalString(raw, "version"),
    registry: optionalString(raw, "registry"),
  };
}

function parseLocal(raw: Record<string, unknown>): PluginSourceLocal {
  return {
    kind: "local",
    path: assertString(raw.path, "path"),
  };
}

export function parsePluginSource(raw: unknown): PluginSource {
  if (typeof raw === "string") return parseStringPluginSource(raw);
  const object = asPlainObject(raw);
  if (object === null) throw new InvalidPluginSourceError("expected an object.");
  return parseObjectPluginSource(object);
}

function parseStringPluginSource(raw: string): PluginSource {
  // `isAbsolute` also catches a Windows-rooted path (`C:\...`, `\\server\share`), which
  // starts with neither `/` nor `./`.
  if (raw.startsWith("./") || isAbsolute(raw)) return { kind: "local", path: raw };
  if (GITHUB_REPO_REGEX.test(raw)) return { kind: "github", repo: raw };
  throw new InvalidPluginSourceError(`string source "${raw}" is not a recognized path or repo.`);
}

function parseObjectPluginSource(obj: Record<string, unknown>): PluginSource {
  const kind = obj.kind;
  switch (kind) {
    case "github":
      return parseGitHub(obj);
    case "url":
      return parseUrl(obj);
    case "git-subdir":
      return parseGitSubdir(obj);
    case "npm":
      return parseNpm(obj);
    case "local":
      return parseLocal(obj);
    default:
      throw new InvalidPluginSourceError(
        `unknown kind "${String(kind)}". Expected: github, url, git-subdir, npm, local.`
      );
  }
}
