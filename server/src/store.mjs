import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import YAML from 'yaml';

const KNOWLEDGE_DIRECTORIES = ['topics', 'units', 'sources', 'projects'];
const STATUS_WEIGHT = {
  stable: 1.25,
  tentative: 1,
  exploring: 0.9,
  disputed: 0.75,
  obsolete: 0.2,
  active: 1,
};
const STATUS_LABEL = {
  stable: '相对稳定',
  tentative: '暂定判断',
  exploring: '探索中',
  disputed: '存在争议',
  obsolete: '已修正或失效',
  active: '有效材料',
};

function asArray(value) {
  if (Array.isArray(value)) return value.map(String);
  if (value === undefined || value === null || value === '') return [];
  return [String(value)];
}

function parseMarkdownDocument(text, path, root) {
  const match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n)?([\s\S]*)$/);
  if (!match) return null;
  const metadata = YAML.parse(match[1]) ?? {};
  if (!metadata.id || !metadata.type || !metadata.title) return null;
  return {
    ...metadata,
    id: String(metadata.id),
    type: String(metadata.type),
    title: String(metadata.title),
    status: String(metadata.status ?? 'exploring'),
    confidence: String(metadata.confidence ?? 'unknown'),
    categories: asArray(metadata.categories),
    tags: asArray(metadata.tags),
    related: asArray(metadata.related),
    sources: asArray(metadata.sources),
    body: match[2].trim(),
    path,
    relativePath: relative(root, path),
  };
}

function tokenize(value) {
  const normalized = String(value ?? '').normalize('NFKC').toLowerCase();
  const tokens = new Set();
  for (const match of normalized.matchAll(/[a-z0-9][a-z0-9_-]*/g)) {
    tokens.add(match[0]);
  }
  for (const match of normalized.matchAll(/[\p{Script=Han}]+/gu)) {
    const text = match[0];
    if (text.length === 1) tokens.add(text);
    for (let index = 0; index < text.length - 1; index += 1) {
      tokens.add(text.slice(index, index + 2));
    }
  }
  return tokens;
}

function overlapScore(queryTokens, value, weight) {
  const valueTokens = tokenize(value);
  let score = 0;
  for (const token of queryTokens) {
    if (valueTokens.has(token)) score += weight;
  }
  return score;
}

function scoreDocument(query, document) {
  const queryTokens = tokenize(query);
  if (queryTokens.size === 0) return 0;
  let score = overlapScore(queryTokens, document.title, 6);
  score += overlapScore(queryTokens, document.tags.join(' '), 5);
  score += overlapScore(queryTokens, document.categories.join(' '), 3);
  score += overlapScore(queryTokens, document.body, 1);
  const compactQuery = String(query).replace(/\s+/g, '').toLowerCase();
  const compactDocument = `${document.title}${document.body}`.replace(/\s+/g, '').toLowerCase();
  if (compactQuery.length >= 4 && compactDocument.includes(compactQuery)) score += 20;
  return score * (STATUS_WEIGHT[document.status] ?? 0.85);
}

function publicDocument(document, score) {
  return {
    id: document.id,
    type: document.type,
    title: document.title,
    status: document.status,
    statusLabel: STATUS_LABEL[document.status] ?? document.status,
    confidence: document.confidence,
    categories: document.categories,
    tags: document.tags,
    related: document.related,
    sources: document.sources,
    updated: document.updated ?? null,
    published: document.published ?? null,
    body: document.body,
    path: document.path,
    relativePath: document.relativePath,
    ...(score === undefined ? {} : { score: Number(score.toFixed(2)) }),
  };
}

export class KnowledgeStore {
  constructor(root) {
    this.root = root;
  }

  async load() {
    const documents = [];
    for (const directory of KNOWLEDGE_DIRECTORIES) {
      const fullDirectory = join(this.root, 'knowledge', directory);
      let entries = [];
      try {
        entries = await readdir(fullDirectory, { withFileTypes: true });
      } catch (error) {
        if (error.code === 'ENOENT') continue;
        throw error;
      }
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
        const path = join(fullDirectory, entry.name);
        const document = parseMarkdownDocument(await readFile(path, 'utf8'), path, this.root);
        if (document) documents.push(document);
      }
    }
    return documents;
  }

  async search(query, options = {}) {
    const { limit = 8, includeObsolete = true, types } = options;
    const allowedTypes = types?.length ? new Set(types) : null;
    const documents = await this.load();
    return documents
      .filter(document => includeObsolete || document.status !== 'obsolete')
      .filter(document => !allowedTypes || allowedTypes.has(document.type))
      .map(document => ({ document, score: scoreDocument(query, document) }))
      .filter(result => result.score > 0)
      .sort((left, right) => right.score - left.score || left.document.title.localeCompare(right.document.title, 'zh-CN'))
      .slice(0, Math.max(1, Math.min(limit, 20)))
      .map(({ document, score }) => publicDocument(document, score));
  }

  async getById(id) {
    const document = (await this.load()).find(item => item.id === id);
    return document ? publicDocument(document) : null;
  }

  async getRelated(id, options = {}) {
    const { limit = 12 } = options;
    const documents = await this.load();
    const origin = documents.find(item => item.id === id);
    if (!origin) return [];
    const linkedIds = new Set([...origin.related, ...origin.sources]);
    for (const document of documents) {
      if (document.related.includes(id) || document.sources.includes(id)) linkedIds.add(document.id);
    }
    linkedIds.delete(id);
    return documents
      .filter(document => linkedIds.has(document.id))
      .slice(0, Math.max(1, Math.min(limit, 30)))
      .map(document => publicDocument(document));
  }

  async buildContext(task, options = {}) {
    const limit = Math.max(1, Math.min(options.limit ?? 5, 10));
    const initial = await this.search(task, { limit, includeObsolete: false });
    const byId = new Map(initial.map(item => [item.id, item]));
    for (const item of initial.filter(result => result.type !== 'source').slice(0, 3)) {
      for (const related of await this.getRelated(item.id, { limit: 6 })) {
        if (related.status !== 'obsolete') byId.set(related.id, related);
      }
    }

    const personal = [...byId.values()]
      .filter(item => item.type === 'unit' || item.type === 'topic')
      .slice(0, limit);
    const sources = [...byId.values()]
      .filter(item => item.type === 'source')
      .slice(0, limit);
    const notice = `本次调用了 ${personal.length} 条个人认知和 ${sources.length} 条外部材料。`;
    const personalText = personal.length
      ? personal.map(item => `- [${item.statusLabel}｜确信度 ${item.confidence}] ${item.title}：${item.body}`).join('\n')
      : '- 没有找到足够相关的个人认知。';
    const sourceText = sources.length
      ? sources.map(item => `- ${item.title}${item.published ? `（${item.published}）` : ''}：${item.body}`).join('\n')
      : '- 没有找到直接关联的外部材料。';

    return {
      notice,
      personal,
      sources,
      text: `## 个人认知\n${personalText}\n\n## 外部材料\n${sourceText}`,
    };
  }
}
