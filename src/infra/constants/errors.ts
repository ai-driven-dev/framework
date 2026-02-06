/**
 * Error message templates reused across validators and commands.
 */
export const ERRORS = {
	NO_WRITE_PERMISSION: (dir: string) =>
		`No write permission for directory: ${dir}`,
	CANNOT_CREATE_DIRECTORY: (dir: string) => `Cannot create directory: ${dir}`,
	REQUIRED_ASSET_NOT_FOUND: (asset: string) =>
		`Required asset not found: ${asset}`,
	FAILED_TO_CREATE_PARENT_DIR: (dir: string, error: string) =>
		`Failed to create parent directory ${dir}: ${error}`,
	FAILED_TO_CREATE_LINK: "Failed to create link",
} as const;
