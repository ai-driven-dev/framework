import type { Environment } from "../../../../shared/ports/environment.js";
import type { Period } from "../../contract/period.js";
import {
  type AbsentAxis,
  type FilterFlag,
  NO_FILTERS,
  type ReportFilters,
} from "../../contract/report-filter.js";
import type { ReportAxis, UsageReport } from "../../contract/usage-report.js";
import { attribute } from "../../domain/report/attribution.js";
import { inPeriod, windowOf } from "../../domain/report/period.js";
import { conflictsOf, matchesFilter } from "../../domain/report/report-filter.js";
import { buildReport } from "../../domain/report/usage-report.js";
import { repositoryIdOf } from "../../domain/repository-identity.js";
import { MEASUREMENT_SWITCH, measurementRefused } from "../../domain/telemetry-consent.js";
import type { RepositoryLocator } from "../../ports/repository-locator.js";
import type { LeftOutReason, UsageLedger } from "../../ports/usage-ledger.js";
import type { IngestUsage, IngestUsageResult } from "../ingest-usage.use-case.js";
import { settleLedger } from "../ledger-upkeep.js";
import type { DeclaredBindings } from "./declared-bindings.js";
import { type AmbiguousStart, resolvedFilters } from "./resolved-filters.js";

/** The filters as typed: a session or repository may be the start of an id. A repository is
 * either typed, or `--repository .`, the directory `here` whose repository is asked for; never
 * both. */
export type RequestedFilters =
  | (ReportFilters & { readonly here?: undefined })
  | (ReportFilters & { readonly repository: null; readonly here: string });

export interface ReportUsageRequest {
  readonly axis: ReportAxis;
  readonly period: Period;
  /** None given: every call of the period. */
  readonly filters?: RequestedFilters;
}

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
    IngestUsageResult,
    "filesRead" | "unrecognised" | "notStored" | "consentLogDamaged" | "oldestTranscriptAt"
  > {
  /** Lines of the partitions read that were not records, counted before the report settled
   * them: a bounded report reads its period and the day on each side. */
  readonly skippedLedgerLines: number;
}

export type ReportUsageResult =
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
  | AmbiguousStart
  | {
      readonly status: "reported";
      readonly period: Period;
      /** As resolved: a full id for a start or `.`, the start as typed when it names nothing. */
      readonly filters: ReportFilters;
      readonly report: UsageReport;
      readonly coverage: ReportCoverage;
      readonly run: ReportRun;
    };

interface ReportUsageDeps {
  /** Only its run is used: whatever it found is the report's `run`, never a figure. */
  readonly ingest: Pick<IngestUsage, "execute">;
  readonly ledger: UsageLedger;
  readonly declared: DeclaredBindings;
  readonly locator: RepositoryLocator;
  readonly environment: Environment;
}

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
export class ReportUsage {
  constructor(private readonly deps: ReportUsageDeps) {}

  async execute(request: ReportUsageRequest): Promise<ReportUsageResult> {
    const { here, ...asked }: RequestedFilters = request.filters ?? NO_FILTERS;
    const [conflict] = conflictsOf(asked);
    if (conflict !== undefined) {
      return { status: "conflicting", flags: conflict, absent: asked.absent };
    }
    if (measurementRefused(this.deps.environment.get(MEASUREMENT_SWITCH))) {
      return { status: "refused" };
    }
    const located = here === undefined ? undefined : await this.repositoryIn(here);
    if (located === null) return { status: "not-a-repository" };
    const ingested = await this.deps.ingest.execute();
    const { held, leftOut } = await this.settled(request.period);
    const records = held.records.filter((record) => inPeriod(record.at, request.period));
    const filters = resolvedFilters(records, asked, located);
    if ("status" in filters) return filters;
    const { facts, person } = await this.deps.declared.read();
    const selected = records.filter((record) =>
      matchesFilter({ filters, record, attribution: attribute(record, facts), person })
    );
    return {
      status: "reported",
      period: request.period,
      filters,
      report: buildReport({ records: selected, facts, person, axis: request.axis }),
      coverage: { records: records.length, leftOut },
      run: { ...runOf(ingested), skippedLedgerLines: held.skippedLines },
    };
  }

  private async settled(period: Period) {
    const { ledger } = this.deps;
    const [held, leftOut] = await ledger.exclusively(async () => [
      await settleLedger(ledger, windowOf(period)),
      await ledger.leftOut.counts(),
    ]);
    return { held, leftOut };
  }

  /** The repository a directory is in, named as ingest names it; `null` when it names none. */
  private async repositoryIn(dir: string): Promise<string | null> {
    const located = await this.deps.locator.locate(dir);
    return located.status === "repository" ? repositoryIdOf(located) : null;
  }
}

const runOf = ({
  filesRead,
  unrecognised,
  notStored,
  consentLogDamaged,
  oldestTranscriptAt,
}: IngestUsageResult) => ({
  filesRead,
  unrecognised,
  notStored,
  consentLogDamaged,
  oldestTranscriptAt,
});
