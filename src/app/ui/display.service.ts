import type {
	DisplayAdapter,
	VerbosityLevel,
} from "../../domain/policies/installation-policy.js";

type MessageType = "" | "info" | "success" | "warning" | "error" | "progress";

export class DisplayService implements DisplayAdapter {
	constructor(private verbosity: VerbosityLevel = "normal") {}

	show(message: string, type: MessageType = ""): void {
		const prefix =
			{
				"": "",
				info: "ℹ️ ",
				success: "✅ ",
				warning: "⚠️ ",
				error: "❌ ",
				progress: "⏳ ",
			}[type] || "";

		const shouldShow =
			this.verbosity === "verbose" ||
			type === "error" ||
			type === "warning" ||
			type === "success" ||
			type === "";

		if (shouldShow) {
			console.log(`${prefix}${message}`);
		}
	}
}

// Factory function for creating display service instances
export function createDisplayService(
	verbosity: VerbosityLevel = "normal",
): DisplayService {
	return new DisplayService(verbosity);
}
