# Usage

## Start a discussion

State a topic directly. The discussion skill retrieves related cognition, offers one compact frame, and asks exactly one question per turn. When the discussion closes, it proposes review candidates rather than writing formal knowledge automatically.

Example:

> Let's discuss the competition between Lark, DingTalk, and WeCom as AI work interfaces.

## Recall cognition in other work

Describe the work normally. For relevant AI, product, strategy, competition, or implementation tasks, the recall skill queries the knowledge base and labels returned judgments by status and confidence.

You can also request recall explicitly:

> Use my prior judgments about workflow switching costs to analyze this product.

## Get a daily topic

Ask for today's topic. The workflow returns the one saved candidate for that date or researches and saves a new one. It never begins the full discussion without confirmation.

## Confirm a write

Review a candidate's title, body, status, confidence, categories, tags, relationships, and sources. The system writes it into `knowledge/` only after explicit confirmation.

## Review older cognition

Ask the system to find cognition that may be stale, obsolete, or contradictory. A short review can retain, revise, split, merge, or retire a judgment. Previous versions are archived rather than silently deleted.
