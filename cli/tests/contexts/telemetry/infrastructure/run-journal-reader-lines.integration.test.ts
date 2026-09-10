import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  READABLE_JOURNAL_SCHEMA_VERSION,
  RunJournalReaderAdapter,
} from "../../../../src/contexts/telemetry/infrastructure/run-journal-reader-adapter.js";

const RUN_ID = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const AT = "2026-08-20T10:00:00Z";

const HEADER = {
  type: "session_start",
  at: "2026-08-20T09:59:00Z",
  run_id: RUN_ID,
  tool: "claude-code",
  vendor_id: SESSION_ID,
} as const;

function lines(...values: readonly unknown[]): string {
  return `${values.map((value) => JSON.stringify(value)).join("\n")}\n`;
}

describe("RunJournalReaderAdapter, one line at a time", () => {
  let projectRoot: string;
  let runsDir: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), "aidd-run-journal-lines-"));
    runsDir = join(projectRoot, "aidd_docs", "runs");
    await mkdir(runsDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  async function readAfterWriting(...values: readonly unknown[]) {
    await writeFile(join(runsDir, `${RUN_ID}__${SESSION_ID}.jsonl`), lines(...values));
    return new RunJournalReaderAdapter(projectRoot).read(SESSION_ID);
  }

  async function readRaw(content: string) {
    await writeFile(join(runsDir, `${RUN_ID}__${SESSION_ID}.jsonl`), content);
    return new RunJournalReaderAdapter(projectRoot).read(SESSION_ID);
  }

  describe("the run file a session id names", () => {
    it("ignores a file whose name carries the session id under another extension", async () => {
      await writeFile(
        join(runsDir, `${RUN_ID}__${SESSION_ID}.jsonx`),
        lines({ type: "step_start", at: AT, skill: "x" })
      );

      await expect(new RunJournalReaderAdapter(projectRoot).read(SESSION_ID)).resolves.toBeNull();
    });

    it("ignores a run file naming no session at all", async () => {
      await writeFile(join(runsDir, `${RUN_ID}__.jsonl`), lines({ type: "turn_end", at: AT }));

      await expect(new RunJournalReaderAdapter(projectRoot).read(SESSION_ID)).resolves.toBeNull();
    });

    it("ignores a file whose run id and session id are not joined by the double underscore", async () => {
      await writeFile(
        join(runsDir, `${RUN_ID}--${SESSION_ID}.jsonl`),
        lines({ type: "turn_end", at: AT })
      );

      await expect(new RunJournalReaderAdapter(projectRoot).read(SESSION_ID)).resolves.toBeNull();
    });
  });

  describe("a boundary line", () => {
    it("reads a step_end as the boundary that names its skill", async () => {
      const journal = await readAfterWriting({
        type: "step_end",
        at: AT,
        skill: "aidd-dev:01-plan",
      });

      expect(journal?.boundaries).toStrictEqual([
        { type: "step_end", at: AT, skill: "aidd-dev:01-plan" },
      ]);
    });

    it("carries a step_start's turn_id when the hook wrote one", async () => {
      const journal = await readAfterWriting({
        type: "step_start",
        at: AT,
        skill: "aidd-dev:01-plan",
        turn_id: "turn-7",
      });

      expect(journal?.boundaries).toStrictEqual([
        { type: "step_start", at: AT, skill: "aidd-dev:01-plan", turn_id: "turn-7" },
      ]);
    });

    it("carries no turn_id key at all for a step_start written without one", async () => {
      const journal = await readAfterWriting({
        type: "step_start",
        at: AT,
        skill: "aidd-dev:01-plan",
      });

      expect(journal?.boundaries).toStrictEqual([
        { type: "step_start", at: AT, skill: "aidd-dev:01-plan" },
      ]);
    });

    it("drops a turn_end that carries no moment", async () => {
      const journal = await readAfterWriting({ type: "turn_end" });

      expect(journal?.boundaries).toStrictEqual([]);
    });

    it("drops a step_start that names no skill", async () => {
      const journal = await readAfterWriting({ type: "step_start", at: AT });

      expect(journal?.boundaries).toStrictEqual([]);
    });

    it("drops a moment that is not a string", async () => {
      const journal = await readAfterWriting({ type: "turn_end", at: 1755684000000 });

      expect(journal?.boundaries).toStrictEqual([]);
    });

    it("reads a line of a type it has never heard of as nothing, even carrying a moment and a skill", async () => {
      const journal = await readAfterWriting({
        type: "step_paused",
        at: AT,
        skill: "aidd-dev:01-plan",
      });

      expect(journal).toStrictEqual({ boundaries: [], filesWritten: [], taskDeclarations: [] });
    });
  });

  describe("a file_written or task_declared line", () => {
    it.each([
      ["file_written", { type: "file_written", path: "aidd_docs/tasks/2026_08/t/plan.md" }],
      ["file_written", { type: "file_written", at: AT }],
      ["task_declared", { type: "task_declared", path: "aidd_docs/tasks/2026_08/t/plan.md" }],
      ["task_declared", { type: "task_declared", at: AT }],
    ])("drops a %s line missing its moment or its path: %j", async (_type, line) => {
      const journal = await readAfterWriting(line);

      expect(journal).toStrictEqual({ boundaries: [], filesWritten: [], taskDeclarations: [] });
    });

    it("reads a task_declared line as exactly its moment and its path", async () => {
      const journal = await readAfterWriting({
        type: "task_declared",
        at: AT,
        path: "aidd_docs/tasks/2026_08/t/spec.md",
        source: "stated",
      });

      expect(journal?.taskDeclarations).toStrictEqual([
        { type: "task_declared", at: AT, path: "aidd_docs/tasks/2026_08/t/spec.md" },
      ]);
    });
  });

  describe("the header line", () => {
    it("reads a minimal header as exactly its five fields, adding no key for a field nobody wrote", async () => {
      const journal = await readAfterWriting(HEADER);

      expect(journal?.session).toStrictEqual(HEADER);
    });

    it.each(["at", "run_id", "tool", "vendor_id"])(
      "refuses a header missing %s alone",
      async (field) => {
        const partial = Object.fromEntries(Object.entries(HEADER).filter(([key]) => key !== field));
        const journal = await readAfterWriting(partial);

        expect(journal?.session).toBeUndefined();
      }
    );

    it("refuses a header whose run_id is not a string", async () => {
      const journal = await readAfterWriting({ ...HEADER, run_id: 42 });

      expect(journal?.session).toBeUndefined();
    });

    it("takes the header only from a session_start line", async () => {
      const journal = await readAfterWriting({ ...HEADER, type: "session_end" });

      expect(journal?.session).toBeUndefined();
    });

    it("carries both worktree fields when the hook wrote them", async () => {
      const journal = await readAfterWriting({
        ...HEADER,
        worktree_id: "feature-x",
        worktree_repo_id: "acme/widgets",
      });

      expect(journal?.session).toStrictEqual({
        ...HEADER,
        worktree_id: "feature-x",
        worktree_repo_id: "acme/widgets",
      });
    });

    it("carries project_id, project_remote and schema_version each on its own", async () => {
      const journal = await readAfterWriting({
        ...HEADER,
        schema_version: READABLE_JOURNAL_SCHEMA_VERSION,
        project_id: "widgets",
        project_remote: "github.com/acme/widgets",
      });

      expect(journal?.session).toStrictEqual({
        ...HEADER,
        schema_version: READABLE_JOURNAL_SCHEMA_VERSION,
        project_id: "widgets",
        project_remote: "github.com/acme/widgets",
      });
    });

    it("reads a schema_version that is not a number as none stated, and still reads the journal", async () => {
      const journal = await readAfterWriting(
        { ...HEADER, schema_version: String(READABLE_JOURNAL_SCHEMA_VERSION) },
        { type: "turn_end", at: AT }
      );

      expect(journal).toStrictEqual({
        boundaries: [{ type: "turn_end", at: AT }],
        filesWritten: [],
        taskDeclarations: [],
        session: HEADER,
      });
    });

    it("reads a schema_version that overflowed to a non-finite number as none stated", async () => {
      const journal = await readRaw(
        `${JSON.stringify(HEADER).slice(0, -1)},"schema_version":1e999}\n`
      );

      expect(journal?.session).toStrictEqual(HEADER);
    });
  });

  describe("the run files it lists", () => {
    it("lists only .jsonl names, sorted", async () => {
      await writeFile(join(runsDir, "README.md"), "not a run file\n");
      await writeFile(join(runsDir, `${RUN_ID}__${SESSION_ID}.jsonl`), lines(HEADER));

      await expect(new RunJournalReaderAdapter(projectRoot).listRunFiles()).resolves.toStrictEqual([
        `${RUN_ID}__${SESSION_ID}.jsonl`,
      ]);
    });

    it("lists no run file at all, rather than throwing, when the runs directory is missing", async () => {
      await rm(runsDir, { recursive: true, force: true });

      await expect(new RunJournalReaderAdapter(projectRoot).listRunFiles()).resolves.toStrictEqual(
        []
      );
    });

    it("names no foreign schema for a journal under its own schema, nor for one stating none", async () => {
      await writeFile(
        join(runsDir, `${RUN_ID}__${SESSION_ID}.jsonl`),
        lines({ ...HEADER, schema_version: READABLE_JOURNAL_SCHEMA_VERSION })
      );
      await writeFile(join(runsDir, `${RUN_ID}__other.jsonl`), lines(HEADER));

      await expect(
        new RunJournalReaderAdapter(projectRoot).listForeignSchemas()
      ).resolves.toStrictEqual([]);
    });

    it("still names a foreign schema beside a run file whose header is torn", async () => {
      await writeFile(join(runsDir, `${RUN_ID}__${SESSION_ID}.jsonl`), '{"type":"session_st\n');
      await writeFile(
        join(runsDir, `${RUN_ID}__other.jsonl`),
        lines({ ...HEADER, schema_version: READABLE_JOURNAL_SCHEMA_VERSION + 1 })
      );

      await expect(
        new RunJournalReaderAdapter(projectRoot).listForeignSchemas()
      ).resolves.toStrictEqual([READABLE_JOURNAL_SCHEMA_VERSION + 1]);
    });

    it("skips a directory that merely carries the run file extension", async () => {
      await mkdir(join(runsDir, `${RUN_ID}__${SESSION_ID}.jsonl`));
      const adapter = new RunJournalReaderAdapter(projectRoot);

      await expect(adapter.listForeignSchemas()).resolves.toStrictEqual([]);
      await expect(adapter.list()).resolves.toStrictEqual([]);
      await expect(adapter.read(SESSION_ID)).resolves.toBeNull();
    });
  });

  describe("deleteRunFile", () => {
    it("names the refused name and the directory in the error it throws", async () => {
      const adapter = new RunJournalReaderAdapter(projectRoot);

      await expect(adapter.deleteRunFile(runsDir, "../escape.jsonl")).rejects.toThrow(
        `refusing to delete "../escape.jsonl" — not a run file name inside ${runsDir}`
      );
    });
  });
});
