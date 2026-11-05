import { asPlainObject } from "../../../../../../kernel/reading/plain-object.js";
import { createSessionMetadataPublisher, type Metadata, type Request } from "./session-title.js";

function hasControlCharacter(text: string): boolean {
  return [...text].some(
    (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
  );
}

/** Native project membership only: roots and cwd are not evidence of membership. */
export async function readSessionProject(request: Request, session: string): Promise<Metadata> {
  try {
    const readThread = async () => {
      const result = await request("thread/read", { threadId: session, includeTurns: false });
      const thread = asPlainObject(asPlainObject(result)?.thread);
      return thread?.id === session && thread.sessionId === session ? thread : null;
    };
    const thread = await readThread();
    if (!thread) return { available: false };
    if (thread.projectId === null) return { available: true, values: {} };
    const id = thread.projectId;
    if (typeof id !== "string" || !id.trim() || id.length > 1024 || hasControlCharacter(id))
      return { available: false };
    const result = await request("project/read", { projectId: id });
    const project = asPlainObject(asPlainObject(result)?.project);
    if (
      project?.id !== id ||
      typeof project.name !== "string" ||
      !project.name.trim() ||
      project.name.length > 4096 ||
      hasControlCharacter(project.name)
    )
      return { available: false };
    if ((await readThread())?.projectId !== id) return { available: false };
    return {
      available: true,
      values: { "aidd.project_id": id, "aidd.project_name": project.name },
    };
  } catch {
    return { available: false };
  }
}

export function createSessionProjectPublisher(home: string, onUnavailable?: () => void) {
  return createSessionMetadataPublisher(
    home,
    "aidd.session_project",
    readSessionProject,
    onUnavailable
  );
}
