export interface FrameworkResolverOptions {
  localPath?: string;
  tarballPath?: string;
  repo?: string;
  token?: string;
}

export type FrameworkSource = "local" | "cache" | "download";

export interface FrameworkResolved {
  path: string;
  version: string;
  source: FrameworkSource;
}

export interface FrameworkResolver {
  resolve(options: FrameworkResolverOptions): Promise<FrameworkResolved>;
}
