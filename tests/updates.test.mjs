import assert from 'node:assert/strict';
import { access, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  commitUpdateCandidate,
  createUpdateCandidate,
  getDailyTopic,
  saveDailyTopic,
} from '../server/src/updates.mjs';

async function createRoot() {
  const root = await mkdtemp(join(tmpdir(), 'cognition-updates-'));
  for (const directory of ['knowledge/units', 'knowledge/topics', 'knowledge/sources', 'inbox/updates', 'inbox/daily']) {
    await mkdir(join(root, directory), { recursive: true });
  }
  return root;
}

test('candidate creation writes only to the review inbox', async t => {
  const root = await createRoot();
  t.after(() => rm(root, { recursive: true, force: true }));

  const candidate = await createUpdateCandidate(root, {
    targetType: 'unit',
    title: 'AI 产品评估应关注工作流闭环',
    body: '模型能力只是起点，持续使用依赖工作流闭环。',
    status: 'tentative',
    confidence: 'medium',
    tags: ['AI 产品', '评估'],
  });

  assert.match(candidate.path, /inbox[\\/]updates/);
  await access(candidate.path);
  await assert.rejects(access(join(root, 'knowledge', 'units', `${candidate.targetId}.md`)));
});

test('committing a candidate requires explicit confirmation', async t => {
  const root = await createRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  const candidate = await createUpdateCandidate(root, {
    targetType: 'unit',
    title: '组织迁移成本是一种产品壁垒',
    body: '企业工具的替换成本不仅来自数据，也来自组织习惯。',
  });

  await assert.rejects(
    commitUpdateCandidate(root, candidate.candidateId, { confirmation: 'yes' }),
    /CONFIRMED/,
  );

  const committed = await commitUpdateCandidate(root, candidate.candidateId, {
    confirmation: 'CONFIRMED',
  });
  const document = await readFile(committed.path, 'utf8');
  const inboxDocument = await readFile(candidate.path, 'utf8');

  assert.match(document, /组织迁移成本/);
  assert.match(inboxDocument, /accepted/);
});

test('daily topic is saved once per date and can be retrieved', async t => {
  const root = await createRoot();
  t.after(() => rm(root, { recursive: true, force: true }));

  await saveDailyTopic(root, {
    date: '2026-08-05',
    title: '办公软件是否会成为 Agent 的入口',
    rationale: '它连接模型能力、产品交互和企业工作流。',
    angles: ['产品入口', '模型策略', '商业竞争'],
    relatedIds: [],
    sourceIds: [],
  });

  const daily = await getDailyTopic(root, '2026-08-05');
  assert.equal(daily.title, '办公软件是否会成为 Agent 的入口');
  assert.deepEqual(daily.angles, ['产品入口', '模型策略', '商业竞争']);
});

test('revising a stable id archives the previous version before updating it', async t => {
  const root = await createRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  const targetPath = join(root, 'knowledge', 'units', 'unit-existing.md');
  await writeFile(targetPath, `---
id: unit-existing
type: unit
title: 原判断
status: tentative
confidence: medium
categories: []
tags: []
related: []
sources: []
created: 2026-08-01
updated: 2026-08-01
---

模型能力本身是主要壁垒。
`, 'utf8');
  const candidate = await createUpdateCandidate(root, {
    targetType: 'unit',
    targetId: 'unit-existing',
    title: '修订后的判断',
    body: '模型能力之外，数据闭环和工作流同样重要。',
    status: 'tentative',
  });

  await commitUpdateCandidate(root, candidate.candidateId, { confirmation: 'CONFIRMED' });

  const current = await readFile(targetPath, 'utf8');
  const historyDirectory = join(root, 'knowledge', 'history', 'unit-existing');
  const historyFiles = await readdir(historyDirectory);
  const previous = await readFile(join(historyDirectory, historyFiles[0]), 'utf8');
  assert.match(current, /数据闭环和工作流/);
  assert.match(current, /created: 2026-08-01/);
  assert.match(previous, /模型能力本身是主要壁垒/);
});
