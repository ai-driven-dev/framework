import type { UsageLedger } from "../../domain/ports/usage-ledger.js";
import {
  type SessionAdmission,
  type SessionFeature,
  sessionFeatureOf,
} from "../../domain/report/session-feature.js";
import type { StoredUsage } from "../../domain/stored-usage.js";
import type { UsageTool } from "../../domain/usage-record.js";
import type { IngestUsageUseCase } from "../ingest-usage-use-case.js";
import { settleLedger } from "../ledger-upkeep.js";
import type { DeclaredBindings } from "./declared-bindings.js";
import type { SessionConsent } from "./session-consent.js";

/** Only usage already admitted by the clone's consent can be forwarded. */
export class SessionFeatureUseCase {
  constructor(
    private readonly ingest: Pick<IngestUsageUseCase, "execute">,
    private readonly ledger: UsageLedger,
    private readonly declared: Pick<DeclaredBindings, "read">,
    private readonly consent: Pick<SessionConsent, "permits">
  ) {}

  async snapshot(tool: UsageTool): Promise<Map<string, SessionAdmission>> {
    if ((await this.ingest.execute()).refused)
      throw new Error("AIDD telemetry is disabled; no capture was sent.");
    const held = await this.ledger.exclusively(() => settleLedger(this.ledger));
    const facts = await this.declared.read();
    const sessions = new Map<string, StoredUsage[]>();
    for (const record of held.records.filter((item) => item.tool === tool)) {
      const group = sessions.get(record.session_id) ?? [];
      group.push(record);
      sessions.set(record.session_id, group);
    }
    return new Map(
      [...sessions].map(([id, records]) => {
        const directories = new Set(records.map((record) => record.cwd));
        const repositories = new Set(records.map((record) => record.repository_id));
        return [
          id,
          {
            feature: sessionFeatureOf(records, facts),
            cwd: directories.size === 1 ? records[0].cwd : null,
            repositoryId: repositories.size === 1 ? records[0].repository_id : null,
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

  async permits(admission: SessionAdmission, at: string, start?: string) {
    return this.consent.permits(admission, at, start);
  }
}
