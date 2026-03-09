---
id: 020
milestone: M2
title: "Implement HttpClient and TarExtractor infrastructure"
stories: [US-001]
points: 5
blockedBy: [016]
---

# 020: Implement HttpClient and TarExtractor infrastructure

## Context
The CLI needs to download framework tarballs from GitHub Releases and extract them. ADR-005 mandates `node:https` for HTTP. ADR-004 mandates `child_process` + system `tar` for extraction. These are internal infrastructure components used by FrameworkResolverAdapter.

## Scope
Implement HttpClient (GET with redirect following, auth header) and TarExtractor (`tar xzf` with single-directory nesting detection).

## Acceptance Criteria
- [ ] `HttpClient.get(url, options?)` performs HTTPS GET with optional auth header
- [ ] HttpClient follows one 302 redirect (GitHub download URLs redirect to CDN)
- [ ] HttpClient returns the response body as a Buffer for binary content
- [ ] HttpClient returns JSON-parsed body for JSON responses
- [ ] HttpClient rejects with clear error on 401/403 (auth failure), 404 (not found), network error
- [ ] `TarExtractor.extract(tarballPath, targetDir)` runs `tar xzf` via child_process
- [ ] TarExtractor detects single-directory nesting (e.g., `org-repo-sha/`) and returns the inner directory path
- [ ] TarExtractor returns the framework root directory path (where `framework.json` is found)
- [ ] TarExtractor fails with clear error if tarball is invalid
- [ ] Both components have integration tests (HttpClient can be tested with a mock server or skipped in CI; TarExtractor with actual tar operations on temp dirs)

## Technical Notes
- ADR-005: `node:https` with manual redirect following. GitHub returns 302 for asset downloads.
- ADR-004: `tar xzf` via `node:child_process`. Basic flags only. Nesting detection done in Node.js (readdir + check for single directory).
- GitHub Releases API: `GET /repos/{owner}/{repo}/releases/latest` returns JSON. Asset download returns binary stream.
- Auth header format: `Authorization: Bearer <token>` or `Authorization: token <token>`.

## Files to Create/Modify
- `src/infrastructure/http/http-client.ts` -- HTTPS client with redirect following
- `src/infrastructure/tar/tar-extractor.ts` -- tar extraction with nesting detection
- `tests/infrastructure/http/http-client.test.ts` -- HTTP client tests
- `tests/infrastructure/tar/tar-extractor.test.ts` -- tar extractor tests (uses temp dirs)

## Tests
- HttpClient GET returns response body
- HttpClient follows redirect
- HttpClient sends auth header when provided
- HttpClient rejects on 401/403/404
- TarExtractor extracts tarball to target directory
- TarExtractor detects single-directory nesting
- TarExtractor returns correct framework root path
- TarExtractor fails on invalid tarball

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
