# AIDD OpenCode image

Build the image from this directory:

```sh
docker build -t aidd-opencode:local docker/aidd-opencode
```

It contains OpenCode, Git, Bash, and the translated AIDD agents and skills from
the framework commit pinned in the Dockerfile. Project skills take precedence.
Hooks, MCP servers, credentials, and project toolchains are not included.

For a local review with an OpenAI API key, from a Git working directory:

```sh
docker run --rm -e OPENAI_API_KEY -v "$PWD:/work:ro" -w /work \
  --entrypoint sh aidd-opencode:local -c '
    exec opencode --standalone run --auto --model openai/gpt-6.1-terra#medium \
      "$(cat /opt/aidd/review-prompt.txt)

Review the current uncommitted diff."
  '
```

The read-only mount protects the checkout; do not provide a GitHub write token to
the reviewer. Model credentials remain accessible to the process inside the
container. GitHub triggers, publication, and review state are not included.

The repository's `/opencode` workflow uses the same image with a writable
checkout. Project skills come from the trusted default branch and take precedence
over those bundled in the image. The workflow disables project configuration and
instructions from the branch being changed, so a pull request cannot redirect
the provider or load executable plugins. Project symlinks are checked out as
plain text during the session to prevent access outside the workspace; their
Git modes remain unchanged.
