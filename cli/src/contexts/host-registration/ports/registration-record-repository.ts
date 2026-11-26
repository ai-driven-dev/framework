import type { ToolId } from "../../../shared/domain/tool.js";
import type { RegistrationRecordData } from "../domain/record/registration-record.js";

/** Where one scope keeps what aidd asked each tool's host to register: its host data, one record
 * per tool, without the claims machine claims keeps on its refs. */
export interface RegistrationRecordRepository {
  load(): Promise<Map<ToolId, RegistrationRecordData>>;
  /** Saving none removes what was kept. */
  save(records: ReadonlyMap<ToolId, RegistrationRecordData>): Promise<void>;
}
