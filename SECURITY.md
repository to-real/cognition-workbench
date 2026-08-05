# Security policy

## Supported versions

Security fixes are applied to the latest published release.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting for this repository. Do not open a public issue for a vulnerability that could expose local knowledge, execute unintended commands, bypass write confirmation, or overwrite user files.

Include the affected version, operating system, reproduction steps, impact, and any suggested mitigation. You can expect an initial response within seven days.

## Sensitive data boundary

Cognition Workbench is local-first, but the knowledge directory can contain private material. Before publishing a fork or support bundle:

- exclude `knowledge/`, `inbox/`, `state/`, `.env*`, and logs as appropriate;
- inspect source records for private URLs or copied material;
- never share Codex credentials or environment variables;
- confirm that installer links point only to the intended checkout.
