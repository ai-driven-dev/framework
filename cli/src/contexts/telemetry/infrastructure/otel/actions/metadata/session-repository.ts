import { asPlainObject } from "../../../../../../kernel/reading/plain-object.js";
import { createSessionMetadataPublisher, type Metadata, type Request } from "./session-title.js";

/** Keep identities on supported hosts. Never forward raw Git credentials or local paths. */
function publicRepository(origin: string): string | null {
  if (origin.length > 2048) return null;
  const match =
    /^(?:https:\/\/(github\.com|gitlab\.com)\/|git@(github\.com|gitlab\.com):)([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+)$/.exec(
      origin
    );
  if (!match || match[0] !== origin) return null;
  const host = match[1] ?? match[2];
  const path = match[3].endsWith(".git") ? match[3].slice(0, -4) : match[3];
  const parts = path.split("/");
  if (
    (host === "github.com" && parts.length !== 2) ||
    parts.some((part) => !part || part === "." || part === "..")
  )
    return null;
  return `https://${host}/${path}`;
}

/** The Git origin in the native thread is separate from its Codex project. */
export async function readSessionRepository(request: Request, session: string): Promise<Metadata> {
  try {
    const result = await request("thread/read", { threadId: session, includeTurns: false });
    const thread = asPlainObject(asPlainObject(result)?.thread);
    if (!thread || thread.id !== session || thread.sessionId !== session)
      return { available: false };
    if (thread.gitInfo === null) return { available: true, values: {} };
    const git = asPlainObject(thread.gitInfo);
    if (!git) return { available: false };
    if (git.originUrl === null) return { available: true, values: {} };
    if (typeof git.originUrl !== "string") return { available: false };
    const url = publicRepository(git.originUrl);
    return { available: true, values: url ? { "aidd.repository_url": url } : {} };
  } catch {
    return { available: false };
  }
}

export function createSessionRepositoryPublisher(home: string, onUnavailable?: () => void) {
  return createSessionMetadataPublisher(
    home,
    "aidd.session_repository",
    readSessionRepository,
    onUnavailable
  );
}
