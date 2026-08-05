import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { KnowledgeStore } from './store.mjs';
import {
  commitUpdateCandidate,
  createUpdateCandidate,
  getDailyTopic,
  saveDailyTopic,
} from './updates.mjs';

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(process.env.COGNITION_WORKBENCH_HOME || resolve(moduleDirectory, '..', '..'));
const store = new KnowledgeStore(root);

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
const WRITE_CANDIDATE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

function result(data, summary) {
  return {
    content: [{ type: 'text', text: summary ?? JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

async function countPendingUpdates() {
  try {
    const directory = resolve(root, 'inbox', 'updates');
    const entries = await readdir(directory);
    let count = 0;
    for (const name of entries.filter(entry => entry.endsWith('.md'))) {
      const text = await readFile(resolve(directory, name), 'utf8');
      if (/^status:\s*pending\s*$/m.test(text)) count += 1;
    }
    return count;
  } catch (error) {
    if (error.code === 'ENOENT') return 0;
    throw error;
  }
}

const server = new McpServer({ name: 'cognition-workbench', version: '0.1.0' });

server.registerTool('knowledge_status', {
  title: '认知库状态',
  description: '查看个人认知库中的议题、认知单元、外部材料、项目空间和待审核候选数量。',
  inputSchema: {},
  annotations: READ_ONLY,
}, async () => {
  const documents = await store.load();
  const counts = { topic: 0, unit: 0, source: 0, project: 0 };
  const statuses = {};
  for (const document of documents) {
    counts[document.type] = (counts[document.type] ?? 0) + 1;
    statuses[document.status] = (statuses[document.status] ?? 0) + 1;
  }
  const data = {
    root,
    counts,
    statuses,
    pendingUpdates: await countPendingUpdates(),
    todayTopic: await getDailyTopic(root),
  };
  return result(data, `认知库包含 ${documents.length} 条正式记录，待审核候选 ${data.pendingUpdates} 条。`);
});

server.registerTool('retrieve_context', {
  title: '调用个人认知',
  description: '根据当前工作任务，检索并组织少量相关个人认知与外部材料。用于在 AI、产品、商业竞争或落地评估任务中无提示词接入知识库。',
  inputSchema: {
    task: z.string().min(2).describe('当前要完成的工作或要判断的问题'),
    limit: z.number().int().min(1).max(10).optional(),
  },
  annotations: READ_ONLY,
}, async ({ task, limit }) => {
  const data = await store.buildContext(task, { limit });
  return result(data, `${data.notice}\n\n${data.text}`);
});

server.registerTool('search_knowledge', {
  title: '检索认知库',
  description: '按关键词、中文语义片段、标签、类别和认知状态检索议题、认知单元与来源。',
  inputSchema: {
    query: z.string().min(1),
    limit: z.number().int().min(1).max(20).optional(),
    includeObsolete: z.boolean().optional(),
    types: z.array(z.enum(['topic', 'unit', 'source', 'project'])).optional(),
  },
  annotations: READ_ONLY,
}, async ({ query, limit, includeObsolete, types }) => {
  const results = await store.search(query, { limit, includeObsolete, types });
  return result({ query, results }, `找到 ${results.length} 条相关记录。`);
});

server.registerTool('get_knowledge_item', {
  title: '读取认知记录',
  description: '按稳定 ID 读取一条完整的议题、认知单元、外部材料或项目记录。',
  inputSchema: { id: z.string().min(3) },
  annotations: READ_ONLY,
}, async ({ id }) => {
  const item = await store.getById(id);
  return result({ item }, item ? `已读取：${item.title}` : `没有找到 ID 为 ${id} 的记录。`);
});

server.registerTool('get_related_knowledge', {
  title: '展开认知关系',
  description: '沿显式关系查找支持材料、相关议题和可复用认知单元。',
  inputSchema: {
    id: z.string().min(3),
    limit: z.number().int().min(1).max(30).optional(),
  },
  annotations: READ_ONLY,
}, async ({ id, limit }) => {
  const related = await store.getRelated(id, { limit });
  return result({ id, related }, `找到 ${related.length} 条关联记录。`);
});

server.registerTool('create_update_candidate', {
  title: '创建认知更新候选',
  description: '把讨论或工作中新形成的观点写入待审核区，不会直接修改正式认知库。',
  inputSchema: {
    targetType: z.enum(['unit', 'topic', 'source']).default('unit'),
    targetId: z.string().regex(/^[a-z0-9][a-z0-9-]{2,127}$/).optional(),
    title: z.string().min(2),
    body: z.string().min(2),
    status: z.enum(['exploring', 'tentative', 'stable', 'disputed', 'obsolete']).optional(),
    confidence: z.enum(['low', 'medium', 'high', 'unknown']).optional(),
    categories: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    related: z.array(z.string()).optional(),
    sources: z.array(z.string()).optional(),
  },
  annotations: WRITE_CANDIDATE,
}, async input => {
  const candidate = await createUpdateCandidate(root, input);
  return result(candidate, `已创建待审核候选 ${candidate.candidateId}；尚未写入正式认知库。`);
});

server.registerTool('confirm_update_candidate', {
  title: '确认认知更新',
  description: '仅在用户明确确认某个待审核候选后，将其写入正式认知库。confirmation 必须是 CONFIRMED。',
  inputSchema: {
    candidateId: z.string().regex(/^update-\d{14}-[a-f0-9]{10}$/),
    confirmation: z.literal('CONFIRMED'),
  },
  annotations: WRITE_CANDIDATE,
}, async ({ candidateId, confirmation }) => {
  const committed = await commitUpdateCandidate(root, candidateId, { confirmation });
  return result(committed, `已确认并写入正式认知库：${committed.targetId}`);
});

server.registerTool('save_daily_topic', {
  title: '保存每日议题',
  description: '保存每天唯一的高价值候选议题；只进入候选区，不会自动启动讨论。',
  inputSchema: {
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    title: z.string().min(2),
    rationale: z.string().min(2),
    angles: z.array(z.string()).min(1),
    relatedIds: z.array(z.string()).optional(),
    sourceIds: z.array(z.string()).optional(),
  },
  annotations: WRITE_CANDIDATE,
}, async input => {
  const daily = await saveDailyTopic(root, input);
  return result(daily, `已保存 ${daily.date} 的每日议题：${daily.title}`);
});

server.registerTool('get_daily_topic', {
  title: '读取每日议题',
  description: '读取指定日期或今天的高价值候选议题。',
  inputSchema: { date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() },
  annotations: READ_ONLY,
}, async ({ date }) => {
  const daily = await getDailyTopic(root, date);
  return result({ daily }, daily ? `今日议题：${daily.title}` : '该日期还没有候选议题。');
});

const transport = new StdioServerTransport();
await server.connect(transport);

process.on('SIGINT', async () => {
  await server.close();
  process.exit(0);
});
