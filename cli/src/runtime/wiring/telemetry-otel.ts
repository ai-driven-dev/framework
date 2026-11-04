import { homedir } from "node:os";
import { initializeOtel } from "../../contexts/telemetry/infrastructure/otel/actions/init.js";
import { runOtelOpenCode } from "../../contexts/telemetry/infrastructure/otel/actions/run.js";
import { verifyOtel } from "../../contexts/telemetry/infrastructure/otel/actions/verify.js";
import {
  OPENCODE_CONFIG_ID,
  OTEL_CONFIGS,
  OTEL_ENDPOINTS,
} from "../../contexts/telemetry/infrastructure/otel/settings.js";
import {
  checkInstallationId,
  ensureInstallationId,
  finishInstallationId,
} from "../filesystem/installation-identity.js";
import { userConfigDirOf } from "../user-config-dir.js";

export const otelOptions = {
  configs: OTEL_CONFIGS,
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
