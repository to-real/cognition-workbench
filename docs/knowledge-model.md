# Knowledge model

## Three layers

1. **Sources** — articles, reports, datasets, interviews, and other external evidence.
2. **Cognition units** — reusable claims, concepts, examples, frameworks, or disagreements.
3. **Topic overviews** — evolving maps that assemble units and sources around a question.

Project records hold work-specific context. Only knowledge that transfers beyond one project should be promoted into global cognition after review.

## Required frontmatter

Every formal Markdown record starts with YAML frontmatter containing:

- `id`: stable and unique; lowercase letters, digits, and hyphens only.
- `type`: `topic`, `unit`, `source`, or `project`.
- `title`: human-readable title.
- `status`: current cognition state.
- `confidence`: `low`, `medium`, `high`, or `unknown`.
- `categories`: stable top-level navigation categories; multiple values are allowed.
- `tags`: flexible clustering labels.
- `related`: related topic or cognition IDs.
- `sources`: supporting or challenging source IDs.
- `created` and `updated`: dates in `YYYY-MM-DD` format.

## Cognition states

- `exploring`: newly proposed and not sufficiently discussed.
- `tentative`: supported by reasons but still needs validation.
- `stable`: tested across multiple topics or pieces of evidence.
- `disputed`: meaningful internal conflict remains.
- `obsolete`: corrected or expired; retained as history.

Sources may use `active`. Default contextual recall reduces the weight of obsolete cognition and does not use it as guidance.

## Review-before-write

New conclusions are stored as `update_candidate` records with `pending` status. Explicit confirmation converts a candidate into formal knowledge and marks the candidate as `accepted`. Unconfirmed candidates never become formal cognition.
