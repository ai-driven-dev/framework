/**
 * Typed Policy IDs to keep registry references consistent.
 * Only primitive, composable policies are exposed here.
 */
export const POLICY_IDS = {
	MERGE_TEXT: "merge-text",
	MERGE_JSON: "merge-json",
	COPY_HARD: "copy-hard",
	COPY_IF_MISSING: "copy-if-missing",
	COPY_OVERWRITE_WITH_BACKUP: "copy-overwrite-with-backup",
	COPY_WITH_SUFFIX: "copy-with-suffix",
	CREATE_FILE: "create-file",
	MKDIR: "mkdir",
	SYMLINK_ABSOLUTE: "symlink-absolute",
	SYMLINK_RELATIVE: "symlink-relative",
	OVERWRITE_BACKUP: "overwrite-backup",
	RUN_PACKAGE_INSTALL: "run-package-install",
} as const;

export type PolicyId = (typeof POLICY_IDS)[keyof typeof POLICY_IDS];
