export interface PolicyOptions {
	mergeStrategy?: "replace" | "merge" | "append";
	preserveTimestamps?: boolean;
	overwrite?: boolean;
	content?: string;
	installDir?: string;
	workingDirectory?: string;
	baseDir?: string;
	mode?: number;
	selectedServers?: string[];
	language?: string;
	templatePath?: string;
	onlyCreateDirs?: string[];
	interactiveMode?: boolean;
	warnOnExistingNonAiddFiles?: boolean;
	startMarker?: string;
	endMarker?: string;
	skipIfExists?: boolean;
	appendNewline?: boolean;
	header?: string;
	customSettings?: Record<string, unknown>;
	includeDirectories?: string[];
	includeFiles?: string[];
	recursive?: boolean;
	userFirst?: boolean;
	arrayUnion?: boolean;
	json?: {
		targetKey?: string;
	};
	backupSuffix?: string;
	createBackup?: boolean;
	suffix?: string;
	glob?: string;
}
