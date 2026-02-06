/**
 * Rollback data for policies.
 * Extensible so each policy can persist the metadata it needs.
 */
export interface RollbackData {
	target: string;
	wasExisting?: boolean;
	originalContent?: string | null;
	backupPath?: string;
	hadExistingFile?: boolean;
	existed?: boolean;
	previousContent?: string | null;
	[key: string]: unknown;
}
