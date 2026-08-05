import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const excludedDirectories = new Set(['.git', 'node_modules', 'inbox', 'knowledge', 'state']);
const requiredFiles = [
  'README.md',
  'README.zh-CN.md',
  'LICENSE',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'CHANGELOG.md',
  'package.json',
  'server/src/server.mjs',
];
const sensitivePatterns = [
  { label: 'absolute personal machine path', pattern: /[A-Za-z]:[\\/](?:Users[\\/][^\\/]+|[^\\/]*Desktop)[\\/]/i },
  { label: 'Unix home path', pattern: /\/(?:Users|home)\/[^/\s]+\// },
  { label: 'GitHub token', pattern: /gh[pousr]_[A-Za-z0-9_]{20,}/ },
  { label: 'OpenAI-style secret', pattern: /sk-[A-Za-z0-9_-]{20,}/ },
];

async function collectFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(path));
    else files.push(path);
  }
  return files;
}

const failures = [];
for (const required of requiredFiles) {
  try {
    await readFile(join(root, required));
  } catch {
    failures.push(`missing required file: ${required}`);
  }
}

for (const path of await collectFiles(root)) {
  let content;
  try {
    content = await readFile(path, 'utf8');
  } catch {
    continue;
  }
  for (const { label, pattern } of sensitivePatterns) {
    if (pattern.test(content)) failures.push(`${label}: ${relative(root, path)}`);
  }
}

const packageMetadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const serverSource = await readFile(join(root, 'server', 'src', 'server.mjs'), 'utf8');
if (!serverSource.includes(`version: '${packageMetadata.version}'`)) {
  failures.push('package and MCP server versions do not match');
}

if (failures.length) {
  console.error(failures.map(failure => `- ${failure}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log('Release validation passed.');
}
