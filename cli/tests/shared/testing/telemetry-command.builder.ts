import { Command } from "commander";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { wireTelemetryRequests } from "../../../src/composition/telemetry.js";
import { CheckIdentity } from "../../../src/contexts/telemetry/application/identity/check-identity.use-case.js";
import { RequestReport } from "../../../src/contexts/telemetry/application/report/request-report.use-case.js";
import { ChooseIdentity } from "../../../src/orchestration/telemetry/choose-identity.use-case.js";
import { bindOutput } from "../../../src/presentation/controllers/global-options.controller.js";
import { registerTelemetryCommand } from "../../../src/presentation/controllers/telemetry.controller.js";
import { processOutputFactory } from "./output-factory.builder.js";
import { parseToExit } from "./parse-to-exit.builder.js";
import { prompterAnswering } from "./partial-ports.builder.js";

export const ingest: Mock = vi.fn();
export const declare: Mock = vi.fn();
export const show: Mock = vi.fn();
export const report: Mock = vi.fn();
export const identity: { execute: Mock } = { execute: vi.fn() };
export const turnOn: Mock = vi.fn();
export const retention: Mock = vi.fn();
export const turnOff: Mock = vi.fn();
export const forget: Mock = vi.fn();
export const confirm: Mock = vi.fn();
export const select: Mock = vi.fn();
export const input: Mock = vi.fn();
export const propose: Mock = vi.fn();

export const prompter = prompterAnswering({ confirm, select, input });
export const proposeIdentity: { execute: Mock } = { execute: propose };

export const createDeps: Mock = vi.fn(async () => ({
  prompter,
  telemetry: {
    readTranscriptRetention: { execute: retention },
    enableTelemetry: { execute: turnOn },
    disableTelemetry: { execute: turnOff },
    forgetTelemetry: { execute: forget },
    ingestUsage: { execute: ingest },
    declareTask: { execute: declare },
    readTelemetryStatus: { execute: show },
    requestReport: new RequestReport({ execute: report }),
    manageIdentity: identity,
    proposeIdentity,
    chooseIdentity: new ChooseIdentity({
      manageIdentity: identity,
      proposeIdentity,
      checkIdentity: new CheckIdentity(),
      prompter,
    }),
  },
}));

class Exit extends Error {
  constructor(readonly code: number | undefined) {
    super(`exit ${String(code)}`);
  }
}

let out: string[] = [];
let err: string[] = [];

export function installTelemetryIo(): void {
  beforeEach(() => {
    vi.clearAllMocks();
    out = [];
    err = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      out.push(String(chunk));
      return true;
    });
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      err.push(String(chunk));
      return true;
    });
    vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Exit(Number(code ?? 0));
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
}

export async function run(...args: string[]): Promise<number | null> {
  const program = new Command();
  bindOutput(program, processOutputFactory());
  program.exitOverride();
  program.option("--verbose");
  registerTelemetryCommand(program, createDeps, wireTelemetryRequests());
  try {
    await parseToExit(program, ["node", "aidd", "telemetry", ...args]);
    return null;
  } catch (error) {
    if (error instanceof Exit) return error.code ?? 0;
    throw error;
  }
}
export const stdout = () => out.join("");
export const stderr = () => err.join("");

export const NOT_STORED = {
  "outside-repo": 0,
  "never-seen-alive": 0,
  "no-consent": 0,
  "consent-closed": 0,
  "unreadable-consent": 0,
  "no-cwd": 0,
  undated: 0,
};
export const ZERO = { known: 0, unknownRecords: 0 };
export const NO_FILTERS = {
  task: null,
  ticket: null,
  person: null,
  model: null,
  agent: null,
  session: null,
  repository: null,
  absent: null,
  unattributed: null,
  tool: null,
};
export const reported = {
  status: "reported",
  period: { from: null, to: null },
  filters: NO_FILTERS,
  report: {
    axis: "total",
    rows: [],
    totals: {
      records: 0,
      counters: { input: ZERO, output: ZERO, cache_read: ZERO, cache_write: ZERO },
      total: ZERO,
    },
  },
  coverage: { records: 0, leftOut: { undated: 0, unrecognised: 0 } },
  run: {
    filesRead: 0,
    unrecognised: 0,
    notStored: NOT_STORED,
    consentLogDamaged: false,
    oldestTranscriptAt: null,
    skippedLedgerLines: 0,
  },
};
