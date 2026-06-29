# 02 - Publish

Create the project's remote repository on the resolved host and push to it. Outward-facing; runs after `01-init`.

## Input

- `cwd` (optional): the initialized local repository. Defaults to the current directory.
- `non_interactive` (optional, default `false`): skip the confirmation prompt for scaffolder or auto runs.

## Output

A report of the created remote URL, the resolved provider, and the pushed default branch.

## Process

1. **Resolve.** Resolve the host and how to reach it.
2. **Confirm.** Unless `non_interactive`, confirm before creating the remote. The remote may be public, so create it private by default.
3. **Create.** Create the remote repository and push through the resolved host tooling. `01-init` already left a pushable `HEAD`. If no host tooling is available, stop and report.
4. **Return.** Report the remote URL to the user.

## Test

- The action prints a non-empty remote URL.
- `git -C <cwd> remote get-url origin` resolves to that URL.
