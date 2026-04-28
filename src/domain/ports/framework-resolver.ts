export interface FrameworkResolverOptions {
  localPath?: string;
  tarballPath?: string;
  repo?: string;
  token?: string;
  version?: string;
}

export type FrameworkSource = "local" | "cache" | "download" | "git";

export interface FrameworkResolved {
  path: string;
  version: string;
  source: FrameworkSource;
}

export interface FrameworkResolver {
  resolve(options: FrameworkResolverOptions): Promise<FrameworkResolved>;
  fetchLatestVersion(repo?: string): Promise<string>;
  getDefaultRepo(): string | undefined;
}
