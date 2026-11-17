/** Paths Kimi Code CLI scans in a project. Its own `.kimi-code/` root, not the shared `.agents/`
 * one Antigravity writes, so the two hosts never own the same file. */

export const KIMI_DIRECTORY = ".kimi-code/";
export const KIMI_SKILLS_DIR = `${KIMI_DIRECTORY}skills/`;
export const KIMI_AGENTS_DIR = `${KIMI_DIRECTORY}agents/`;
