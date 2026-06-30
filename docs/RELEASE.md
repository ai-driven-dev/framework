# Releasing

The release pipeline is automated. A human (or an AI agent) only triggers the
promotion; everything after that runs itself.

## The flow

```
next  --(promote)-->  main  --(release-please)-->  version PR --(auto-merge)--> tags + GitHub releases
                       |
                       '--(back-merge)--> next   (keeps next in sync)
```

1. **Work lands on `next`** via normal PRs (rebase or squash into `next`, your choice).
2. **Promote `next` to `main`.** Run the **Promote next to main** workflow (Actions tab -> Run workflow). It opens a `next -> main` PR and **rebase-merges** it.
3. **release-please** runs on the push to `main`, opens a version PR (bumps + changelogs), and the CI **auto-merges that version PR** (`--squash --admin`). No human needed.
4. **Tags and GitHub releases** are published per package and for the root.
5. **Back-merge** fires on `release: published` and syncs `main` back into `next` so the changelog and version files do not drift.

## The one rule: promote with REBASE, never squash

`next -> main` carries many conventional commits (`feat(scope):`, `fix(scope):`).
Two things depend on them:

- **commitlint** checks every commit message. A squash collapses them into one
  subject taken from the PR title; if that title is not a valid conventional
  type (e.g. `release:`), commitlint fails on `main` and **release-please is
  skipped** -- no release happens.
- **release-please** reads each commit's type and scope to bump the right plugin
  by the right amount. A squash hides them, so it cannot compute the versions.

So always use the **Promote** workflow (it rebase-merges). If you merge by hand,
use **Rebase and merge**, never **Squash**. The version PR that release-please
opens is its own single commit and is fine to squash -- that one is automated.

## If a release breaks (recovery)

Symptom: after a promote, `main` CI is red on **Commitlint** and **Release
Please** is skipped -- usually a squashed, non-conventional promote commit.

1. An admin temporarily disables the `main protection` ruleset (Settings ->
   Rules), force-pushes `main` back to the commit before the bad merge, then
   re-enables the ruleset.
2. Re-run the **Promote** workflow (rebase). release-please then cuts the
   release normally.

## Pinning a specific version

To force a package to a chosen version on the next cut, set `release-as` for it
in `release-please-config.json` (deterministic, overrides any `Release-As:`
commit footer). Remove the pin afterwards so automatic bumps resume.

## Back-merge and drift

The back-merge runs unattended (the bot app has an `always` bypass on the `next`
ruleset). After each release it either realigns `next` onto `main` (when `next`
holds no unreleased work, the normal case) or keeps a merge (when it does), so
the rebase-promote hash drift never accumulates. If it ever cannot push, it
opens an issue labelled `back-merge-failed`; resync by opening a `main -> next`
PR.
