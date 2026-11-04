import { homedir } from "node:os";
import {
  initializeOtel,
  OPENCODE_CONFIG_ID,
  OTEL_CONFIGS,
  OTEL_ENDPOINTS,
  runOtelOpenCode,
} from "../../contexts/telemetry/infrastructure/otel/init-otel.js";

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
