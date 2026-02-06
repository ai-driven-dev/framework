import type { DisplayAdapter } from "../../domain/policies/installation-policy.js";
import { InstallationOrchestrator } from "./installation-orchestrator.js";

/**
 * Factory for creating a fully wired InstallationOrchestrator.
 * Keeps app-layer orchestration in one place.
 */
export function createInstaller(
	display: DisplayAdapter,
): InstallationOrchestrator {
	return new InstallationOrchestrator(display);
}
