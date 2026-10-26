import { createHash } from "node:crypto";

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
/** `[user@]host:path`. A one-letter host is a Windows drive, not a host. */
const SCP_LIKE = /^(?:[^@/\s]+@)?([^:/\s]{2,}):(?!\/\/)(.+)/;

/** A remote's host and path as written, credentials and port dropped. `scp` says the host is
 * the text before the colon, as typed; otherwise it is `URL`'s, which folds only the case of
 * special schemes (`https`, not `ssh` or `git`). */
export interface RemoteAddress {
  readonly host: string;
  readonly path: string;
  readonly scp: boolean;
}

export function addressOf(url: string): RemoteAddress | null {
  const text = url.trim();
  if (SCHEME.test(text)) {
    let parsed: URL;
    try {
      parsed = new URL(text);
    } catch {
      return null;
    }
    return parsed.hostname === ""
      ? null
      : { host: parsed.hostname, path: parsed.pathname, scp: false };
  }
  const scp = SCP_LIKE.exec(text);
  return scp === null ? null : { host: scp[1] as string, path: scp[2] as string, scp: true };
}

/** `owner/repo`, leading slashes, `.git` and trailing slashes dropped; `null` with no owner. */
export function ownerAndRepo(path: string): string | null {
  const cleaned = path.replace(/^\/+/, "").replace(/(?:\.git)?\/*$/, "");
  return cleaned.includes("/") ? cleaned : null;
}

export function hashOf(address: string): string {
  return createHash("sha256").update(address).digest("hex");
}

/** GitHub's SSH over the HTTPS port answers at `ssh.github.com` for the repositories of
 * `github.com`. */
const SAME_HOST: Readonly<Record<string, string>> = { "ssh.github.com": "github.com" };
/** Hosts whose owner and repository names are not case sensitive, by their own documentation.
 * Any other host keeps the case written: two spellings may give two ids, never one id two
 * repositories. */
const CASELESS_PATH = new Set(["github.com"]);

/** `host/owner/repo` of a remote url, whatever its spelling: https, ssh, scp-like or git, with
 * credentials, port, `.git` suffix and trailing slash dropped, the host case-folded, and the
 * path too where the host ignores its case. A local path, a `file://` url or anything with no
 * owner and repo names no hosted repository. */
export function normaliseRemote(url: string): string | null {
  const address = addressOf(url);
  if (address === null) return null;
  const folded = address.host.toLowerCase();
  const host = SAME_HOST[folded] ?? folded;
  const path = ownerAndRepo(CASELESS_PATH.has(host) ? address.path.toLowerCase() : address.path);
  return path === null ? null : `${host}/${path}`;
}

export interface RepositoryFacts {
  /** `origin`'s url, as git prints it. */
  readonly remote: string | null;
  /** The root commit, the lowest sha when there are several. */
  readonly rootCommit: string | null;
}

/** What names a repository without naming where it lives: the hash of its hosted address, else
 * its first commit. The url itself is never kept. */
export function repositoryIdOf(facts: RepositoryFacts): string | null {
  const hosted = facts.remote === null ? null : normaliseRemote(facts.remote);
  return hosted === null ? facts.rootCommit : hashOf(hosted);
}
