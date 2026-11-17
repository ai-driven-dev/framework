import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.js";

/** The registered profiles, as the contract answers them: what a test hands the code that asks a
 * tool what it declares. */
export const claude = registeredTools().aiProfile(TOOL.claude);
export const codex = registeredTools().aiProfile(TOOL.codex);
export const copilot = registeredTools().aiProfile(TOOL.copilot);
export const cursor = registeredTools().aiProfile(TOOL.cursor);
export const kilo = registeredTools().aiProfile(TOOL.kilo);
export const opencode = registeredTools().aiProfile(TOOL.opencode);
export const antigravity = registeredTools().aiProfile(TOOL.antigravity);
export const vscode = registeredTools().ideProfile(TOOL.vscode);
