import { homedir } from "node:os";
import type { SessionAdmission } from "../../contexts/telemetry/domain/report/session-feature.js";
import { startOtelCollector } from "../../contexts/telemetry/infrastructure/otel/actions/collect.js";
import { initializeOtel } from "../../contexts/telemetry/infrastructure/otel/actions/init.js";
import {
  type SyncOptions,
  syncOtel,
  type Transfer,
} from "../../contexts/telemetry/infrastructure/otel/actions/sync.js";
import {
  type AllOptions,
  syncAllOtel,
} from "../../contexts/telemetry/infrastructure/otel/actions/sync-all.js";
import { verifyOtel } from "../../contexts/telemetry/infrastructure/otel/actions/verify.js";
import {
  OTEL_CONFIGS,
  OTEL_ENDPOINTS,
  OTEL_SYNC_CONFIGS,
  usageToolForOtel,
} from "../../contexts/telemetry/infrastructure/otel/settings.js";
import {
  checkInstallationId,
  ensureInstallationId,
  finishInstallationId,
} from "../filesystem/installation-identity.js";
import { userConfigDirOf } from "../user-config-dir.js";
import { telemetryDir } from "./telemetry.js";

export function collectOtel(port: number) {
  return startOtelCollector({ home: homedir(), port });
}

export function syncCapturedSession(
  options: Omit<SyncOptions, "home">,
  revalidate: () => Promise<void>,
  permits: (transfer: Transfer) => Promise<boolean>
) {
  return syncOtel({ ...options, home: homedir() }, revalidate, permits);
}

export function followCapturedSessions(
  options: Omit<AllOptions, "home" | "stateDir">,
  snapshot: () => Promise<ReadonlyMap<string, SessionAdmission>>,
  permits: (
    admission: SessionAdmission,
    at: string,
    start?: string,
    current?: string
  ) => Promise<"allow" | "deny" | "unknown">,
  proof?: (
    admission: SessionAdmission,
    at: string,
    start?: string,
    current?: string
  ) => Promise<string | null>
) {
  return syncAllOtel(
    { ...options, home: homedir(), stateDir: telemetryDir() },
    snapshot,
    permits,
    proof
  );
}

export const otelOptions = {
  configs: OTEL_CONFIGS,
  syncConfigs: OTEL_SYNC_CONFIGS,
  usageTool: usageToolForOtel,
  endpoints: OTEL_ENDPOINTS,
};

export async function configureOtel(
  config: (typeof OTEL_CONFIGS)[number],
  endpoint: (typeof OTEL_ENDPOINTS)[number]
) {
  const home = homedir();
  const directory = userConfigDirOf(process.env, home);
  if (endpoint !== "prod") await checkInstallationId(directory);
  const result = await initializeOtel(config, endpoint, { home, env: process.env });
  await finishInstallationId(() => ensureInstallationId(directory), "OTLP configuration completed");
  return result;
}

export function checkOtel(
  config: (typeof OTEL_CONFIGS)[number],
  endpoint: (typeof OTEL_ENDPOINTS)[number]
) {
  return verifyOtel(config, endpoint, { home: homedir(), env: process.env });
}
