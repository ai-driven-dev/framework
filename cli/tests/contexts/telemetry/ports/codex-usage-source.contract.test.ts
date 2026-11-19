import { appendFile, mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { CodexTranscriptSourceAdapter } from "../../../../src/contexts/telemetry/infrastructure/sources/codex/codex-transcript-source-adapter.js";
import {
  describeUsageSourceContract,
  type UsageSourceSubject,
} from "../testing/usage-source-contract.js";

const SECONDS = 1000;

describeUsageSourceContract(
  "Codex's session files on a temp dir",
  async (): Promise<UsageSourceSubject> => {
    const root = await mkdtemp(join(tmpdir(), "aidd-codex-usage-contract-"));
    const sessions = join(root, "sessions");
    await mkdir(sessions, { recursive: true });
    return {
      source: new CodexTranscriptSourceAdapter([sessions]),
      write: async (session, lines) => {
        const path = join(sessions, "2026", "10", "07", `rollout-${session}.jsonl`);
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
