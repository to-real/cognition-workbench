import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import YAML from 'yaml';

const TARGET_DIRECTORIES = {
  unit: 'units',
  topic: 'topics',
  source: 'sources',
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function timestamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
}

function serialize(metadata, body) {
  return `---\n${YAML.stringify(metadata, { lineWidth: 0 }).trimEnd()}\n---\n\n${String(body).trim()}\n`;
}

function parse(text) {
  const match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n)?([\s\S]*)$/);
  if (!match) throw new Error('Invalid Markdown frontmatter');
  return { metadata: YAML.parse(match[1]) ?? {}, body: match[2].trim() };
}

function requireText(value, field) {
  if (!String(value ?? '').trim()) throw new Error(`${field} is required`);
  return String(value).trim();
}

export async function createUpdateCandidate(root, input) {
  const targetType = String(input.targetType ?? 'unit');
  if (!TARGET_DIRECTORIES[targetType]) throw new Error('targetType must be unit, topic, or source');
  const title = requireText(input.title, 'title');
  const body = requireText(input.body, 'body');
  const shortId = randomUUID().replaceAll('-', '').slice(0, 10);
  const targetId = input.targetId ? String(input.targetId) : `${targetType}-${today()}-${shortId}`;
  const candidateId = `update-${timestamp()}-${shortId}`;
  const directory = join(root, 'inbox', 'updates');
  const path = join(directory, `${candidateId}.md`);
  await mkdir(directory, { recursive: true });
  await writeFile(path, serialize({
    id: candidateId,
    type: 'update_candidate',
    title,
    status: 'pending',
    target_type: targetType,
    target_id: targetId,
    proposed_status: String(input.status ?? 'tentative'),
    confidence: String(input.confidence ?? 'unknown'),
    categories: input.categories ?? [],
    tags: input.tags ?? [],
    related: input.related ?? [],
    sources: input.sources ?? [],
    created: today(),
  }, body), 'utf8');
  return { candidateId, targetId, path, status: 'pending' };
}

export async function commitUpdateCandidate(root, candidateId, options = {}) {
  if (options.confirmation !== 'CONFIRMED') {
    throw new Error('Commit requires confirmation: CONFIRMED');
  }
  if (!/^update-\d{14}-[a-f0-9]{10}$/.test(String(candidateId))) {
    throw new Error('Invalid candidate id');
  }
  const candidatePath = join(root, 'inbox', 'updates', `${candidateId}.md`);
  const candidate = parse(await readFile(candidatePath, 'utf8'));
  const targetType = String(candidate.metadata.target_type);
  const directoryName = TARGET_DIRECTORIES[targetType];
  if (!directoryName) throw new Error('Candidate has an invalid target type');
  if (candidate.metadata.status === 'accepted') {
    return {
      candidateId,
      targetId: String(candidate.metadata.target_id),
      path: String(candidate.metadata.committed_path),
      status: 'accepted',
    };
  }
  if (candidate.metadata.status !== 'pending') throw new Error('Candidate is not pending');

  const targetId = String(candidate.metadata.target_id);
  if (!/^[a-z0-9][a-z0-9-]{2,127}$/.test(targetId)) throw new Error('Invalid target id');
  const directory = join(root, 'knowledge', directoryName);
  const targetPath = join(directory, `${targetId}.md`);
  await mkdir(directory, { recursive: true });
  let previous = null;
  let previousText = null;
  try {
    previousText = await readFile(targetPath, 'utf8');
    previous = parse(previousText);
    if (String(previous.metadata.id) !== targetId || String(previous.metadata.type) !== targetType) {
      throw new Error('Existing target identity does not match the candidate');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const targetMetadata = {
    id: targetId,
    type: targetType,
    title: String(candidate.metadata.title),
    status: String(candidate.metadata.proposed_status ?? 'tentative'),
    confidence: String(candidate.metadata.confidence ?? 'unknown'),
    categories: candidate.metadata.categories ?? [],
    tags: candidate.metadata.tags ?? [],
    related: candidate.metadata.related ?? [],
    sources: candidate.metadata.sources ?? [],
    created: String(previous?.metadata.created ?? candidate.metadata.created ?? today()),
    updated: today(),
  };
  let historyPath = null;
  if (previousText !== null) {
    const historyDirectory = join(root, 'knowledge', 'history', targetId);
    historyPath = join(historyDirectory, `${candidateId}.md`);
    await mkdir(historyDirectory, { recursive: true });
    await writeFile(historyPath, previousText, { encoding: 'utf8', flag: 'wx' });
    await writeFile(targetPath, serialize(targetMetadata, candidate.body), 'utf8');
  } else {
    await writeFile(targetPath, serialize(targetMetadata, candidate.body), { encoding: 'utf8', flag: 'wx' });
  }
  const acceptedMetadata = {
    ...candidate.metadata,
    status: 'accepted',
    accepted: today(),
    committed_path: targetPath,
    history_path: historyPath,
  };
  await writeFile(candidatePath, serialize(acceptedMetadata, candidate.body), 'utf8');
  return { candidateId, targetId, path: targetPath, historyPath, status: 'accepted' };
}

export async function saveDailyTopic(root, input) {
  const date = String(input.date ?? today());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date must use YYYY-MM-DD');
  const title = requireText(input.title, 'title');
  const rationale = requireText(input.rationale, 'rationale');
  const directory = join(root, 'inbox', 'daily');
  const path = join(directory, `${date}.md`);
  await mkdir(directory, { recursive: true });
  const metadata = {
    id: `daily-${date}`,
    type: 'daily_topic',
    title,
    status: 'proposed',
    date,
    angles: input.angles ?? [],
    related: input.relatedIds ?? [],
    sources: input.sourceIds ?? [],
    created: today(),
  };
  await writeFile(path, serialize(metadata, rationale), { encoding: 'utf8', flag: 'wx' });
  return { ...metadata, rationale, path };
}

export async function getDailyTopic(root, date = today()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) throw new Error('date must use YYYY-MM-DD');
  const path = join(root, 'inbox', 'daily', `${date}.md`);
  try {
    const document = parse(await readFile(path, 'utf8'));
    return {
      ...document.metadata,
      angles: document.metadata.angles ?? [],
      relatedIds: document.metadata.related ?? [],
      sourceIds: document.metadata.sources ?? [],
      rationale: document.body,
      path,
    };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
