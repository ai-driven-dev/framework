import { appendFile, mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { ClaudeTranscriptSourceAdapter } from "../../../../src/contexts/telemetry/infrastructure/sources/claude/claude-transcript-source-adapter.js";
import { InMemoryTranscripts } from "../testing/in-memory-transcripts.fake.js";
import {
  describeUsageSourceContract,
  type UsageSourceSubject,
} from "../testing/usage-source.contract.js";

const SECONDS = 1000;

describeUsageSourceContract("the in-memory transcripts", async (): Promise<UsageSourceSubject> => {
  const transcripts = new InMemoryTranscripts();
  return {
    source: transcripts,
    write: async (session, lines) => {
      const path = `projects/p/${session}.jsonl`;
      transcripts.files.set(path, [...lines]);
      return path;
    },
    append: async (path, lines) => {
      transcripts.files.set(path, [...(transcripts.files.get(path) ?? []), ...lines]);
    },
    touch: async (path, epochMs) => {
      transcripts.modified.set(path, new Date(epochMs).toISOString());
    },
    dispose: async () => undefined,
  };
});

describeUsageSourceContract(
  "Claude's transcripts on a temp dir",
  async (): Promise<UsageSourceSubject> => {
    const root = await mkdtemp(join(tmpdir(), "aidd-claude-usage-contract-"));
    const projects = join(root, "projects");
    await mkdir(projects, { recursive: true });
    return {
      source: new ClaudeTranscriptSourceAdapter(projects),
      write: async (session, lines) => {
        const path = join(projects, "p", `${session}.jsonl`);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, lines.map((line) => `${line}\n`).join(""));
        return path;
      },
      append: (path, lines) => appendFile(path, lines.map((line) => `${line}\n`).join("")),
      touch: (path, epochMs) => utimes(path, epochMs / SECONDS, epochMs / SECONDS),
      dispose: () => rm(root, { recursive: true, force: true }),
    };
  }
);
