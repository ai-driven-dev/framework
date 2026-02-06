import { homedir } from "node:os";
import { join } from "node:path";
import { PATHS } from "../constants/paths.js";

const AIDD_GLOBAL_DIR_NAME = PATHS.AIDD_GLOBAL_DIR;
const AIDD_GLOBAL_DIR_TILDE = `~/${AIDD_GLOBAL_DIR_NAME}`;

function resolveHomeDir(): string {
	return process.env.HOME || homedir();
}

function getGlobalAiddDir(): string {
	return join(resolveHomeDir(), AIDD_GLOBAL_DIR_NAME);
}

function getGlobalAiddPath(...segments: string[]): string {
	return join(getGlobalAiddDir(), ...segments);
}

function getGlobalAiddTildePath(...segments: string[]): string {
	return [AIDD_GLOBAL_DIR_TILDE, ...segments].join("/");
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export {
	AIDD_GLOBAL_DIR_NAME,
	AIDD_GLOBAL_DIR_TILDE,
	resolveHomeDir,
	getGlobalAiddDir,
	getGlobalAiddPath,
	getGlobalAiddTildePath,
	escapeRegex,
};
