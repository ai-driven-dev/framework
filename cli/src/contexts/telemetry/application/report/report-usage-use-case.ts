import type { PersonIdentityStore } from "../../domain/ports/identity/person-identity-store.js";
import type { RepositoryLocator } from "../../domain/ports/repository-locator.js";
import type { UsageLedger } from "../../domain/ports/usage-ledger.js";
import { attribute } from "../../domain/report/attribution.js";
import { inPeriod, type Period, windowOf } from "../../domain/report/period.js";
import {
  type AbsentAxis,
  conflictsOf,
  type FilterFlag,
  matchesFilter,
  NO_FILTERS,
  type ReportFilters,
  resolveId,
} from "../../domain/report/report-filter.js";
import {
  buildReport,
  type ReportAxis,
  type UsageReport,
} from "../../domain/report/usage-report.js";
import { repositoryIdOf } from "../../domain/repository-identity.js";
import type { NotStoredReason } from "../../domain/repository-resolution.js";
import { callId, type StoredUsage } from "../../domain/stored-usage.js";
import { type IngestUsageUseCase, NOT_STORED } from "../ingest-usage-use-case.js";
import { settleLedger } from "../ledger-upkeep.js";
import type { DeclaredBindings } from "./declared-bindings.js";

/** The filters as typed: a session or repository may be the start of an id. A repository is
 * either typed, or `--repository .`, the directory `here` whose repository is asked for; never
 * both. */
export type RequestedFilters =
  | (ReportFilters & { readonly here?: undefined })
  | (ReportFilters & { readonly repository: null; readonly here: string });

export interface ReportRequest {
  readonly axis: ReportAxis;
  readonly period: Period;
  /** None given: every call of the period. */
  readonly filters?: RequestedFilters;
}

/** The flags typed as the start of an id. */
type PrefixFlag = "session" | "repository";

/** What the figures rest on, so a reader can tell a small number from a missing one. */
export interface ReportCoverage {
  /** Transcripts read by this run: new, or grown since the last. */
  readonly filesRead: number;
  /** Billed calls in the report's period. */
  readonly records: number;
  /** Transcript lines that were no usage line, of every ingest so far, whoever ran it: they
   * have no day, so every report counts all of them. */
  readonly unrecognised: number;
  /** Billed calls of the period an ingest, whoever ran it, read and did not store and no read
   * stored since, by the reason. `undated` has no day: every report counts all of them. */
  readonly notStored: Readonly<Record<NotStoredReason, number>>;
  /** A line of `ledger/consents.jsonl` was not an event: nothing is stored until it is recovered. */
  readonly consentLogDamaged: boolean;
  /** When the oldest transcript still on disk was last written: nothing older can be read. */
  readonly oldestTranscriptAt: string | null;
  /** Lines of the partitions read that were not records, kept: a bounded report reads its
   * period and the day on each side, of the ledger and of what was left out. */
  readonly skippedLedgerLines: number;
}

export type ReportResult =
  | { readonly status: "refused" }
  /** Two flags given select on one axis, so together they would keep nothing. */
  | {
      readonly status: "conflicting";
      readonly flags: readonly [FilterFlag, FilterFlag];
      readonly absent: AbsentAxis | null;
    }
  /** `.` was asked for in a directory that names no repository. */
  | { readonly status: "not-a-repository" }
  /** A start two ids or more of the period share, all of them, sorted. */
  | {
      readonly status: "ambiguous";
      readonly flag: PrefixFlag;
      readonly typed: string;
      readonly ids: readonly string[];
    }
  | {
      readonly status: "reported";
      readonly period: Period;
      /** As resolved: a full id for a start or `.`, the start as typed when it names nothing. */
      readonly filters: ReportFilters;
      readonly report: UsageReport;
      readonly coverage: ReportCoverage;
    };

