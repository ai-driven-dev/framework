import type { PersonIdentityStore } from "../../domain/ports/identity/person-identity-store.js";
import type { RepositoryLocator } from "../../domain/ports/repository-locator.js";
import type { LeftOutReason, UsageLedger } from "../../domain/ports/usage-ledger.js";
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
import type { StoredUsage } from "../../domain/stored-usage.js";
import type { IngestResult, IngestUsageUseCase } from "../ingest-usage-use-case.js";
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

/** What the figures rest on, so a reader can tell a small number from a missing one. Like the
 * figures, a function of what is stored and asked alone. */
export interface ReportCoverage {
  /** Billed calls in the report's period. */
  readonly records: number;
  /** What every ingest so far, whoever ran it, measured and could not store, by reason: none of
   * it has a day, so every report counts all of it. */
  readonly leftOut: Readonly<Record<LeftOutReason, number>>;
}

/** What the read that made the report found: two reports over the same stored calls can find
 * different things. */
export interface ReportRun
  extends Pick<
    IngestResult,
    "filesRead" | "unrecognised" | "notStored" | "consentLogDamaged" | "oldestTranscriptAt"
  > {
  /** Lines of the partitions read that were not records, counted before the report settled
   * them: a bounded report reads its period and the day on each side. */
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
      readonly run: ReportRun;
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
    /** Only its run is used: whatever it found is the report's `run`, never a figure. */
    private readonly ingest: Pick<IngestUsageUseCase, "execute">,
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
    const { filesRead, unrecognised, notStored, consentLogDamaged, oldestTranscriptAt } =
      await this.ingest.execute();
    const [held, leftOut] = await this.ledger.exclusively(async () => [
      await settleLedger(this.ledger, windowOf(request.period)),
      await this.ledger.leftOut.counts(),
    ]);
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
      coverage: { records: records.length, leftOut },
      run: {
        filesRead,
        unrecognised,
        notStored,
        consentLogDamaged,
        oldestTranscriptAt,
        skippedLedgerLines: held.skippedLines,
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
