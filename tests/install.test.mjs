import assert from 'node:assert/strict';
import { join } from 'node:path';
import test from 'node:test';

import { buildInstallPlan, resolveCodexInvocation } from '../scripts/install.mjs';

test('installer derives portable paths from the checkout and home directories', () => {
  const projectRoot = join('workspace', 'cognition-workbench');
  const homeDirectory = join('users', 'example');
  const plan = buildInstallPlan({ projectRoot, homeDirectory, platform: 'linux' });

  assert.equal(plan.mcp.name, 'cognition_workbench');
  assert.equal(plan.mcp.environment.COGNITION_WORKBENCH_HOME, projectRoot);
  assert.equal(plan.mcp.command, process.execPath);
  assert.deepEqual(plan.mcp.args, [join(projectRoot, 'server', 'src', 'server.mjs')]);
  assert.equal(plan.skills.length, 3);
  assert.ok(plan.skills.every(skill => skill.target.startsWith(join(homeDirectory, '.agents', 'skills'))));
  assert.ok(plan.skills.every(skill => skill.linkType === 'dir'));
});

test('installer uses junctions on Windows without embedding a user-specific path', () => {
  const projectRoot = 'D:\\projects\\cognition-workbench';
  const homeDirectory = 'C:\\Users\\example';
  const plan = buildInstallPlan({ projectRoot, homeDirectory, platform: 'win32' });

  assert.ok(plan.skills.every(skill => skill.linkType === 'junction'));
  assert.equal(plan.mcp.environment.COGNITION_WORKBENCH_HOME, projectRoot);
  assert.ok(plan.skills.every(skill => skill.source.startsWith(projectRoot)));
  assert.ok(plan.skills.every(skill => skill.target.startsWith(join(homeDirectory, '.agents', 'skills'))));
});

test('Windows invocation safely uses the npm PowerShell shim when no executable exists', () => {
  const binDirectory = 'C:\\tools\\npm';
  const invocation = resolveCodexInvocation({
    platform: 'win32',
    pathEntries: [binDirectory],
    fileExists: path => path.endsWith('codex.ps1'),
  });

  assert.match(invocation.command, /powershell(?:\.exe)?$/i);
  assert.deepEqual(invocation.prefixArgs.slice(-2), [
    '-File',
    join(binDirectory, 'codex.ps1'),
  ]);
});

test('Windows invocation prefers the npm shim over an inaccessible app execution alias', () => {
  const appDirectory = 'C:\\Program Files\\WindowsApps\\Codex';
  const npmDirectory = 'C:\\tools\\npm';
  const invocation = resolveCodexInvocation({
    platform: 'win32',
    pathEntries: [appDirectory, npmDirectory],
    fileExists: path => path === join(appDirectory, 'codex.exe') || path === join(npmDirectory, 'codex.ps1'),
  });

  assert.match(invocation.command, /powershell(?:\.exe)?$/i);
  assert.equal(invocation.prefixArgs.at(-1), join(npmDirectory, 'codex.ps1'));
});
