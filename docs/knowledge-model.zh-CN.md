# 知识模型

## 三层结构

1. 外部材料：文章、报告、数据、访谈等证据。
2. 分布式认知单元：可复用的观点、概念、案例、框架或争议。
3. 议题总览：动态聚合认知单元和材料的完整入口。

项目空间保存具体工作的临时资料。只有能跨项目复用的内容，才经确认提升到全局认知。

## 正式记录字段

每个 Markdown 文件以 YAML frontmatter 开头，至少包含：

- `id`：稳定、唯一、仅使用小写字母、数字和连字符。
- `type`：`topic`、`unit`、`source` 或 `project`。
- `title`：人类可读标题。
- `status`：认知状态。
- `confidence`：`low`、`medium`、`high` 或 `unknown`。
- `categories`：稳定顶层类别，可多选。
- `tags`：动态聚类标签。
- `related`：相关认知或议题 ID。
- `sources`：证据材料 ID。
- `created` 与 `updated`：`YYYY-MM-DD`。

## 认知状态

- `exploring`：刚提出，尚未充分讨论。
- `tentative`：已有理由，仍需验证。
- `stable`：经过多个议题或证据检验。
- `disputed`：内部存在明显冲突。
- `obsolete`：已修正或失效，只保留历史。

外部材料可使用 `active` 表示当前有效。检索默认降低 `obsolete` 权重，自动调用时不把它作为默认指导。

## 审核写入

新内容先保存为 `update_candidate`，状态为 `pending`。确认后转为正式记录，并把候选状态改为 `accepted`。未经确认的候选永远不属于正式认知。
