export interface ExistingConfig {
	claudeCode: boolean;
	cursor: boolean;
	privacyProtection: boolean;
	docsStructure: boolean;
}

export interface ConflictResult {
	hasConflicts: boolean;
	items: string[];
}

export interface ValidationResult {
	isValid: boolean;
	errors: string[];
}

export interface AssetValidation {
	isValid: boolean;
	missingAssets: string[];
}
