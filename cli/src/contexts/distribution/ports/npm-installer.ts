/** Installs an npm package, spec `name@version`, under a prefix directory. Rejects when it cannot. */
export interface NpmInstaller {
  install(spec: string, prefix: string): Promise<void>;
}
