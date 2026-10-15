import { createHash } from "node:crypto";

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
/** `[user@]host:path`. A one-letter host is a Windows drive, not a host. */
const SCP_LIKE = /^(?:[^@/\s]+@)?([^:/\s]{2,}):(?!\/\/)(.+)/;

function ownerAndRepo(path: string): string | null {
  const cleaned = path.replace(/^\/+/, "").replace(/(?:\.git)?\/*$/, "");
  return cleaned.includes("/") ? cleaned : null;
}

/** `host/owner/repo` of a remote url, whatever its spelling: https, ssh, scp-like or git, with
 * credentials, port, `.git` suffix and trailing slash dropped and the host case-folded. A local
 * path, a `file://` url or anything with no owner and repo names no hosted repository. */
export function normaliseRemote(url: string): string | null {
  const text = url.trim();
  if (SCHEME.test(text)) {
    let parsed: URL;
    try {
      parsed = new URL(text);
    } catch {
      return null;
    }
    const path = ownerAndRepo(parsed.pathname);
    return parsed.hostname === "" || path === null ? null : `${parsed.hostname}/${path}`;
  }
  const scp = SCP_LIKE.exec(text);
  if (scp === null) return null;
  const path = ownerAndRepo(scp[2] as string);
  return path === null ? null : `${(scp[1] as string).toLowerCase()}/${path}`;
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
  if (hosted !== null) return createHash("sha256").update(hosted).digest("hex");
  return facts.rootCommit;
}
