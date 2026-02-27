export interface FrameworkResolverOptions {
  repo?: string;
  token?: string;
  localPath?: string;
  tarballPath?: string;
}

export interface FrameworkResolver {
  resolve(options: FrameworkResolverOptions): Promise<string>;
  getLatestVersion(): Promise<string | null>;
}
