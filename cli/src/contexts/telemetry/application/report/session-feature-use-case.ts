import {
  type SessionAdmission,
  type SessionFeature,
  sessionFeatureOf,
} from "../../domain/report/session-feature.js";
import type { StoredUsage } from "../../domain/stored-usage.js";
import type { UsageTool } from "../../domain/usage-record.js";
import type { IngestUsageUseCase } from "../ingest-usage-use-case.js";
import type { DeclaredBindings } from "./declared-bindings.js";
import type { ReportLedger } from "./repository-uncertainty.js";
import type { SessionConsent } from "./session-consent.js";

/** Only usage already admitted by the clone's consent can be forwarded. */
export class SessionFeatureUseCase {
  constructor(
    private readonly ingest: Pick<IngestUsageUseCase, "execute">,
    private readonly ledger: ReportLedger,
    private readonly declared: Pick<DeclaredBindings, "read">,
    private readonly consent: Pick<SessionConsent, "permits"> &
      Partial<Pick<SessionConsent, "proof">>
  ) {}

  async snapshot(tool: UsageTool): Promise<Map<string, SessionAdmission>> {
    if ((await this.ingest.execute()).refused)
      throw new Error("AIDD telemetry is disabled; no capture was sent.");
    const { records } = await this.ledger.read(undefined, tool);
    const facts = await this.declared.read();
    const sessions = new Map<string, StoredUsage[]>();
    for (const record of records) {
      const group = sessions.get(record.session_id) ?? [];
      group.push(record);
      sessions.set(record.session_id, group);
    }
    return new Map(
      [...sessions].map(([id, records]) => {
        const directories = new Set(records.map((record) => record.cwd));
        const repositories = new Set(records.map((record) => record.repository_id));
        const uncertain =
          repositories.size !== 1 || records.some((record) => record.repository_uncertain);
        return [
          id,
          {
            feature: uncertain ? { state: "ambiguous" as const } : sessionFeatureOf(records, facts),
            cwd: directories.size === 1 ? records[0].cwd : null,
            repositoryId: uncertain ? null : records[0].repository_id,
          },
        ];
      })
    );
  }

  async execute(session: string, tool: UsageTool): Promise<SessionFeature> {
    const found = (await this.snapshot(tool)).get(session);
    if (!found) throw new Error("No consented usage found for this session; no capture was sent.");
    return found.feature;
  }

  async permits(admission: SessionAdmission, at: string, start?: string, current?: string) {
    return this.consent.permits(admission, at, start, current);
  }

  async cloneProof(admission: SessionAdmission, at: string, start?: string, current?: string) {
    return this.consent.proof?.(admission, at, start, current) ?? null;
  }
}
