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

export class UpdateError extends Error {
  constructor() {
    super(
      "Update failed. If you saw a 403 error above, ensure your GitHub token includes both repo and read:packages scopes.\n" +
        "Update your token at https://github.com/settings/tokens, then re-run `aidd auth login`."
    );
    this.name = "UpdateError";
  }
}
