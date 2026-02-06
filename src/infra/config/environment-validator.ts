import { promises as fs, existsSync } from "node:fs";
import type { ValidationResult } from "../../domain/install/config-contracts.js";
import { ERRORS } from "../constants/errors.js";
import { canWriteToDirectory } from "../utils/platform.js";

export class EnvironmentValidator {
	async validateEnvironment(installDir: string): Promise<ValidationResult> {
		const errors: string[] = [];

		if (existsSync(installDir)) {
			const canWrite = await canWriteToDirectory(installDir);
			if (!canWrite) {
				errors.push(ERRORS.NO_WRITE_PERMISSION(installDir));
			}
		} else {
			try {
				await fs.mkdir(installDir, { recursive: true });
				await fs.rmdir(installDir);
			} catch {
				errors.push(ERRORS.CANNOT_CREATE_DIRECTORY(installDir));
			}
		}

		return {
			isValid: errors.length === 0,
			errors,
		};
	}
}
