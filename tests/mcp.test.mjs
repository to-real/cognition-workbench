import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const serverPath = join(testDirectory, '..', 'server', 'src', 'server.mjs');

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), 'cognition-mcp-'));
  for (const directory of ['knowledge/units', 'knowledge/topics', 'knowledge/sources', 'knowledge/projects', 'inbox/updates', 'inbox/daily']) {
    await mkdir(join(root, directory), { recursive: true });
  }
  await writeFile(join(root, 'knowledge', 'units', 'unit-product-eval.md'), `---
id: unit-product-eval
type: unit
title: AI 产品评估需要关注工作流闭环
status: stable
confidence: high
categories: [产品设计]
tags: [AI 产品, 工作流, 评估]
related: []
sources: []
updated: 2026-08-05
---

评估 AI 产品时，不能只看单次模型能力，还要观察工作流是否形成持续价值。
`, 'utf8');
  return root;
}

async function connect(root) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    env: { ...process.env, COGNITION_WORKBENCH_HOME: root },
    stderr: 'pipe',
  });
  const client = new Client({ name: 'cognition-workbench-test', version: '0.1.0' });
  await client.connect(transport);
  return client;
}

test('MCP server exposes the cognition workflow tools', async t => {
  const root = await createFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const client = await connect(root);
  t.after(() => client.close());

  const tools = await client.listTools();
  const names = new Set(tools.tools.map(tool => tool.name));

  for (const expected of [
    'knowledge_status',
    'retrieve_context',
    'search_knowledge',
    'get_knowledge_item',
    'get_related_knowledge',
    'create_update_candidate',
    'confirm_update_candidate',
    'save_daily_topic',
    'get_daily_topic',
  ]) {
    assert.ok(names.has(expected), `missing MCP tool: ${expected}`);
  }
});

test('retrieve_context returns relevant personal cognition with a visible notice', async t => {
  const root = await createFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const client = await connect(root);
  t.after(() => client.close());

  const result = await client.callTool({
    name: 'retrieve_context',
    arguments: { task: '帮我评估一个新的 AI 工作流产品' },
  });

  assert.match(result.structuredContent.notice, /个人认知/);
  assert.equal(result.structuredContent.personal[0].id, 'unit-product-eval');
});

test('knowledge status counts only pending review candidates', async t => {
  const root = await createFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const client = await connect(root);
  t.after(() => client.close());

  const candidateResult = await client.callTool({
    name: 'create_update_candidate',
    arguments: {
      targetType: 'unit',
      title: '工作流闭环形成持续价值',
      body: '产品需要在持续工作流中产生可重复价值。',
    },
  });
  const before = await client.callTool({ name: 'knowledge_status', arguments: {} });
  assert.equal(before.structuredContent.pendingUpdates, 1);

  await client.callTool({
    name: 'confirm_update_candidate',
    arguments: {
      candidateId: candidateResult.structuredContent.candidateId,
      confirmation: 'CONFIRMED',
    },
  });
  const after = await client.callTool({ name: 'knowledge_status', arguments: {} });
  assert.equal(after.structuredContent.pendingUpdates, 0);
});
