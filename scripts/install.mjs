import { existsSync } from 'node:fs';
import { lstat, mkdir, readlink, symlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SKILL_NAMES = [
  'discuss-cognition',
  'apply-personal-cognition',
  'recommend-daily-topic',
];

export function buildInstallPlan({ projectRoot, homeDirectory, platform = process.platform }) {
  return {
    skills: SKILL_NAMES.map(name => ({
      name,
      source: join(projectRoot, 'skills', name),
      target: join(homeDirectory, '.agents', 'skills', name),
      linkType: platform === 'win32' ? 'junction' : 'dir',
    })),
    mcp: {
      name: 'cognition_workbench',
      command: process.execPath,
      args: [join(projectRoot, 'server', 'src', 'server.mjs')],
      environment: { COGNITION_WORKBENCH_HOME: projectRoot },
    },
  };
}

export function resolveCodexInvocation({
  platform = process.platform,
  pathEntries = String(process.env.PATH ?? '').split(delimiter).filter(Boolean),
  fileExists = existsSync,
} = {}) {
  if (platform !== 'win32') return { command: 'codex', prefixArgs: [] };

  for (const directory of pathEntries) {
    const script = join(directory, 'codex.ps1');
    if (fileExists(script)) {
      return {
        command: 'powershell.exe',
        prefixArgs: ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script],
      };
    }
  }
  for (const directory of pathEntries) {
    const executable = join(directory, 'codex.exe');
    if (fileExists(executable)) return { command: executable, prefixArgs: [] };
  }
  return { command: 'codex', prefixArgs: [] };
}

function runCodex(args, options = {}) {
  const invocation = resolveCodexInvocation();
  return spawnSync(invocation.command, [...invocation.prefixArgs, ...args], {
    encoding: 'utf8',
    shell: false,
    stdio: options.capture ? 'pipe' : 'inherit',
  });
}

async function ensureSkillLink(skill, { dryRun }) {
  if (!dryRun) await mkdir(dirname(skill.target), { recursive: true });
  try {
    const stats = await lstat(skill.target);
    if (!stats.isSymbolicLink()) {
      throw new Error(`Refusing to replace an existing non-link path: ${skill.target}`);
    }
    const currentSource = await readlink(skill.target);
    if (resolve(dirname(skill.target), currentSource) === resolve(skill.source)) {
      return `already linked: ${skill.name}`;
    }
    throw new Error(`Refusing to replace a link owned by another project: ${skill.target}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  if (!dryRun) await symlink(resolve(skill.source), skill.target, skill.linkType);
  return `${dryRun ? 'would link' : 'linked'}: ${skill.name}`;
}

function installMcp(mcp, { dryRun, force }) {
  const existing = runCodex(['mcp', 'get', mcp.name], { capture: true });
  if (existing.status === 0 && !force) {
    return `MCP already registered: ${mcp.name} (use --force to replace it)`;
  }
  if (dryRun) return `would register MCP: ${mcp.name}`;
  if (existing.status === 0) {
    const removed = runCodex(['mcp', 'remove', mcp.name]);
    if (removed.status !== 0) throw new Error(`Failed to remove existing MCP server: ${mcp.name}`);
  }

  const environmentArgs = Object.entries(mcp.environment)
    .flatMap(([key, value]) => ['--env', `${key}=${value}`]);
  const added = runCodex([
    'mcp', 'add', mcp.name,
    ...environmentArgs,
    '--', mcp.command, ...mcp.args,
  ]);
  if (added.status !== 0) throw new Error(`Failed to register MCP server: ${mcp.name}`);
  return `registered MCP: ${mcp.name}`;
}

export async function install({
  projectRoot,
  homeDirectory = homedir(),
  platform = process.platform,
  dryRun = false,
  force = false,
} = {}) {
  const plan = buildInstallPlan({ projectRoot, homeDirectory, platform });
  const messages = [];
  for (const skill of plan.skills) {
    messages.push(await ensureSkillLink(skill, { dryRun }));
  }
  messages.push(installMcp(plan.mcp, { dryRun, force }));
  return { plan, messages };
}

async function main() {
  const moduleDirectory = dirname(fileURLToPath(import.meta.url));
  const projectRoot = resolve(moduleDirectory, '..');
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');
  const result = await install({ projectRoot, dryRun, force });
  for (const message of result.messages) console.log(message);
  console.log(dryRun ? 'Dry run complete.' : 'Cognition Workbench is ready. Restart Codex to load the skills and MCP server.');
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
