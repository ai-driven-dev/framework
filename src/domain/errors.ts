export class NoFrameworkSourceError extends Error {
  constructor() {
    super(
      "No framework source configured. Use --path for a local framework or --repo owner/repo for a remote one."
    );
    this.name = "NoFrameworkSourceError";
  }
}

export class ConfigConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigConflictError";
  }
}
