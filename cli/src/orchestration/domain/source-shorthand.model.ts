import { isAbsolute } from "node:path";
import {
  GITHUB_REPO_REGEX,
  type PluginSource,
  type PluginSourceGitHub,
  type PluginSourceUrl,
} from "../../shared/domain/plugin/source.js";
import { parsePluginSource } from "../../shared/domain/plugin/source-parsing.js";
import { InvalidPluginSourceError } from "../../shared/domain/shared.error.js";

const GITLAB_PREFIX = "gitlab:";

export function parsePluginSourceShorthand(raw: string): PluginSource {
  return parseLocation(raw) ?? parseRepoShorthand(raw) ?? parseJsonSource(raw);
}

function parseLocation(raw: string): PluginSource | null {
  if (raw.startsWith("https://") || raw.startsWith("http://")) return { kind: "url", url: raw };
  if (raw.startsWith("git@")) return { kind: "url", url: raw };
  // `isAbsolute` also catches a Windows-rooted path (`C:\...`, `\\server\share`), which
  // starts with neither `/` nor `./`.
  if (raw.startsWith("./") || isAbsolute(raw)) return { kind: "local", path: raw };
  return null;
}

function parseRepoShorthand(raw: string): PluginSource | null {
  if (raw.startsWith(GITLAB_PREFIX)) return parseGitLabShorthand(raw.slice(GITLAB_PREFIX.length));
  if (GITHUB_REPO_REGEX.test(raw)) return { kind: "github", repo: raw };
  return parseGitHubVersionedShorthand(raw);
}

function parseJsonSource(raw: string): PluginSource {
  try {
    return parsePluginSource(JSON.parse(raw));
  } catch (err) {
    if (err instanceof InvalidPluginSourceError) throw err;
    throw new InvalidPluginSourceError(`unrecognized source format: "${raw}"`);
  }
}

function parseGitHubVersionedShorthand(raw: string): PluginSourceGitHub | null {
  const atIndex = raw.lastIndexOf("@");
  if (atIndex <= 0) return null;
  const repo = raw.slice(0, atIndex);
  const ref = raw.slice(atIndex + 1);
  if (!GITHUB_REPO_REGEX.test(repo)) return null;
  return { kind: "github", repo, ref };
}

function parseGitLabShorthand(raw: string): PluginSourceUrl {
  const atIndex = raw.lastIndexOf("@");
  const repo = atIndex > 0 ? raw.slice(0, atIndex) : raw;
  const ref = atIndex > 0 ? raw.slice(atIndex + 1) : undefined;
  if (!GITHUB_REPO_REGEX.test(repo)) {
    throw new InvalidPluginSourceError(
      `"gitlab:${raw}" must match gitlab:owner/repo or gitlab:owner/repo@ref`
    );
  }
  const result: PluginSourceUrl = { kind: "url", url: `https://gitlab.com/${repo}.git` };
  if (ref !== undefined) result.ref = ref;
  return result;
}
