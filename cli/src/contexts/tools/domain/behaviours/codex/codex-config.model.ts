import { errorMessage } from "../../../../../shared/domain/describe-error.js";
import { TomlParseError } from "../../../contract/errors/tools.error.js";
import type { TomlCodec } from "../../formats/toml.js";

type TomlRecord = Record<string, unknown>;

const MIN_PROJECT_DOC_MAX_BYTES = 262144;

/** A file that is not TOML is refused, never read as empty: the merge would overwrite it. */
function parseToml(toml: TomlCodec, content: string): TomlRecord {
  if (!content.trim()) return {};
  try {
    return toml.parse(content);
  } catch (err) {
    throw new TomlParseError(errorMessage(err));
  }
}

function mergeMcpServers(existing: TomlRecord, incoming: TomlRecord): void {
  const incomingServers = incoming.mcp_servers as TomlRecord | undefined;
  if (!incomingServers) return;
  const existingServers = (existing.mcp_servers ?? {}) as TomlRecord;
  for (const [name, value] of Object.entries(incomingServers)) {
    if (!(name in existingServers)) {
      existingServers[name] = value;
    }
  }
  existing.mcp_servers = existingServers;
}

function ensureProjectDocMaxBytes(existing: TomlRecord, incoming: TomlRecord): void {
  const existingVal =
    typeof existing.project_doc_max_bytes === "number" ? existing.project_doc_max_bytes : 0;
  const incomingVal =
    typeof incoming.project_doc_max_bytes === "number"
      ? incoming.project_doc_max_bytes
      : MIN_PROJECT_DOC_MAX_BYTES;
  if (existingVal >= MIN_PROJECT_DOC_MAX_BYTES) return;
  existing.project_doc_max_bytes = Math.max(existingVal, incomingVal, MIN_PROJECT_DOC_MAX_BYTES);
}

function ensureCodexHooks(existing: TomlRecord): void {
  const features = existing.features as TomlRecord | undefined;
  if (features?.hooks !== undefined || features?.codex_hooks !== undefined) return;
  existing.features = { ...(features ?? {}), hooks: true };
}

export function mergeCodexConfigToml(
  toml: TomlCodec
): (existing: string, aiddPayload: string) => string {
  return (existing, aiddPayload) => {
    const result = parseToml(toml, existing);
    const payload = parseToml(toml, aiddPayload);
    mergeMcpServers(result, payload);
    ensureProjectDocMaxBytes(result, payload);
    ensureCodexHooks(result);
    return toml.stringify(result);
  };
}
