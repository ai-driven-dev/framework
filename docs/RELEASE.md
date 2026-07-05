# Releasing

The release pipeline is automated. A human (or an AI agent) only triggers the promotion step; everything after that runs itself.

## The flow

```
next  --(promote)-->  main  --(release-please)-->  version PR --(auto-merge)--> tags + GitHub releases
                       |
                       '--(back-merge)--> next   (keeps next in sync)
```

1. **Work lands on `next`** via normal PRs (rebase or squash into `next`, your choice).
2. **Promote `next` to `main`.** Run the **Promote next to main** workflow (Actions tab -> Run workflow). It opens a `next -> main` PR and **rebase-merges** it.
3. **release-please** runs on the push to `main`, opens a version PR (bumps + changelogs). CI **auto-merges that version PR** (`--squash --admin`). No human needed.
4. **Tags and GitHub releases** are published, per package and for the root.
5. **Back-merge** fires on `release: published` and syncs `main` back into `next`, so the changelog and version files do not drift.

## The one rule: promote with REBASE, never squash

`next -> main` carries many conventional commits (`feat(scope):`, `fix(scope):`). Always promote by **rebase**, never squash. Why:

- **commitlint** checks every individual commit message on `main`. A squash collapses all of them into one subject taken from the PR title. If that title isn't a valid conventional type (e.g. `release:`), commitlint fails on `main` and **release-please gets skipped**: no release happens.
- **release-please** reads each commit's type and scope to bump the right plugin by the right amount. A squash hides those individual commits, so it can't compute versions.

In practice:

- Always use the **Promote** workflow: it rebase-merges automatically.
- If you ever merge the promotion PR by hand, pick **Rebase and merge**, never **Squash**.
- The version PR that release-please opens later is different: it's already a single commit, generated automatically, and is fine to squash.

## If a release breaks (recovery)

Symptom: after a promote, `main` CI is red on **Commitlint** and **Release Please** is skipped. This is usually a squashed, non-conventional promote commit.

1. An admin temporarily disables the `main protection` ruleset (Settings -> Rules), force-pushes `main` back to the commit before the bad merge, then re-enables the ruleset.
2. Re-run the **Promote** workflow (rebase). release-please then cuts the release normally.

## Pinning a specific version

To force a package to a chosen version on the next cut, set `release-as` for it in `release-please-config.json` (deterministic, overrides any `Release-As:` commit footer). Remove the pin afterwards so automatic bumps resume.

## Back-merge and drift

The back-merge runs unattended (the bot app has an `always` bypass on the `next` ruleset). After each release it either:

- realigns `next` onto `main`, when `next` holds no unreleased work (the normal case), or
- keeps a merge commit, when `next` does hold unreleased work,

so rebase-promote hash drift never accumulates. If the back-merge ever can't push, it opens an issue labelled `back-merge-failed`; resync by opening a `main -> next` PR by hand. If `next` is missing entirely (it must not be: head branches are not auto-deleted), recreate it from `main` first: `git push origin main:next`.
