import { homedir } from "node:os";
import { initializeOtel } from "../../contexts/telemetry/infrastructure/otel/actions/init.js";
import { runOtelOpenCode } from "../../contexts/telemetry/infrastructure/otel/actions/run.js";
import { verifyOtel } from "../../contexts/telemetry/infrastructure/otel/actions/verify.js";
import {
  OPENCODE_CONFIG_ID,
  OTEL_CONFIGS,
  OTEL_ENDPOINTS,
} from "../../contexts/telemetry/infrastructure/otel/settings.js";

export const otelOptions = {
  configs: OTEL_CONFIGS,
  endpoints: OTEL_ENDPOINTS,
  launchConfigs: [OPENCODE_CONFIG_ID],
};

export function configureOtel(
  config: (typeof OTEL_CONFIGS)[number],
  endpoint: (typeof OTEL_ENDPOINTS)[number]
) {
  return initializeOtel(config, endpoint, { home: homedir(), env: process.env });
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
