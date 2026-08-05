---
name: recommend-daily-topic
description: Select and propose exactly one high-value daily topic at the intersection of AI and product, using current developments, durable learning value, and gaps or conflicts in the user's cognition. Use for daily recommendations, today's topic, scheduled topic discovery, or when the user asks what is worth discussing now. Do not start the discussion without confirmation.
---

# 每日一题

Recommend exactly one candidate topic for the current date.

## Check existing state

1. Call `get_daily_topic` first. If today's topic already exists, return it without replacing it.
2. Call `knowledge_status` and `search_knowledge` to identify existing interests, stale judgments, contradictions, and missing branches.

## Select the topic

Use this priority:

1. A current event that genuinely changes a model, product, business, or implementation judgment.
2. A durable AI × product question with strong transfer value.
3. A review topic prompted by stale, disputed, or contradictory prior cognition.

Research current candidates with fresh sources. Prefer primary and official sources, then high-quality reporting. Reject a topic that is merely popular, repeats an existing discussion, lacks a real tension, or cannot connect to product practice.

Assess candidates by relevance, judgment-changing potential, genuine disagreement, cross-domain connection, and practical transfer value. Choose one; do not present a menu.

## Save and present

Call `save_daily_topic` with:

- A question-shaped title.
- A concise reason it matters now.
- Three to five discussion angles.
- Related cognition IDs when available.
- Source IDs when the materials already exist in the knowledge base.

Present the saved candidate with its value, starting angles, prior-cognition connection, and key sources. Ask whether the user wants to start. Do not automatically invoke the full discussion.