/** Reads what is new, then answers what the stored calls consumed in a period, split along one
 * axis. The ledger holds facts only: what a call belongs to is worked out here, every time, from
 * what people declared, so a declaration made later moves earlier work. It also settles what it
 * read: one call in one partition, by day, whatever order the ingests ran in. A report with a
 * bounded period reads and settles only the partitions that can hold a call of it (see
 * `windowOf`), so its cost follows its period and not the history; one with no bound reads and
 * settles the whole ledger.
 *
 * Filters keep the calls of the period whose axes are what they name, after attribution, so
 * the report they give adds up to the row of the unfiltered one they select. Flags that select
 * on one axis are refused first, then the environment's refusal, then `.` is located, before
 * anything is read: refusal means no git is run either. */
export class ReportUsageUseCase {
  constructor(
    private readonly ingest: IngestUsageUseCase,
    private readonly ledger: UsageLedger,
    private readonly declared: DeclaredBindings,
    private readonly identity: PersonIdentityStore,
    private readonly locator: RepositoryLocator,
    private readonly options: { readonly refusedByEnvironment: boolean }
  ) {}

  async execute(request: ReportRequest): Promise<ReportResult> {
    const { here, ...asked }: RequestedFilters = request.filters ?? NO_FILTERS;
    const [conflict] = conflictsOf(asked);
    if (conflict !== undefined) {
      return { status: "conflicting", flags: conflict, absent: asked.absent };
    }
    if (this.options.refusedByEnvironment) return { status: "refused" };
    const located = here === undefined ? undefined : await this.repositoryIn(here);
    if (located === null) return { status: "not-a-repository" };
    const { filesRead, consentLogDamaged, oldestTranscriptAt } = await this.ingest.execute();
    const window = windowOf(request.period);
    const [held, left, noDay] = await this.ledger.exclusively(async () => [
      await settleLedger(this.ledger, window),
      await settleLedger(this.ledger.leftOut, window),
      await this.ledger.leftOut.noDay(),
    ]);
    // Whoever ingested: a call of the period left out and never stored, by its reason.
    const stored = new Set(held.records.map(callId));
    const notStored = { ...NOT_STORED, undated: noDay.undated };
    for (const call of left.records) {
      const reason = call.repository_id;
      if (
        inPeriod(call.at, request.period) &&
        !stored.has(callId(call)) &&
        Object.hasOwn(NOT_STORED, reason)
      ) {
        notStored[reason as NotStoredReason] += 1;
      }
    }
    const records = held.records.filter((record) => inPeriod(record.at, request.period));
    const session = resolvedIn(records, "session", asked.session);
    if ("status" in session) return session;
    // `.` names one repository in full: it is never the start of another.
    const repository =
      located === undefined ? resolvedIn(records, "repository", asked.repository) : { id: located };
    if ("status" in repository) return repository;
    const filters: ReportFilters = { ...asked, session: session.id, repository: repository.id };
    const facts = await this.declared.read();
    const person = await this.identity.read();
    const selected = records.filter((record) =>
      matchesFilter(filters, record, attribute(record, facts), person)
    );
    return {
      status: "reported",
      period: request.period,
      filters,
      report: buildReport(selected, facts, person, request.axis),
      coverage: {
        filesRead,
        records: records.length,
        unrecognised: noDay.unrecognised,
        notStored,
        consentLogDamaged,
        oldestTranscriptAt,
        skippedLedgerLines: held.skippedLines + left.skippedLines,
      },
    };
  }

  /** The repository a directory is in, named as ingest names it; `null` when it names none. */
  private async repositoryIn(dir: string): Promise<string | null> {
    const located = await this.locator.locate(dir);
    return located.status === "repository" ? repositoryIdOf(located) : null;
  }
}

/** A session or repository typed in full or by its start, among the ids of the period's calls.
 * A start that names none is kept as typed, and keeps no call. */
function resolvedIn(
  records: readonly StoredUsage[],
  flag: PrefixFlag,
  typed: string | null
): { readonly id: string | null } | Extract<ReportResult, { status: "ambiguous" }> {
  if (typed === null) return { id: null };
  const found = resolveId(
    typed,
    records.map((record) => (flag === "session" ? record.session_id : record.repository_id))
  );
  if (found.kind === "ambiguous") return { status: "ambiguous", flag, typed, ids: found.ids };
  return { id: found.kind === "found" ? found.id : typed };
}
