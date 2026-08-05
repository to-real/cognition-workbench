# Development

## Prerequisites

- Node.js 20 or newer
- npm
- Codex CLI only when testing the installer manually

## Local checks

```bash
npm ci
npm test
npm run install:dry-run
git diff --check
```

Test groups can also be run independently:

```bash
npm run test:unit
npm run test:integration
node --test tests/install.test.mjs
```

## Principles for changes

- Add a failing test before changing production behavior.
- Preserve Markdown as the canonical source unless a documented migration is included.
- Keep external evidence distinct from user judgment.
- Never weaken explicit confirmation for formal writes.
- Avoid hidden network calls, telemetry, or author-specific paths.
- Keep the server compatible with Windows, macOS, and Linux paths.

## Release checklist

1. Update `CHANGELOG.md`, package version, MCP version, and release notes.
2. Run the full test suite and installation dry run.
3. Run dependency and personal-path audits.
4. Verify the staged diff and create a signed or normal annotated release tag through GitHub.
