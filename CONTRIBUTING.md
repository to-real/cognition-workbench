# Contributing

Thanks for helping improve Cognition Workbench.

## Before opening a change

- Search existing issues and discussions.
- Use an issue for behavior changes that affect the knowledge model, confirmation boundary, or storage format.
- Keep pull requests focused on one coherent outcome.

## Development workflow

1. Fork the repository and create a branch from `main`.
2. Install dependencies with `npm ci`.
3. Add or update tests before changing production behavior.
4. Run `npm test`, `npm run install:dry-run`, and `git diff --check`.
5. Describe the user-visible effect, design tradeoffs, and verification in the pull request.

## Project constraints

- Do not commit personal knowledge, inbox candidates, credentials, machine paths, or generated state.
- Preserve the review-before-write rule for formal cognition.
- Keep personal judgment and external evidence distinguishable.
- Prefer local-first, inspectable behavior and document any new network dependency.
- Update both English and Chinese entry documentation when the public workflow changes.

By contributing, you agree that your contribution is licensed under the MIT License.
