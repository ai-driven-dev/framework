# OpenCode review after Alex's GitHub review

## Scope

This is an uncommitted prototype in a detached worktree. The workflow is not deployed.

Every five minutes, discovery runs trusted code from the default branch. It
selects only a current-head review submitted by GitHub user 8973343 after the
explicit activation cutoff. The agent reviews new or changed file diffs using
`05-review`, and publishes a comment. The hidden state in the bot's comment
records fingerprints, so a new review on the same unchanged diff does not
call the model again. Files removed and then reintroduced count as new.

## Constraints and failure behavior

- This prototype reviews same-repository pull requests, not forks. The PR head
  and base must still match before publication.
- Missing or truncated GitHub patches, binary files, lines longer than 1,900
  bytes, a diff above 500 KB, an incomplete skill run, or a missing model key
  fail closed. The workflow posts a single failure comment; a new submitted
  review is required to retry.
- Diffs are split into bounded chunks. A successful report requires evidence
  that every chunk and the PR context were read in full, every required skill
  file was read, and the model returned a structured coverage and verdict.
  This verifies the trace, not the quality of the model's judgment.
- Job inputs are copied into a sanitized snapshot. Shell, file mutation,
  external directories, web tools and code execution are denied. No GitHub
  token is passed to the agent. PR text and code are untrusted data.
- The cron is best effort: GitHub can delay or drop scheduled runs. Only the
  latest qualifying review on the current head is selected. GitHub Actions'
  per-PR concurrency prevents simultaneous processing.
- The trusted `05-review` skill and its expected action/reference files must
  be promoted to the default branch together with the workflow. The workflow
  checks their presence before making a model call.

## Validation

- `node --test scripts/__tests__/opencode-review-{ci,state,discover}.test.js`
  exercises selection, review checkpoints, failures, missing coverage, stale
  heads, partial reads and GitHub discovery.
- `actionlint` validates the workflow syntax.
- The discovery query was compared against paginated GitHub REST data for the
  real framework repository. The GraphQL scan made two calls plus one REST
  fallback, with the same candidate set as the REST-only scan.
- An OpenCode 2.2.2 local run with `05-review` and Mistral Large 4 reviewed a
  known boundary defect and produced a report accepted by the local verifier.
  This used the already configured direct Mistral provider, not OpenCode
  Console; no GitHub review comment was posted. A 77-file PR produced six
  bounded diff chunks in a read-only selection rehearsal.
- OpenCode 2.2.2 also ran `openai/gpt-6.1-terra#medium` using the existing
  local OpenAI OAuth login and the workflow prompt and tool restrictions. It
  loaded `05-review`, identified an age-boundary defect in a synthetic diff,
  and the event verifier accepted its report. This did not test GitHub Actions
  authentication or publish a PR comment.
- In OpenCode 2.2.2, the `tool.use` policy alone did not block Code Mode
  `execute` from fetching a public URL. Adding `permissions: [{action:
  execute, resource: "*", effect: deny}]` removed that tool in a repeat run;
  the workflow applies both restrictions. This is not an OS-level sandbox.

## Activation prerequisites

1. Promote the workflow, scripts and matching skill version to the default
   branch; scheduled workflows run only there.
2. Set repository variable `OPENCODE_REVIEW_ENABLED_AT` to an ISO UTC timestamp
   such as `2026-11-05T00:00:00Z`, chosen at activation. Without it, discovery
   is skipped so existing historical reviews do not trigger an initial batch.
3. Provision and test OpenAI authentication for the GitHub runner. The local
   OpenCode OAuth login is stored on the Mac and is not available on a hosted
   runner; this workflow does not yet provision an OAuth login or an API key.
   An OpenAI API key would use API billing rather than the local ChatGPT login.
4. Submit a test review and verify the scheduled run, skill trace, comment,
   unchanged-file skip and one-time failure behavior before relying on it.
