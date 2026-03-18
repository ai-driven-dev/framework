export interface Git {
  installPreCommitDelegate(projectRoot: string, delegatePath: string): Promise<void>;
}
