import { describe, expect, it } from "vitest";
import type {
  RunJournal,
  RunJournalSessionStart,
} from "../../../../src/contexts/telemetry/domain/ports/run-journal-reader.js";
import {
  anchorProjectElsewhere,
  resolveSessionProject,
  type SessionProject,
} from "../../../../src/contexts/telemetry/domain/session-project.js";

function sessionOf(overrides: Partial<RunJournalSessionStart> = {}): RunJournalSessionStart {
  return {
    type: "session_start",
    at: "2026-08-20T09:59:00Z",
    run_id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    tool: "claude-code",
    vendor_id: "s-1",
    ...overrides,
  };
}

function journalOf(session?: RunJournalSessionStart): RunJournal {
  return {
    boundaries: [],
    filesWritten: [],
    taskDeclarations: [],
    ...(session ? { session } : {}),
  };
}

describe("resolveSessionProject", () => {
  it("prefers the remote, and says so", () => {
    const journal = journalOf(
      sessionOf({ project_id: "acme-widgets", project_remote: "git@github.com:acme/widgets.git" })
    );

    expect(resolveSessionProject(journal)).toEqual({
      projectId: "git@github.com:acme/widgets.git",
      projectField: "project_remote",
    });
  });

  it("falls back to the directory-name field when no remote exists", () => {
    const journal = journalOf(sessionOf({ project_id: "acme-widgets" }));

    expect(resolveSessionProject(journal)).toEqual({
      projectId: "acme-widgets",
      projectField: "project_id",
    });
  });

  it("names no project when the session carries neither field", () => {
    expect(resolveSessionProject(journalOf(sessionOf()))).toBeNull();
  });

  it("names no project for a journal with no session at all", () => {
    expect(resolveSessionProject(journalOf())).toBeNull();
  });

  it("names no project for a session with no journal at all", () => {
    expect(resolveSessionProject(null)).toBeNull();
  });

  it("reads an empty remote as none, falling back to the directory-name field", () => {
    const journal = journalOf(sessionOf({ project_id: "acme-widgets", project_remote: "" }));

    expect(resolveSessionProject(journal)).toStrictEqual({
      projectId: "acme-widgets",
      projectField: "project_id",
    });
  });

  it("names no project when both fields are empty strings", () => {
    expect(
      resolveSessionProject(journalOf(sessionOf({ project_id: "", project_remote: "" })))
    ).toBeNull();
  });
});

describe("anchorProjectElsewhere", () => {
  const HERE_REMOTE = "git@github.com:acme/widgets.git";
  const here: readonly SessionProject[] = [
    { projectId: HERE_REMOTE, projectField: "project_remote" },
  ];
  const BOTH: readonly SessionProject[] = [
    ...here,
    { projectId: "widgets", projectField: "project_id" },
  ];

  it("names the project a stored record puts the anchored session under", () => {
    expect(
      anchorProjectElsewhere(here, [
        { project_id: "git@github.com:acme/other.git", project_field: "project_remote" },
      ])
    ).toBe("git@github.com:acme/other.git");
  });

  it("names nothing when a stored record puts the anchor under this very project", () => {
    expect(
      anchorProjectElsewhere(here, [
        { project_id: "git@github.com:acme/widgets.git", project_field: "project_remote" },
      ])
    ).toBeNull();
  });

  it("compares nothing across two different namings", () => {
    expect(
      anchorProjectElsewhere(here, [{ project_id: "widgets", project_field: "project_id" }])
    ).toBeNull();
  });

  it("reads one project named by both fields as two values, never one match", () => {
    expect(
      anchorProjectElsewhere(
        [...here, { projectId: "acme-other", projectField: "project_id" }],
        [{ project_id: HERE_REMOTE, project_field: "project_id" }]
      )
    ).toBe(HERE_REMOTE);
  });

  it("names nothing for a record whose field is no field this journal ever wrote", () => {
    expect(
      anchorProjectElsewhere(BOTH, [
        { project_id: "git@github.com:acme/other.git", project_field: "project_slug" },
      ])
    ).toBeNull();
  });

  it("names nothing for a record whose field names a project the record itself does not", () => {
    expect(anchorProjectElsewhere(BOTH, [{ project_field: "project_id" }])).toBeNull();
  });

  it("names nothing for a record naming a project by no field at all", () => {
    expect(anchorProjectElsewhere(BOTH, [{ project_id: "acme-other" }])).toBeNull();
  });

  it("reads an empty project on a record as naming none", () => {
    expect(
      anchorProjectElsewhere(BOTH, [{ project_id: "", project_field: "project_id" }])
    ).toBeNull();
  });

  it("names a project the records put the anchor under by directory name", () => {
    expect(
      anchorProjectElsewhere(BOTH, [{ project_id: "acme-other", project_field: "project_id" }])
    ).toBe("acme-other");
  });

  it("names nothing when the stored records say nothing about a project", () => {
    expect(anchorProjectElsewhere(here, [{}, { project_id: "" }])).toBeNull();
  });

  it("names nothing when no record carries the field that named the project", () => {
    expect(
      anchorProjectElsewhere(here, [{ project_id: "git@github.com:acme/other.git" }])
    ).toBeNull();
  });

  it("names nothing when nothing here names a project to compare against", () => {
    expect(
      anchorProjectElsewhere(
        [],
        [{ project_id: "git@github.com:acme/other.git", project_field: "project_remote" }]
      )
    ).toBeNull();
  });

  it("names every project the records disagree on, rather than picking one", () => {
    expect(
      anchorProjectElsewhere(here, [
        { project_id: "git@github.com:acme/other.git", project_field: "project_remote" },
        { project_id: "git@github.com:acme/third.git", project_field: "project_remote" },
        { project_id: "git@github.com:acme/other.git", project_field: "project_remote" },
      ])
    ).toBe("git@github.com:acme/other.git, git@github.com:acme/third.git");
  });

  it("names nothing when one of several records puts the anchor here", () => {
    expect(
      anchorProjectElsewhere(here, [
        { project_id: "git@github.com:acme/other.git", project_field: "project_remote" },
        { project_id: "git@github.com:acme/widgets.git", project_field: "project_remote" },
      ])
    ).toBeNull();
  });
});
