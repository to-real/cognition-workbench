# 认知工作台

[English](README.md) · [产品说明](docs/product.zh-CN.md) · [使用说明](docs/usage.zh-CN.md) · [参与贡献](CONTRIBUTING.md)

认知工作台是一个面向 Codex 的本地优先认知系统：通过引导式讨论形成判断，把判断与证据沉淀为可演化知识，并在之后的 AI、产品与策略工作中主动调用。

它不是资讯收藏夹。它重点保存的是：一个判断如何形成、依据是什么、确信度有多高、哪些反证仍未解决，以及它后来如何被验证或修正。

## 三个核心工作流

- **认知讨论台**：每轮推进一个分支、提出一个问题，帮助使用者形成而不是接收结论。
- **调用个人认知**：在相关工作中检索旧认知，并区分个人判断与外部事实。
- **每日一题**：每天提出一个高价值候选议题，是否启动由使用者决定。

正式知识保存在本地 Markdown 中。新观点先进入审核候选区，只有明确确认后才写入知识库。

## 快速开始

需要 Node.js 20 或更高版本、Codex 和 Git。

```bash
git clone https://github.com/to-real/cognition-workbench.git
cd cognition-workbench
npm ci
npm run install:dry-run
npm run install:codex
```

安装后重启 Codex。安装器会连接三个 Skill 并注册本地 MCP 服务；所有路径都从当前项目位置推导，不包含作者的机器路径，也不会覆盖无关文件。

可以直接输入：

```text
我们讨论一下 AI Agent 会不会替代传统企业软件。
今日一题。
帮我评估这款 AI 办公产品是否有长期壁垒。
调用我以前关于企业软件迁移成本的判断。
```

## 核心闭环

提出议题 → 引导式讨论 → 形成暂定判断 → 候选审核 → 正式沉淀 → 跨任务调用 → 验证或修正。

## 目录

- `knowledge/`：使用者自己的正式议题、认知单元、外部材料和项目记录。
- `inbox/`：等待确认的更新和每日议题，不进入 Git。
- `skills/`：讨论、跨任务调用和每日推荐工作流。
- `server/`：向 Codex 暴露知识检索与审核工具的本地 MCP 服务。
- `templates/`：可以直接复制修改的知识模板。
- `examples/`：与正式知识库隔离的非个性化示例。
- `state/`：可重建的派生状态，不是真实知识来源。

## 当前边界

第一版采用关键词、中文片段、状态权重和关系扩展检索，尚未加入向量嵌入、独立界面和大规模批量导入。只有真实使用证明必要时，才增加这些复杂度。

进一步阅读：[产品说明](docs/product.zh-CN.md)、[知识模型](docs/knowledge-model.zh-CN.md)、[使用说明](docs/usage.zh-CN.md)、[系统架构](docs/architecture.md)。

## 验证与许可证

运行 `npm test` 可以验证核心行为。项目采用 [MIT License](LICENSE)。
