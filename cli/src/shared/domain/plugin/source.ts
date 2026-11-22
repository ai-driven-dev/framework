export const GITHUB_REPO_REGEX = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

// npm package name grammar: unscoped my-pkg or scoped @scope/name.
// Leading `-` or `.` is forbidden (would be parsed as a pnpm flag or relative path).
export const NPM_PACKAGE_NAME_REGEX = /^(?:@[a-z0-9][a-z0-9-._]*\/)?[a-z0-9][a-z0-9-._]*$/;
export const SHA_REGEX = /^[a-f0-9]{40}$/;

export interface PluginSourceGitHub {
  kind: "github";
  repo: string;
  ref?: string;
  sha?: string;
}

export interface PluginSourceUrl {
  kind: "url";
  url: string;
  ref?: string;
  sha?: string;
}

export interface PluginSourceGitSubdir {
  kind: "git-subdir";
  url: string;
  path: string;
  ref?: string;
  sha?: string;
}

export interface PluginSourceNpm {
  kind: "npm";
  package: string;
  version?: string;
  registry?: string;
}

export interface PluginSourceLocal {
  kind: "local";
  path: string;
}

export type PluginSource =
  | PluginSourceGitHub
  | PluginSourceUrl
  | PluginSourceGitSubdir
  | PluginSourceNpm
  | PluginSourceLocal;

export function describePluginSource(src: PluginSource): string {
  switch (src.kind) {
    case "github":
      return `https://github.com/${src.repo}${src.ref ? `@${src.ref}` : ""}`;
    case "url":
      return src.url;
    case "git-subdir":
      return `${src.url}#${src.path}`;
    case "npm":
      return `npm:${src.package}${src.version ? `@${src.version}` : ""}`;
    case "local":
      return src.path;
  }
}

/** The fields that are set, in the order given. */
function definedFields(fields: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fields).filter((entry): entry is [string, string] => entry[1] !== undefined)
  );
}

export function serializePluginSource(src: PluginSource): Record<string, unknown> {
  const kind = { kind: src.kind };
  switch (src.kind) {
    case "github":
      return { ...kind, repo: src.repo, ...definedFields({ ref: src.ref, sha: src.sha }) };
    case "url":
      return { ...kind, url: src.url, ...definedFields({ ref: src.ref, sha: src.sha }) };
    case "git-subdir":
      return {
        ...kind,
        url: src.url,
        path: src.path,
        ...definedFields({ ref: src.ref, sha: src.sha }),
      };
    case "npm":
      return {
        ...kind,
        package: src.package,
        ...definedFields({ version: src.version, registry: src.registry }),
      };
    case "local":
      return { ...kind, path: src.path };
  }
}
