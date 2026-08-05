import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { KnowledgeStore } from '../server/src/store.mjs';

async function createStoreFixture() {
  const root = await mkdtemp(join(tmpdir(), 'cognition-workbench-'));
  for (const directory of ['topics', 'units', 'sources', 'projects']) {
    await mkdir(join(root, 'knowledge', directory), { recursive: true });
  }

  const write = async (directory, filename, frontmatter, body) => {
    const metadata = Object.entries(frontmatter)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join('\n');
    await writeFile(
      join(root, 'knowledge', directory, filename),
      `---\n${metadata}\n---\n\n${body}\n`,
      'utf8',
    );
  };

  await write('units', 'unit-ai-moat.md', {
    id: 'unit-ai-moat',
    type: 'unit',
    title: 'AI 产品的长期壁垒',
    status: 'stable',
    confidence: 'high',
    categories: ['AI 技术', '产品设计'],
    tags: ['模型', '数据闭环', '工作流'],
    related: ['topic-office-ai'],
    sources: ['source-cost-report'],
    updated: '2026-08-05',
  }, '通用模型能力逐渐商品化后，产品壁垒更多来自数据闭环和工作流整合。');

  await write('units', 'unit-old-model.md', {
    id: 'unit-old-model',
    type: 'unit',
    title: '旧模型能力判断',
    status: 'obsolete',
    confidence: 'low',
    categories: ['AI 技术'],
    tags: ['模型', '产品壁垒'],
    related: [],
    sources: [],
    updated: '2024-01-01',
  }, '模型本身将长期构成所有 AI 产品唯一的竞争壁垒。');

  await write('topics', 'topic-office-ai.md', {
    id: 'topic-office-ai',
    type: 'topic',
    title: '办公软件的 AI 入口竞争',
    status: 'tentative',
    confidence: 'medium',
    categories: ['产品设计', '商业竞争'],
    tags: ['飞书', '钉钉', '企业微信'],
    related: ['unit-ai-moat'],
    sources: ['source-cost-report'],
    updated: '2026-08-05',
  }, '办公软件竞争正在从协同功能转向组织工作流中的 AI 入口。');

  await write('sources', 'source-cost-report.md', {
    id: 'source-cost-report',
    type: 'source',
    title: '模型调用成本资料',
    status: 'active',
    source_kind: 'report',
    published: '2026-08-01',
    tags: ['模型成本'],
    related: ['unit-ai-moat', 'topic-office-ai'],
  }, '该资料记录模型调用成本与企业产品接入方式。');

  return root;
}

test('search ranks relevant current cognition ahead of obsolete cognition', async t => {
  const root = await createStoreFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new KnowledgeStore(root);

  const results = await store.search('AI 办公产品的长期壁垒和工作流');

  assert.equal(results[0].id, 'unit-ai-moat');
  assert.equal(results[0].status, 'stable');
  assert.ok(results.findIndex(item => item.id === 'unit-old-model') > 0);
});

test('related retrieval expands explicit links without losing provenance', async t => {
  const root = await createStoreFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new KnowledgeStore(root);

  const related = await store.getRelated('unit-ai-moat');

  assert.deepEqual(
    new Set(related.map(item => item.id)),
    new Set(['topic-office-ai', 'source-cost-report']),
  );
  assert.ok(related.every(item => item.path.endsWith('.md')));
});

test('context output labels personal judgment status and evidence separately', async t => {
  const root = await createStoreFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new KnowledgeStore(root);

  const context = await store.buildContext('评估一款新的 AI 办公产品');

  assert.match(context.notice, /个人认知/);
  assert.match(context.text, /暂定|稳定/);
  assert.match(context.text, /外部材料/);
  assert.doesNotMatch(context.text, /唯一的竞争壁垒/);
});
