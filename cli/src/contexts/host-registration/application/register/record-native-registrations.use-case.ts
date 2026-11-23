import type { ToolId } from "../../../../shared/domain/tool.js";
import type { NativeHostCatalog } from "../../contract/native-registration-spec.js";
import { afterActivation } from "../../domain/record/registration-projection.js";
import type { RegistrationRecordData } from "../../domain/record/registration-record.js";
import type { HostRegistrationOutcome } from "./registration-outcome.js";

/** The records a scope keeps for its tools. */
export interface RegistrationRecordBook {
  get(toolId: ToolId): RegistrationRecordData | undefined;
  set(toolId: ToolId, record: RegistrationRecordData): void;
}

export interface RecordNativeRegistrationsRequest {
  readonly records: RegistrationRecordBook;
  readonly activated: ReadonlyMap<ToolId, HostRegistrationOutcome>;
  /** Whether the run was narrowed to some marketplaces. */
  readonly narrowed: boolean;
}

/** Writes what each activated tool's host registered into the records, and answers whether any
 * record changed. Only for a tool this run activated through a native plugin CLI. */
export class RecordNativeRegistrations {
  constructor(private readonly tools: NativeHostCatalog) {}

  execute({ records, activated, narrowed }: RecordNativeRegistrationsRequest): boolean {
    let changed = false;
    for (const [toolId, outcome] of activated) {
      const binary = this.tools.aiProfileIfAny(toolId)?.nativeActivation()?.hostBinary();
      if (binary === undefined) continue;
      const registrations = afterActivation(records.get(toolId), outcome, { binary, narrowed });
      if (registrations === undefined) continue;
      records.set(toolId, registrations);
      changed = true;
    }
    return changed;
  }
}
