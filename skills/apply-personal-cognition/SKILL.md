---
name: apply-personal-cognition
description: Proactively retrieve and apply the user's personal cognition when doing AI or product strategy, model evaluation, competitor analysis, product planning, implementation assessment, business judgment, or related writing. Use even when the user does not mention the knowledge base. Do not use for unrelated coding, administration, or casual tasks.
---

# 调用个人认知

Treat the cognition workbench as a personal context layer, not as an authoritative fact database.

## Retrieve before working

1. Summarize the current task into a specific retrieval query.
2. Call `retrieve_context` before substantive work.
3. If no relevant cognition is returned, continue normally without adding a knowledge notice.
4. If relevant cognition is returned, use only the items that materially affect the task.

## Apply with provenance

- Distinguish personal judgment from external fact.
- Respect cognition status: stable, tentative, exploring, disputed, or obsolete.
- Treat obsolete cognition as history, not default guidance.
- Surface a contradiction when current work conflicts with prior cognition.
- Verify time-sensitive external claims separately.
- Add one compact notice such as `本次调用了 3 条个人认知` and make the cited items inspectable.

Do not force an old framework onto a weakly related task. Explain and discard a false association when necessary.

## Offer a safe write-back

After completing the task, identify only durable new judgments, reusable frameworks, meaningful contradictions, or evidence that changes an existing view.

When such content exists:

1. Call `create_update_candidate` to place it in the review inbox.
2. Tell the user what was proposed and why it may be reusable.
3. Keep temporary project details inside the project; promote them to global cognition only when they generalize.
4. Call `confirm_update_candidate` only after explicit user confirmation. Never silently change formal cognition.
