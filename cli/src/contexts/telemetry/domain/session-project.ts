import type { RunJournal } from "./ports/run-journal-reader.js";

/** Which of `session_start`'s two fields named the project: `project_id` is a directory name
 * that collides across machines, so a consumer has to be told which one it got. */
export type ProjectField = "project_id" | "project_remote";

export interface SessionProject {
  readonly projectId: string;
  readonly projectField: ProjectField;
}

/** A stored record's project, and which field named it — the pair, never the value alone. */
export interface RecordProjectClaim {
  readonly project_id?: string;
  readonly project_field?: string;
}

/** `project_remote` wins when present: one value for every checkout of a repository, where
 * `project_id` carries no such guarantee. Neither field named answers `null`, never a guess. */
export function resolveSessionProject(journal: RunJournal | null): SessionProject | null {
  const session = journal?.session;
  if (!session) return null;
  if (session.project_remote !== undefined && session.project_remote !== "") {
    return { projectId: session.project_remote, projectField: "project_remote" };
  }
  if (session.project_id !== undefined && session.project_id !== "") {
    return { projectId: session.project_id, projectField: "project_id" };
  }
  return null;
}

function projectOfRecord(record: RecordProjectClaim): SessionProject | null {
  const { project_id: projectId, project_field: projectField } = record;
  if (projectId === undefined || projectId === "") return null;
  if (projectField !== "project_id" && projectField !== "project_remote") return null;
  return { projectId, projectField };
}

function sameProject(left: SessionProject, right: SessionProject): boolean {
  return left.projectField === right.projectField && left.projectId === right.projectId;
}

/** The project the stored records put an anchored session under, when it is not one of `here`'s.
 * Compares only values named by the same field — `project_id` is a directory name and
 * `project_remote` a URL, so across the two a match reads as a mismatch — and one record naming
 * a project in `here` settles the session as this project's, whatever the others say. */
export function anchorProjectElsewhere(
  here: readonly SessionProject[],
  anchorRecords: readonly RecordProjectClaim[]
): string | null {
  const comparable = anchorRecords
    .map(projectOfRecord)
    .filter((project): project is SessionProject => project !== null)
    .filter((project) => here.some((mine) => mine.projectField === project.projectField));
  if (comparable.length === 0) return null;
  if (comparable.some((project) => here.some((mine) => sameProject(mine, project)))) return null;
  return [...new Set(comparable.map((project) => project.projectId))].join(", ");
}
