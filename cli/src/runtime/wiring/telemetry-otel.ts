import { homedir } from "node:os";
import { startOtelCollector } from "../../contexts/telemetry/infrastructure/otel/actions/collect.js";
import { initializeOtel } from "../../contexts/telemetry/infrastructure/otel/actions/init.js";
import { runOtel } from "../../contexts/telemetry/infrastructure/otel/actions/run.js";
import { verifyOtel } from "../../contexts/telemetry/infrastructure/otel/actions/verify.js";
import {
  OTEL_CONFIGS,
  OTEL_ENDPOINTS,
} from "../../contexts/telemetry/infrastructure/otel/settings.js";
import {
  checkInstallationId,
  ensureInstallationId,
  finishInstallationId,
} from "../filesystem/installation-identity.js";
import { userConfigDirOf } from "../user-config-dir.js";

export async function runOtelSession(
  options: Parameters<typeof runOtel>[0] & { includeInstallationId?: boolean }
) {
  const installationId = options.includeInstallationId
    ? await checkInstallationId(userConfigDirOf(process.env, homedir()))
    : undefined;
  if (options.includeInstallationId && !installationId)
    throw new Error("No AIDD installation ID exists. Run framework setup before including it.");
  return runOtel({ ...options, installationId: installationId ?? undefined });
}

export function collectOtel(port: number) {
  return startOtelCollector({ home: homedir(), port });
}

export const otelOptions = {
  configs: OTEL_CONFIGS,
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
