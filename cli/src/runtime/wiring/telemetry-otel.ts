import { homedir } from "node:os";
import type {
  SessionAdmission,
  SessionFeature,
} from "../../contexts/telemetry/domain/report/session-feature.js";

import { startOtelCollector } from "../../contexts/telemetry/infrastructure/otel/actions/collect.js";
import { initializeOtel } from "../../contexts/telemetry/infrastructure/otel/actions/init.js";
import { runOtelOpenCode } from "../../contexts/telemetry/infrastructure/otel/actions/run.js";
import {
  type SyncOptions,
  syncOtel,
  type Transfer,
} from "../../contexts/telemetry/infrastructure/otel/actions/sync.js";
import {
  type AllOptions,
  syncAllOtel,
} from "../../contexts/telemetry/infrastructure/otel/actions/sync-all.js";
import {
  syncAllSessionTitles,
  type TitleOptions,
} from "../../contexts/telemetry/infrastructure/otel/actions/sync-all-titles.js";
import { verifyOtel } from "../../contexts/telemetry/infrastructure/otel/actions/verify.js";
import {
  CODEX_CONFIG_ID,
  OPENCODE_CONFIG_ID,
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
  options: Omit<SyncOptions, "home" | "stateDir">,
  resolve: () => Promise<SessionFeature>,
  permits: (transfer: Transfer) => Promise<boolean>
) {
  return syncOtel({ ...options, home: homedir(), stateDir: telemetryDir() }, resolve, permits);
}

export function followCapturedSessions(
  options: Omit<AllOptions, "home" | "stateDir">,
  snapshot: () => Promise<ReadonlyMap<string, SessionAdmission>>,
  permits: (
    admission: SessionAdmission,
    at: string,
    start?: string,
    current?: string
  ) => Promise<"allow" | "deny" | "unknown">
) {
  return syncAllOtel({ ...options, home: homedir(), stateDir: telemetryDir() }, snapshot, permits);
}

export function syncCapturedSessionTitles(
  options: Omit<TitleOptions, "home" | "stateDir">,
  snapshot: () => Promise<ReadonlyMap<string, SessionAdmission>>,
  permits: (
    admission: SessionAdmission,
    at: string,
    start?: string,
    current?: string
  ) => Promise<"allow" | "deny" | "unknown">
) {
  return syncAllSessionTitles({ ...options, home: homedir() }, snapshot, permits);
}

export const otelOptions = {
  configs: OTEL_CONFIGS,
  syncConfigs: OTEL_SYNC_CONFIGS,
  titleConfig: CODEX_CONFIG_ID,
  usageTool: usageToolForOtel,
  endpoints: OTEL_ENDPOINTS,
  launchConfigs: [OPENCODE_CONFIG_ID],
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

export function launchOtel(args: readonly string[]) {
  return runOtelOpenCode(args, { home: homedir(), env: process.env });
}

export function checkOtel(
  config: (typeof OTEL_CONFIGS)[number],
  endpoint: (typeof OTEL_ENDPOINTS)[number]
) {
  return verifyOtel(config, endpoint, { home: homedir(), env: process.env });
}
