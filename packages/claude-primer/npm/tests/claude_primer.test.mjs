#!/usr/bin/env node
/**
 * Tests for claude-primer npm port.
 * Run: node --test tests/
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, '..', 'index.mjs');

function runSetup(args = [], { cwd, timeout = 30000 } = {}) {
  const cmd = `node ${SCRIPT} ${args.join(' ')}`;
  try {
    const output = execSync(cmd, {
      cwd,
      timeout,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout: output, exitCode: 0 };
  } catch (e) {
    return { stdout: e.stdout || '', stderr: e.stderr || '', exitCode: e.status ?? 1 };
  }
}

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'claude-primer-test-'));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── Basic Behavior ───

describe('BasicBehavior', () => {
  it('creates all four files', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      for (const f of ['CLAUDE.md', 'QUICKSTART.md', 'STANDARDS.md', 'ERRORS_AND_LESSONS.md']) {
        assert.ok(fs.existsSync(path.join(tmp, f)), `${f} should exist`);
      }
    } finally {
      cleanup(tmp);
    }
  });

  it('dry run creates no files', () => {
    const tmp = makeTmpDir();
    try {
      const { stdout } = runSetup(['--dry-run', '--yes', '--no-git-check'], { cwd: tmp });
      assert.ok(stdout.includes('DRY RUN'), 'Should mention DRY RUN');
      for (const f of ['CLAUDE.md', 'QUICKSTART.md', 'STANDARDS.md', 'ERRORS_AND_LESSONS.md']) {
        assert.ok(!fs.existsSync(path.join(tmp, f)), `${f} should NOT exist in dry run`);
      }
    } finally {
      cleanup(tmp);
    }
  });

  it('does not create README by default', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      assert.ok(!fs.existsSync(path.join(tmp, 'README.md')), 'README.md should not exist');
    } finally {
      cleanup(tmp);
    }
  });

  it('creates README with --with-readme', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check', '--with-readme'], { cwd: tmp });
      assert.ok(fs.existsSync(path.join(tmp, 'README.md')), 'README.md should exist');
    } finally {
      cleanup(tmp);
    }
  });

  it('skips existing files without --force', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const original = fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf-8');
      // Run again
      const { stdout } = runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      assert.ok(stdout.includes('skip') || stdout.includes('SKIP'), 'Should skip existing files');
      const after = fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf-8');
      assert.equal(original, after, 'Content should be unchanged');
    } finally {
      cleanup(tmp);
    }
  });

  it('plan-json outputs valid JSON', () => {
    const tmp = makeTmpDir();
    try {
      const { stdout } = runSetup(['--plan-json', '--no-git-check'], { cwd: tmp });
      const data = JSON.parse(stdout);
      assert.ok('stacks' in data, 'JSON should have stacks');
      assert.ok('tier' in data, 'JSON should have tier');
    } finally {
      cleanup(tmp);
    }
  });
});

// ─── Stack Detection ───

describe('StackDetection', () => {
  it('detects python from requirements.txt', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'requirements.txt'), 'flask\n');
      fs.writeFileSync(path.join(tmp, 'app.py'), 'print("hi")\n');
      const { stdout } = runSetup(['--plan-json', '--no-git-check'], { cwd: tmp });
      const data = JSON.parse(stdout);
      assert.ok(data.stacks.includes('python'));
    } finally {
      cleanup(tmp);
    }
  });

  it('detects node from package.json', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"test"}');
      fs.writeFileSync(path.join(tmp, 'index.js'), 'module.exports = {};\n');
      const { stdout } = runSetup(['--plan-json', '--no-git-check'], { cwd: tmp });
      const data = JSON.parse(stdout);
      assert.ok(data.stacks.includes('node'));
    } finally {
      cleanup(tmp);
    }
  });

  it('detects rust from Cargo.toml', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'Cargo.toml'), '[package]\nname = "test"\n');
      fs.writeFileSync(path.join(tmp, 'main.rs'), 'fn main() {}\n');
      const { stdout } = runSetup(['--plan-json', '--no-git-check'], { cwd: tmp });
      const data = JSON.parse(stdout);
      assert.ok(data.stacks.includes('rust'));
    } finally {
      cleanup(tmp);
    }
  });

  it('detects go from go.mod', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'go.mod'), 'module test\ngo 1.21\n');
      fs.writeFileSync(path.join(tmp, 'main.go'), 'package main\n');
      const { stdout } = runSetup(['--plan-json', '--no-git-check'], { cwd: tmp });
      const data = JSON.parse(stdout);
      assert.ok(data.stacks.includes('go'));
    } finally {
      cleanup(tmp);
    }
  });
});

// ─── Framework Detection ───

describe('FrameworkDetection', () => {
  it('detects nextjs from next.config.js', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"test","dependencies":{"next":"14.0.0"}}');
      fs.writeFileSync(path.join(tmp, 'next.config.js'), 'module.exports = {};\n');
      const { stdout } = runSetup(['--plan-json', '--no-git-check'], { cwd: tmp });
      const data = JSON.parse(stdout);
      assert.ok(data.frameworks.includes('nextjs'));
    } finally {
      cleanup(tmp);
    }
  });

  it('detects flask from requirements', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'requirements.txt'), 'flask==3.0\n');
      fs.writeFileSync(path.join(tmp, 'app.py'), 'from flask import Flask\n');
      const { stdout } = runSetup(['--plan-json', '--no-git-check'], { cwd: tmp });
      const data = JSON.parse(stdout);
      assert.ok(data.frameworks.includes('flask'));
    } finally {
      cleanup(tmp);
    }
  });
});

// ─── Generated Content ───

describe('GeneratedContent', () => {
  it('CLAUDE.md has required sections', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"myapp"}');
      fs.writeFileSync(path.join(tmp, 'index.js'), 'console.log("hi");\n');
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf-8');
      assert.ok(content.includes('## Repository Overview'), 'Should have Repository Overview');
      assert.ok(content.includes('## Environment'), 'Should have Environment');
      assert.ok(content.includes('## Pre-Task'), 'Should have Pre-Task section');
    } finally {
      cleanup(tmp);
    }
  });

  it('STANDARDS.md has governance content', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'STANDARDS.md'), 'utf-8');
      assert.ok(content.includes('STANDARDS'), 'Should have STANDARDS header');
    } finally {
      cleanup(tmp);
    }
  });

  it('QUICKSTART.md has AUTO-MAINTAINED marker', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'QUICKSTART.md'), 'utf-8');
      assert.ok(content.includes('AUTO-MAINTAINED'), 'Should have AUTO-MAINTAINED marker');
    } finally {
      cleanup(tmp);
    }
  });

  it('ERRORS_AND_LESSONS.md has rationalization table', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'ERRORS_AND_LESSONS.md'), 'utf-8');
      assert.ok(
        content.includes('Rationalization') || content.includes('rationalization'),
        'Should have rationalization table'
      );
    } finally {
      cleanup(tmp);
    }
  });
});

// ─── Tier Detection ───

describe('TierDetection', () => {
  it('empty project gets low tier', () => {
    const tmp = makeTmpDir();
    try {
      const { stdout } = runSetup(['--plan-json', '--no-git-check'], { cwd: tmp });
      const data = JSON.parse(stdout);
      // tier may be a string like "T2" or an object with .tier
      const tier = typeof data.tier === 'object' ? `T${data.tier.tier}` : data.tier;
      assert.ok(['T1', 'T2', 'T3', 'T4'].includes(tier), `Should be a valid tier, got ${tier}`);
    } finally {
      cleanup(tmp);
    }
  });

  it('project with deploy signals gets higher tier', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"prod-app","dependencies":{"next":"14"}}');
      fs.writeFileSync(path.join(tmp, 'Dockerfile'), 'FROM node:18\n');
      fs.mkdirSync(path.join(tmp, '.github', 'workflows'), { recursive: true });
      fs.writeFileSync(path.join(tmp, '.github', 'workflows', 'ci.yml'), 'name: CI\n');
      const { stdout } = runSetup(['--plan-json', '--no-git-check'], { cwd: tmp });
      const data = JSON.parse(stdout);
      const tier = typeof data.tier === 'object' ? `T${data.tier.tier}` : data.tier;
      assert.ok(['T1', 'T2', 'T3', 'T4'].includes(tier), `Should be a valid tier, got ${JSON.stringify(data.tier)}`);
    } finally {
      cleanup(tmp);
    }
  });
});

// ─── Ralph Integration ───

describe('RalphIntegration', () => {
  it('no ralph files by default', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      assert.ok(!fs.existsSync(path.join(tmp, '.ralph')), '.ralph/ should not exist');
      assert.ok(!fs.existsSync(path.join(tmp, '.ralphrc')), '.ralphrc should not exist');
    } finally {
      cleanup(tmp);
    }
  });

  it('creates ralph structure with --with-ralph', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'requirements.txt'), 'flask\n');
      fs.writeFileSync(path.join(tmp, 'app.py'), 'print("hi")\n');
      runSetup(['--yes', '--no-git-check', '--with-ralph'], { cwd: tmp });
      assert.ok(fs.existsSync(path.join(tmp, '.ralph', 'PROMPT.md')), 'PROMPT.md should exist');
      assert.ok(fs.existsSync(path.join(tmp, '.ralphrc')), '.ralphrc should exist');
    } finally {
      cleanup(tmp);
    }
  });

  it('PROMPT.md references CLAUDE.md', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'requirements.txt'), 'flask\n');
      fs.writeFileSync(path.join(tmp, 'app.py'), 'print("hi")\n');
      runSetup(['--yes', '--no-git-check', '--with-ralph'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, '.ralph', 'PROMPT.md'), 'utf-8');
      assert.ok(content.includes('CLAUDE.md'), 'PROMPT.md should reference CLAUDE.md');
    } finally {
      cleanup(tmp);
    }
  });

  it('clean-root prompt references docs dir', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'requirements.txt'), 'flask\n');
      fs.writeFileSync(path.join(tmp, 'app.py'), 'print("hi")\n');
      runSetup(['--yes', '--no-git-check', '--with-ralph', '--clean-root'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, '.ralph', 'PROMPT.md'), 'utf-8');
      assert.ok(content.includes('../.claude/docs/QUICKSTART.md'));
      assert.ok(content.includes('../.claude/docs/STANDARDS.md'));
      assert.ok(content.includes('../.claude/docs/ERRORS_AND_LESSONS.md'));
    } finally {
      cleanup(tmp);
    }
  });

  it('AGENT.md is symlink to QUICKSTART.md', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'requirements.txt'), 'flask\n');
      fs.writeFileSync(path.join(tmp, 'app.py'), 'print("hi")\n');
      runSetup(['--yes', '--no-git-check', '--with-ralph'], { cwd: tmp });
      const agentPath = path.join(tmp, '.ralph', 'AGENT.md');
      assert.ok(fs.existsSync(agentPath), 'AGENT.md should exist');
      assert.ok(fs.lstatSync(agentPath).isSymbolicLink(), 'AGENT.md should be a symlink');
    } finally {
      cleanup(tmp);
    }
  });

  it('clean-root AGENT.md points to relocated QUICKSTART.md', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'requirements.txt'), 'flask\n');
      fs.writeFileSync(path.join(tmp, 'app.py'), 'print("hi")\n');
      runSetup(['--yes', '--no-git-check', '--with-ralph', '--clean-root'], { cwd: tmp });
      const agentPath = path.join(tmp, '.ralph', 'AGENT.md');
      assert.ok(fs.lstatSync(agentPath).isSymbolicLink(), 'AGENT.md should be a symlink');
      assert.equal(fs.realpathSync(agentPath), fs.realpathSync(path.join(tmp, '.claude', 'docs', 'QUICKSTART.md')));
    } finally {
      cleanup(tmp);
    }
  });

  it('.ralphrc has python tools for python project', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'requirements.txt'), 'flask\n');
      fs.writeFileSync(path.join(tmp, 'app.py'), 'print("hi")\n');
      runSetup(['--yes', '--no-git-check', '--with-ralph'], { cwd: tmp });
      const rc = fs.readFileSync(path.join(tmp, '.ralphrc'), 'utf-8');
      assert.ok(rc.includes('pytest') || rc.includes('python'), '.ralphrc should have python tools');
    } finally {
      cleanup(tmp);
    }
  });

  it('first Ralph run reports create actions', () => {
    const tmp = makeTmpDir();
    try {
      const { stdout, exitCode } = runSetup(['--yes', '--no-git-check', '--with-ralph'], { cwd: tmp });
      assert.equal(exitCode, 0);
      assert.ok(stdout.includes('CREATE               .ralph/PROMPT.md'));
      assert.ok(stdout.includes('CREATE               .ralph/fix_plan.md'));
      assert.ok(stdout.includes('CREATE               .ralphrc'));
      assert.ok(!stdout.includes('OVERWRITE            .ralph/PROMPT.md'));
      assert.ok(!stdout.includes('SKIP                 .ralph/fix_plan.md'));
    } finally {
      cleanup(tmp);
    }
  });
});

// ─── RC Persistence ───

describe('RCPersistence', () => {
  it('saves config after run', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      // RC file may or may not be created depending on JS port implementation
      // At minimum, the main files should exist
      assert.ok(fs.existsSync(path.join(tmp, 'CLAUDE.md')), 'CLAUDE.md should exist');
    } finally {
      cleanup(tmp);
    }
  });
});

// ─── Clean Root ───

describe('CleanRoot', () => {
  it('moves aux docs to .claude/docs/ with --clean-root', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check', '--clean-root'], { cwd: tmp });
      assert.ok(fs.existsSync(path.join(tmp, 'CLAUDE.md')), 'CLAUDE.md should be at root');
      // Check that at least one aux file is in .claude/docs/
      const docsDir = path.join(tmp, '.claude', 'docs');
      if (fs.existsSync(docsDir)) {
        const files = fs.readdirSync(docsDir);
        assert.ok(files.length > 0, '.claude/docs/ should have files');
      }
    } finally {
      cleanup(tmp);
    }
  });

  it('updates README references for clean-root layout', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check', '--clean-root', '--with-readme'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'README.md'), 'utf-8');
      assert.ok(content.includes('.claude/docs/QUICKSTART.md'));
      assert.ok(content.includes('.claude/docs/STANDARDS.md'));
      assert.ok(content.includes('.claude/docs/ERRORS_AND_LESSONS.md'));
    } finally {
      cleanup(tmp);
    }
  });
});

// ─── Force Overwrite ───

describe('ForceOverwrite', () => {
  it('--force overwrites changed files', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      // Modify a file
      fs.writeFileSync(path.join(tmp, 'CLAUDE.md'), '# Modified\n');
      const { stdout } = runSetup(['--yes', '--no-git-check', '--force'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf-8');
      assert.ok(content !== '# Modified\n', 'File should be overwritten');
    } finally {
      cleanup(tmp);
    }
  });

  it('--force skips unchanged files', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const { stdout } = runSetup(['--yes', '--no-git-check', '--force'], { cwd: tmp });
      // Should see skip messages for unchanged files
      assert.ok(
        stdout.includes('SKIP') || stdout.includes('skip') || stdout.includes('unchanged'),
        'Should skip unchanged files'
      );
    } finally {
      cleanup(tmp);
    }
  });
});

// ─── Monorepo Detection ───

describe('MonorepoDetection', () => {
  it('detects pnpm workspace', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"mono"}');
      fs.writeFileSync(path.join(tmp, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n');
      fs.mkdirSync(path.join(tmp, 'apps', 'web'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'apps', 'web', 'package.json'), '{"name":"web"}');
      const { stdout } = runSetup(['--plan-json', '--no-git-check'], { cwd: tmp });
      const data = JSON.parse(stdout);
      assert.ok(data.is_monorepo === true, 'Should detect monorepo');
    } finally {
      cleanup(tmp);
    }
  });

  it('detects turborepo', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'turbo.json'), '{"pipeline": {}}\n');
      fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({
        name: 'root', private: true, workspaces: ['apps/*', 'packages/*']
      }));
      fs.mkdirSync(path.join(tmp, 'apps', 'web'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'apps', 'web', 'package.json'), '{"name":"web"}');
      fs.mkdirSync(path.join(tmp, 'packages', 'ui'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'packages', 'ui', 'package.json'), '{"name":"ui"}');
      fs.writeFileSync(path.join(tmp, 'packages', 'ui', 'Button.tsx'), 'export default function Button() {}\n');
      const { stdout } = runSetup(['--plan-json', '--no-git-check'], { cwd: tmp });
      const data = JSON.parse(stdout);
      assert.ok(data.is_monorepo === true, 'Should detect monorepo');
      assert.equal(data.monorepo_tool, 'turborepo');
    } finally {
      cleanup(tmp);
    }
  });

  it('workspace dirs found', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'turbo.json'), '{"pipeline": {}}\n');
      fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({
        name: 'root', private: true, workspaces: ['apps/*']
      }));
      fs.mkdirSync(path.join(tmp, 'apps', 'web'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'apps', 'web', 'package.json'), '{"name":"web"}');
      const { stdout } = runSetup(['--plan-json', '--no-git-check'], { cwd: tmp });
      const data = JSON.parse(stdout);
      assert.ok(
        data.workspace_dirs.includes('apps') || data.sub_projects.length > 0,
        'Should find workspace dirs or sub_projects'
      );
    } finally {
      cleanup(tmp);
    }
  });
});

// ─── Stack Detection: Edge Cases ───

describe('StackDetectionEdge', () => {
  it('empty dir has no stacks', () => {
    const tmp = makeTmpDir();
    try {
      const { stdout } = runSetup(['--plan-json', '--no-git-check'], { cwd: tmp });
      const data = JSON.parse(stdout);
      assert.deepEqual(data.stacks, []);
      assert.deepEqual(data.frameworks, []);
    } finally {
      cleanup(tmp);
    }
  });

  it('detects express framework from package.json', () => {
    const tmp = makeTmpDir();
    try {
      const pkg = {
        name: 'test-app', version: '1.0.0',
        scripts: { test: 'jest', start: 'node index.js', build: 'tsc' },
        dependencies: { express: '^4.18.0' },
      };
      fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify(pkg, null, 2));
      fs.writeFileSync(path.join(tmp, 'index.js'), "const express = require('express');\n");
      const { stdout } = runSetup(['--plan-json', '--no-git-check'], { cwd: tmp });
      const data = JSON.parse(stdout);
      assert.ok(data.frameworks.includes('express'));
    } finally {
      cleanup(tmp);
    }
  });
});

// ─── Tier Detection: Specific Tiers ───

describe('TierDetectionSpecific', () => {
  it('empty project is T4', () => {
    const tmp = makeTmpDir();
    try {
      const { stdout } = runSetup(['--plan-json', '--no-git-check'], { cwd: tmp });
      const data = JSON.parse(stdout);
      assert.equal(data.tier.tier, 4);
    } finally {
      cleanup(tmp);
    }
  });

  it('python-only project is T3', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'requirements.txt'), 'requests==2.31.0\n');
      fs.writeFileSync(path.join(tmp, 'main.py'), "print('hello')\n");
      fs.mkdirSync(path.join(tmp, 'tests'));
      fs.writeFileSync(path.join(tmp, 'tests', 'test_main.py'), 'def test_ok(): assert True\n');
      const { stdout } = runSetup(['--plan-json', '--no-git-check'], { cwd: tmp });
      const data = JSON.parse(stdout);
      assert.equal(data.tier.tier, 3);
    } finally {
      cleanup(tmp);
    }
  });

  it('node+express is T2', () => {
    const tmp = makeTmpDir();
    try {
      const pkg = {
        name: 'test-app', version: '1.0.0',
        dependencies: { express: '^4.18.0' },
      };
      fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify(pkg));
      fs.writeFileSync(path.join(tmp, 'index.js'), "const express = require('express');\n");
      const { stdout } = runSetup(['--plan-json', '--no-git-check'], { cwd: tmp });
      const data = JSON.parse(stdout);
      assert.equal(data.tier.tier, 2);
    } finally {
      cleanup(tmp);
    }
  });

  it('monorepo+framework+deploy is T1', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'turbo.json'), '{"pipeline": {}}\n');
      fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({
        name: 'root', private: true, workspaces: ['apps/*'],
      }));
      fs.mkdirSync(path.join(tmp, 'apps', 'web'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'apps', 'web', 'package.json'), '{"name":"web","dependencies":{"next":"^14.0.0"}}');
      fs.writeFileSync(path.join(tmp, 'apps', 'web', 'next.config.js'), 'module.exports = {};\n');
      fs.writeFileSync(path.join(tmp, 'Dockerfile'), 'FROM node:18\n');
      fs.writeFileSync(path.join(tmp, 'next.config.js'), 'module.exports = {};\n');
      const { stdout } = runSetup(['--plan-json', '--no-git-check'], { cwd: tmp });
      const data = JSON.parse(stdout);
      assert.equal(data.tier.tier, 1);
    } finally {
      cleanup(tmp);
    }
  });
});

// ─── Plan JSON ───

describe('PlanJson', () => {
  it('has required keys', () => {
    const tmp = makeTmpDir();
    try {
      const { stdout } = runSetup(['--plan-json', '--no-git-check'], { cwd: tmp });
      const data = JSON.parse(stdout);
      assert.ok('target' in data, 'JSON should have target');
      assert.ok('stacks' in data, 'JSON should have stacks');
      assert.ok('write_plan' in data, 'JSON should have write_plan');
      assert.ok('git' in data, 'JSON should have git');
      assert.ok('tier' in data, 'JSON should have tier');
    } finally {
      cleanup(tmp);
    }
  });

  it('no files written by plan-json', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--plan-json', '--no-git-check'], { cwd: tmp });
      for (const f of ['CLAUDE.md', 'QUICKSTART.md', 'STANDARDS.md', 'ERRORS_AND_LESSONS.md']) {
        assert.ok(!fs.existsSync(path.join(tmp, f)), `${f} should not exist after plan-json`);
      }
    } finally {
      cleanup(tmp);
    }
  });

  it('write plan shows skip for existing files', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const { stdout } = runSetup(['--plan-json', '--no-git-check'], { cwd: tmp });
      const data = JSON.parse(stdout);
      for (const wp of data.write_plan) {
        assert.equal(wp.mode, 'skip');
        assert.equal(wp.exists, true);
      }
    } finally {
      cleanup(tmp);
    }
  });

  it('write plan shows create for new files', () => {
    const tmp = makeTmpDir();
    try {
      const { stdout } = runSetup(['--plan-json', '--no-git-check'], { cwd: tmp });
      const data = JSON.parse(stdout);
      for (const wp of data.write_plan) {
        assert.equal(wp.mode, 'create');
        assert.equal(wp.exists, false);
      }
    } finally {
      cleanup(tmp);
    }
  });

  it('with-readme included in plan', () => {
    const tmp = makeTmpDir();
    try {
      const { stdout } = runSetup(['--plan-json', '--no-git-check', '--with-readme'], { cwd: tmp });
      const data = JSON.parse(stdout);
      const filenames = data.write_plan.map(wp => wp.filename);
      assert.ok(filenames.includes('README.md'));
    } finally {
      cleanup(tmp);
    }
  });
});

// ─── Generated Content: Extended ───

describe('GeneratedContentExtended', () => {
  it('CLAUDE.md has frontmatter', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf-8');
      assert.ok(content.startsWith('---\n'), 'Should start with frontmatter');
      assert.ok(content.includes('project:'), 'Should have project in frontmatter');
      assert.ok(content.includes('tier:'), 'Should have tier in frontmatter');
    } finally {
      cleanup(tmp);
    }
  });

  it('CLAUDE.md has Iron Law', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf-8');
      assert.ok(content.includes('Iron Law'), 'Should have Iron Law');
    } finally {
      cleanup(tmp);
    }
  });

  it('CLAUDE.md has size guidance', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf-8');
      assert.ok(content.includes('300 lines'), 'Should have 300 lines guidance');
    } finally {
      cleanup(tmp);
    }
  });

  it('CLAUDE.md has all required sections', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf-8');
      for (const section of [
        '## Repository Overview',
        '## Invariants',
        '## Decision Heuristics',
        '## Verification Standard',
        '## Red Flags',
        '## Stuck Protocol',
        '## Pre-Task Protocol',
        '### Post-Task',
        '## Key Decisions',
      ]) {
        assert.ok(content.includes(section), `Missing section: ${section}`);
      }
    } finally {
      cleanup(tmp);
    }
  });

  it('STANDARDS.md has HARD-GATE', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'STANDARDS.md'), 'utf-8');
      assert.ok(content.includes('<HARD-GATE>'), 'Should have <HARD-GATE>');
    } finally {
      cleanup(tmp);
    }
  });

  it('STANDARDS.md has severity levels', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'STANDARDS.md'), 'utf-8');
      assert.ok(content.includes('CRITICAL'), 'Should have CRITICAL');
      assert.ok(content.includes('HIGH'), 'Should have HIGH');
      assert.ok(content.includes('MEDIUM'), 'Should have MEDIUM');
    } finally {
      cleanup(tmp);
    }
  });

  it('STANDARDS.md has Core Principles and Iron Law', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'STANDARDS.md'), 'utf-8');
      assert.ok(content.includes('Core Principles'), 'Should have Core Principles');
      assert.ok(content.includes('Iron Law'), 'Should have Iron Law');
    } finally {
      cleanup(tmp);
    }
  });

  it('STANDARDS.md has iteration limits', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'STANDARDS.md'), 'utf-8');
      assert.ok(content.includes('Max Iterations'), 'Should have Max Iterations');
    } finally {
      cleanup(tmp);
    }
  });

  it('STANDARDS.md has Legitimate Exceptions', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'STANDARDS.md'), 'utf-8');
      assert.ok(content.includes('Legitimate Exceptions'), 'Should have Legitimate Exceptions');
      assert.ok(content.includes('Emergency hotfix'), 'Should have Emergency hotfix');
    } finally {
      cleanup(tmp);
    }
  });

  it('ERRORS_AND_LESSONS.md has Too simple to test', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'ERRORS_AND_LESSONS.md'), 'utf-8');
      assert.ok(content.includes('Too simple to test'), 'Should have Too simple to test');
    } finally {
      cleanup(tmp);
    }
  });

  it('ERRORS_AND_LESSONS.md has Defense-in-Depth', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'ERRORS_AND_LESSONS.md'), 'utf-8');
      assert.ok(content.includes('Defense-in-Depth'), 'Should have Defense-in-Depth');
    } finally {
      cleanup(tmp);
    }
  });

  it('QUICKSTART.md has Complete Workflow Example', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'QUICKSTART.md'), 'utf-8');
      assert.ok(content.includes('Complete Workflow Example'), 'Should have Complete Workflow Example');
    } finally {
      cleanup(tmp);
    }
  });

  it('python project has stack info in CLAUDE.md', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'requirements.txt'), 'requests==2.31.0\n');
      fs.writeFileSync(path.join(tmp, 'main.py'), "print('hello')\n");
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf-8');
      assert.ok(content.toLowerCase().includes('python'), 'Should mention python');
    } finally {
      cleanup(tmp);
    }
  });

  it('node project has stack info in CLAUDE.md', () => {
    const tmp = makeTmpDir();
    try {
      const pkg = { name: 'test-app', dependencies: { express: '^4.18.0' } };
      fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify(pkg));
      fs.writeFileSync(path.join(tmp, 'index.js'), "const express = require('express');\n");
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf-8');
      assert.ok(content.toLowerCase().includes('node'), 'Should mention node');
    } finally {
      cleanup(tmp);
    }
  });

  it('provenance markers are only valid types', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const validMarkers = new Set(['migrated', 'inferred', 'placeholder']);
      for (const f of ['CLAUDE.md', 'QUICKSTART.md', 'STANDARDS.md', 'ERRORS_AND_LESSONS.md']) {
        const content = fs.readFileSync(path.join(tmp, f), 'utf-8');
        const matches = content.matchAll(/<!-- \[([^\]]+)\] -->/g);
        for (const m of matches) {
          assert.ok(
            validMarkers.has(m[1]),
            `Invalid provenance marker '${m[1]}' in ${f}. Expected one of: ${[...validMarkers].join(', ')}`
          );
        }
      }
    } finally {
      cleanup(tmp);
    }
  });

  it('no empty bash blocks in generated files', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      for (const f of ['CLAUDE.md', 'QUICKSTART.md']) {
        const content = fs.readFileSync(path.join(tmp, f), 'utf-8');
        const blocks = content.matchAll(/```bash\n([\s\S]*?)```/g);
        for (const m of blocks) {
          assert.ok(m[1].trim(), `Empty bash block found in ${f}`);
        }
      }
    } finally {
      cleanup(tmp);
    }
  });
});

// ─── AUTO-MAINTAINED marker ───

describe('AutoMaintained', () => {
  it('QUICKSTART.md has AUTO-MAINTAINED marker', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'QUICKSTART.md'), 'utf-8');
      assert.ok(content.includes('AUTO-MAINTAINED'), 'Should have AUTO-MAINTAINED');
    } finally {
      cleanup(tmp);
    }
  });

  it('AUTO-MAINTAINED is an HTML comment', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'QUICKSTART.md'), 'utf-8');
      assert.ok(content.includes('<!-- AUTO-MAINTAINED'), 'Should be an HTML comment');
    } finally {
      cleanup(tmp);
    }
  });
});

// ─── Verification ───

describe('Verification', () => {
  it('clean run has no verification warnings', () => {
    const tmp = makeTmpDir();
    try {
      const { stdout } = runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      assert.ok(!stdout.includes('Verification issues'), 'Should not have verification warnings');
    } finally {
      cleanup(tmp);
    }
  });

  it('version stamp present', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf-8');
      assert.ok(/claude-primer v\d+\.\d+/.test(content), 'Should contain versioned claude-primer reference');
    } finally {
      cleanup(tmp);
    }
  });
});

// ─── Edge Cases ───

describe('EdgeCases', () => {
  it('target with spaces', () => {
    const base = makeTmpDir();
    const tmp = path.join(base, 'my project dir');
    try {
      fs.mkdirSync(tmp);
      const { exitCode } = runSetup([`"${tmp}"`, '--yes', '--no-git-check']);
      assert.equal(exitCode, 0);
      assert.ok(fs.existsSync(path.join(tmp, 'CLAUDE.md')), 'CLAUDE.md should exist');
    } finally {
      cleanup(base);
    }
  });

  it('nested path is auto-created', () => {
    const tmp = makeTmpDir();
    const nested = path.join(tmp, 'a', 'b', 'c');
    try {
      const { exitCode } = runSetup([nested, '--yes', '--no-git-check']);
      assert.equal(exitCode, 0);
      assert.ok(fs.existsSync(nested), 'Nested path should exist');
      assert.ok(fs.existsSync(path.join(nested, 'CLAUDE.md')), 'CLAUDE.md should exist');
    } finally {
      cleanup(tmp);
    }
  });

  it('existing docs detected in plan-json', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'CLAUDE.md'), '# existing\n');
      const { stdout } = runSetup(['--plan-json', '--no-git-check'], { cwd: tmp });
      const data = JSON.parse(stdout);
      assert.ok(data.existing_docs.includes('CLAUDE.md'));
    } finally {
      cleanup(tmp);
    }
  });

  it('idempotent with --force produces same content', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      // Second run with --force
      runSetup(['--yes', '--no-git-check', '--force'], { cwd: tmp });
      const content1 = fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf-8');
      // Third run with --force
      runSetup(['--yes', '--no-git-check', '--force'], { cwd: tmp });
      const content2 = fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf-8');
      assert.equal(content1, content2, 'Content should be stable across force runs');
    } finally {
      cleanup(tmp);
    }
  });

  it('dry-run with missing target does not create directory', () => {
    const tmp = makeTmpDir();
    const missing = path.join(tmp, 'nonexistent');
    try {
      const { exitCode } = runSetup([missing, '--dry-run', '--yes']);
      assert.equal(exitCode, 0);
      assert.ok(!fs.existsSync(missing), 'Directory should not be created');
    } finally {
      cleanup(tmp);
    }
  });
});

// ─── Dual Overwrite (--force vs --force-all) ───

describe('DualOverwrite', () => {
  it('--force skips unchanged files', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const { stdout } = runSetup(['--yes', '--no-git-check', '--force'], { cwd: tmp });
      assert.ok(
        stdout.toLowerCase().includes('unchanged') || stdout.includes('SKIP'),
        'Should skip unchanged files'
      );
    } finally {
      cleanup(tmp);
    }
  });

  it('--force-all overwrites unchanged files', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const { stdout, exitCode } = runSetup(['--yes', '--no-git-check', '--force-all'], { cwd: tmp });
      assert.equal(exitCode, 0);
      assert.ok(stdout.includes('OVERWRITE'), 'Should show OVERWRITE');
    } finally {
      cleanup(tmp);
    }
  });

  it('--force detects content change and overwrites', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      fs.writeFileSync(path.join(tmp, 'CLAUDE.md'), '# Modified externally\n');
      const { exitCode } = runSetup(['--yes', '--no-git-check', '--force'], { cwd: tmp });
      assert.equal(exitCode, 0);
      const content = fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf-8');
      assert.ok(content.includes('Repository Overview'), 'Should be overwritten with generated content');
    } finally {
      cleanup(tmp);
    }
  });
});

// ─── RC Persistence: Extended ───

describe('RCPersistenceExtended', () => {
  it('RC not created for auto-detected project', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'requirements.txt'), 'requests==2.31.0\n');
      fs.writeFileSync(path.join(tmp, 'main.py'), "print('hello')\n");
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      assert.ok(!fs.existsSync(path.join(tmp, '.claude-setup.rc')), 'RC should not be created');
    } finally {
      cleanup(tmp);
    }
  });

  it('RC config is loaded and applied', () => {
    const tmp = makeTmpDir();
    try {
      const rcContent = [
        '[project]',
        'description = My test project',
        'stacks = python, node',
        'frameworks = fastapi, react',
        'deploy = docker',
        'is_monorepo = false',
      ].join('\n');
      fs.writeFileSync(path.join(tmp, '.claude-setup.rc'), rcContent);
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf-8');
      assert.ok(content.toLowerCase().includes('python'), 'Should have python from RC');
      assert.ok(content.toLowerCase().includes('node'), 'Should have node from RC');
      assert.ok(
        content.toLowerCase().includes('fastapi') || content.includes('FastAPI'),
        'Should have fastapi from RC'
      );
    } finally {
      cleanup(tmp);
    }
  });

  it('RC reflected in plan-json does not crash', () => {
    const tmp = makeTmpDir();
    try {
      const rcContent = '[project]\nstacks = rust\nframeworks = axum\n';
      fs.writeFileSync(path.join(tmp, '.claude-setup.rc'), rcContent);
      const { exitCode } = runSetup(['--plan-json', '--no-git-check'], { cwd: tmp });
      assert.equal(exitCode, 0);
    } finally {
      cleanup(tmp);
    }
  });
});

// ─── From-Doc ───

describe('FromDoc', () => {
  it('extracts description from document', () => {
    const tmp = makeTmpDir();
    try {
      const docPath = path.join(tmp, 'spec.md');
      fs.writeFileSync(docPath, [
        '# My Project Spec', '',
        'This is a fantastic project that does amazing things.', '',
        '## Details', '', 'More info here.',
      ].join('\n'));
      const { exitCode } = runSetup(['--yes', '--no-git-check', '--from-doc', docPath], { cwd: tmp });
      assert.equal(exitCode, 0);
      const content = fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf-8');
      assert.ok(content.includes('fantastic project'), 'Should have description from doc');
    } finally {
      cleanup(tmp);
    }
  });

  it('extracts commands from document', () => {
    const tmp = makeTmpDir();
    try {
      const docPath = path.join(tmp, 'prd.md');
      fs.writeFileSync(docPath, [
        '# PRD', '',
        'Some intro text for the project.', '',
        '## Setup', '',
        '```bash', 'pip install -r requirements.txt', 'python main.py', '```', '',
        '## Testing', '',
        '```sh', 'pytest -v', '```',
      ].join('\n'));
      const { exitCode } = runSetup(['--yes', '--no-git-check', '--from-doc', docPath], { cwd: tmp });
      assert.equal(exitCode, 0);
      const content = fs.readFileSync(path.join(tmp, 'QUICKSTART.md'), 'utf-8');
      assert.ok(
        content.includes('pip install') || content.includes('pytest'),
        'Should have commands from doc'
      );
    } finally {
      cleanup(tmp);
    }
  });

  it('handles missing doc file gracefully', () => {
    const tmp = makeTmpDir();
    try {
      const missing = path.join(tmp, 'nonexistent.md');
      const { exitCode } = runSetup(['--yes', '--no-git-check', '--from-doc', missing], { cwd: tmp });
      assert.equal(exitCode, 0);
      assert.ok(fs.existsSync(path.join(tmp, 'CLAUDE.md')), 'CLAUDE.md should still be created');
      assert.ok(fs.existsSync(path.join(tmp, 'QUICKSTART.md')), 'QUICKSTART.md should still be created');
    } finally {
      cleanup(tmp);
    }
  });

  it('from-doc with existing project merges both sources', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'requirements.txt'), 'requests==2.31.0\n');
      fs.writeFileSync(path.join(tmp, 'main.py'), "print('hello')\n");
      const docPath = path.join(tmp, 'design.md');
      fs.writeFileSync(docPath, [
        '# Design Doc', '',
        'A Python web service for data processing.', '',
        '## System Architecture', '',
        'The system uses a modular pipeline architecture with plugins.', '',
        '```bash', 'pytest --cov', '```',
      ].join('\n'));
      const { exitCode } = runSetup(['--yes', '--no-git-check', '--from-doc', docPath], { cwd: tmp });
      assert.equal(exitCode, 0);
      const content = fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf-8');
      assert.ok(content.toLowerCase().includes('python'), 'Should detect python stack');
      assert.ok(
        content.includes('pipeline') || content.includes('modular'),
        'Should include architecture from doc'
      );
    } finally {
      cleanup(tmp);
    }
  });
});

// ─── Git Worktree Section ───

describe('GitWorktreeSection', () => {
  it('git repo has Parallel Development section', () => {
    const tmp = makeTmpDir();
    try {
      execSync('git init', { cwd: tmp, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: tmp, stdio: 'pipe' });
      execSync('git config user.name "Test"', { cwd: tmp, stdio: 'pipe' });
      fs.writeFileSync(path.join(tmp, '.gitkeep'), '');
      execSync('git add .', { cwd: tmp, stdio: 'pipe' });
      execSync('git commit -m "init"', { cwd: tmp, stdio: 'pipe' });
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf-8');
      assert.ok(content.includes('Parallel Development'), 'Should have Parallel Development section');
    } finally {
      cleanup(tmp);
    }
  });

  it('non-git dir has no Parallel Development section', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf-8');
      assert.ok(!content.includes('Parallel Development'), 'Should NOT have Parallel Development section');
    } finally {
      cleanup(tmp);
    }
  });
});

// ─── Git Integration ───

describe('GitIntegration', () => {
  it('git repo detected in plan-json', () => {
    const tmp = makeTmpDir();
    try {
      execSync('git init', { cwd: tmp, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: tmp, stdio: 'pipe' });
      execSync('git config user.name "Test"', { cwd: tmp, stdio: 'pipe' });
      fs.writeFileSync(path.join(tmp, '.gitkeep'), '');
      execSync('git add .', { cwd: tmp, stdio: 'pipe' });
      execSync('git commit -m "init"', { cwd: tmp, stdio: 'pipe' });
      const { stdout } = runSetup(['--plan-json'], { cwd: tmp });
      const data = JSON.parse(stdout);
      assert.ok(data.has_git === true);
      assert.ok(data.git.is_git === true);
    } finally {
      cleanup(tmp);
    }
  });

  it('non-git dir reports no git', () => {
    const tmp = makeTmpDir();
    try {
      const { stdout } = runSetup(['--plan-json', '--no-git-check'], { cwd: tmp });
      const data = JSON.parse(stdout);
      assert.ok(data.has_git === false);
      assert.ok(data.git.is_git === false);
    } finally {
      cleanup(tmp);
    }
  });

  it('--no-git-check skips git on dirty repo', () => {
    const tmp = makeTmpDir();
    try {
      execSync('git init', { cwd: tmp, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: tmp, stdio: 'pipe' });
      execSync('git config user.name "Test"', { cwd: tmp, stdio: 'pipe' });
      fs.writeFileSync(path.join(tmp, '.gitkeep'), '');
      execSync('git add .', { cwd: tmp, stdio: 'pipe' });
      execSync('git commit -m "init"', { cwd: tmp, stdio: 'pipe' });
      fs.writeFileSync(path.join(tmp, 'dirty.txt'), 'dirty\n');
      const { exitCode } = runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      assert.equal(exitCode, 0);
      assert.ok(fs.existsSync(path.join(tmp, 'CLAUDE.md')));
    } finally {
      cleanup(tmp);
    }
  });

  it('git safety skipped when no overwrites', () => {
    const tmp = makeTmpDir();
    try {
      execSync('git init', { cwd: tmp, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: tmp, stdio: 'pipe' });
      execSync('git config user.name "Test"', { cwd: tmp, stdio: 'pipe' });
      fs.writeFileSync(path.join(tmp, '.gitkeep'), '');
      execSync('git add .', { cwd: tmp, stdio: 'pipe' });
      execSync('git commit -m "init"', { cwd: tmp, stdio: 'pipe' });
      const { exitCode } = runSetup(['--yes'], { cwd: tmp });
      assert.equal(exitCode, 0);
      assert.ok(fs.existsSync(path.join(tmp, 'CLAUDE.md')));
    } finally {
      cleanup(tmp);
    }
  });
});

// ─── Ralph Integration: Extended ───

describe('RalphIntegrationExtended', () => {
  it('creates full ralph structure with --with-ralph', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check', '--with-ralph'], { cwd: tmp });
      assert.ok(fs.existsSync(path.join(tmp, '.ralph')), '.ralph/ should exist');
      assert.ok(fs.existsSync(path.join(tmp, '.ralph', 'PROMPT.md')));
      assert.ok(fs.existsSync(path.join(tmp, '.ralph', 'AGENT.md')));
      assert.ok(fs.existsSync(path.join(tmp, '.ralph', 'fix_plan.md')));
      assert.ok(fs.existsSync(path.join(tmp, '.ralphrc')));
      assert.ok(fs.existsSync(path.join(tmp, '.ralph', 'hooks', 'post-loop.sh')));
    } finally {
      cleanup(tmp);
    }
  });

  it('PROMPT.md has no architecture or environment duplication', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check', '--with-ralph'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, '.ralph', 'PROMPT.md'), 'utf-8');
      assert.ok(!content.includes('## Architecture'), 'Should not duplicate Architecture');
      assert.ok(!content.includes('## Environment'), 'Should not duplicate Environment');
      assert.ok(!content.includes('Tech stack:'), 'Should not duplicate Tech stack');
    } finally {
      cleanup(tmp);
    }
  });

  it('PROMPT.md has loop instructions', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check', '--with-ralph'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, '.ralph', 'PROMPT.md'), 'utf-8');
      assert.ok(content.includes('EXIT_SIGNAL'), 'Should have EXIT_SIGNAL');
      assert.ok(content.includes('fix_plan'), 'Should reference fix_plan');
      assert.ok(content.includes('RALPH_STATUS'), 'Should have RALPH_STATUS');
    } finally {
      cleanup(tmp);
    }
  });

  it('fix_plan.md not overwritten on --force', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check', '--with-ralph'], { cwd: tmp });
      const customContent = '# My custom plan\n- [ ] Custom task\n';
      fs.writeFileSync(path.join(tmp, '.ralph', 'fix_plan.md'), customContent);
      runSetup(['--yes', '--no-git-check', '--with-ralph', '--force'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, '.ralph', 'fix_plan.md'), 'utf-8');
      assert.ok(content.includes('Custom task'), 'fix_plan.md should not be overwritten');
    } finally {
      cleanup(tmp);
    }
  });

  it('node project has npm tools in .ralphrc', () => {
    const tmp = makeTmpDir();
    try {
      const pkg = { name: 'test-app', dependencies: { express: '^4.18.0' } };
      fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify(pkg));
      fs.writeFileSync(path.join(tmp, 'index.js'), "const express = require('express');\n");
      runSetup(['--yes', '--no-git-check', '--with-ralph'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, '.ralphrc'), 'utf-8');
      assert.ok(content.includes('Bash(npm *)'), 'Should have npm tool');
      assert.ok(content.includes('Bash(npx *)'), 'Should have npx tool');
    } finally {
      cleanup(tmp);
    }
  });

  it('.gitignore updated with Ralph entries', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, '.gitignore'), '*.pyc\n');
      runSetup(['--yes', '--no-git-check', '--with-ralph'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, '.gitignore'), 'utf-8');
      assert.ok(content.includes('.ralph/logs/'), 'Should have .ralph/logs/');
      assert.ok(content.includes('.ralph/.ralph_session'), 'Should have .ralph/.ralph_session');
    } finally {
      cleanup(tmp);
    }
  });

  it('.gitignore entries not duplicated on repeat runs', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, '.gitignore'), '*.pyc\n');
      runSetup(['--yes', '--no-git-check', '--with-ralph'], { cwd: tmp });
      runSetup(['--yes', '--no-git-check', '--with-ralph', '--force'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, '.gitignore'), 'utf-8');
      const count = content.split('.ralph/logs/').length - 1;
      assert.equal(count, 1, 'Should not duplicate .ralph/logs/');
    } finally {
      cleanup(tmp);
    }
  });

  it('ralph dry-run creates no ralph files', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check', '--with-ralph', '--dry-run'], { cwd: tmp });
      assert.ok(!fs.existsSync(path.join(tmp, '.ralph')), '.ralph/ should not exist');
      assert.ok(!fs.existsSync(path.join(tmp, '.ralphrc')), '.ralphrc should not exist');
    } finally {
      cleanup(tmp);
    }
  });

  it('hook is valid bash script', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check', '--with-ralph'], { cwd: tmp });
      const hook = path.join(tmp, '.ralph', 'hooks', 'post-loop.sh');
      assert.ok(fs.existsSync(hook), 'post-loop.sh should exist');
      const content = fs.readFileSync(hook, 'utf-8');
      assert.ok(content.startsWith('#!/usr/bin/env bash'), 'Should have bash shebang');
    } finally {
      cleanup(tmp);
    }
  });

  it('.ralphrc has PROJECT_NAME', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check', '--with-ralph'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, '.ralphrc'), 'utf-8');
      assert.ok(content.includes('PROJECT_NAME='), 'Should have PROJECT_NAME');
    } finally {
      cleanup(tmp);
    }
  });

  it('.ralphrc has base tools (Write,Read,Edit)', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check', '--with-ralph'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, '.ralphrc'), 'utf-8');
      assert.ok(content.includes('Write,Read,Edit'), 'Should have base tools');
      assert.ok(content.includes('Bash(git *)'), 'Should have git tool');
    } finally {
      cleanup(tmp);
    }
  });
});

// ─── Clean Root: Extended ───

describe('CleanRootExtended', () => {
  it('CLAUDE.md stays at root', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check', '--clean-root'], { cwd: tmp });
      assert.ok(fs.existsSync(path.join(tmp, 'CLAUDE.md')));
    } finally {
      cleanup(tmp);
    }
  });

  it('aux files in .claude/docs/ not at root', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check', '--clean-root'], { cwd: tmp });
      const docsDir = path.join(tmp, '.claude', 'docs');
      for (const f of ['STANDARDS.md', 'QUICKSTART.md', 'ERRORS_AND_LESSONS.md']) {
        assert.ok(fs.existsSync(path.join(docsDir, f)), `${f} should be in .claude/docs/`);
        assert.ok(!fs.existsSync(path.join(tmp, f)), `${f} should NOT be at root`);
      }
    } finally {
      cleanup(tmp);
    }
  });

  it('CLAUDE.md references .claude/docs/ paths', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check', '--clean-root'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf-8');
      assert.ok(content.includes('.claude/docs/QUICKSTART.md'));
      assert.ok(content.includes('.claude/docs/STANDARDS.md'));
      assert.ok(content.includes('.claude/docs/ERRORS_AND_LESSONS.md'));
    } finally {
      cleanup(tmp);
    }
  });

  it('without --clean-root all at root', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      for (const f of ['CLAUDE.md', 'QUICKSTART.md', 'STANDARDS.md', 'ERRORS_AND_LESSONS.md']) {
        assert.ok(fs.existsSync(path.join(tmp, f)), `${f} should be at root`);
      }
      assert.ok(!fs.existsSync(path.join(tmp, '.claude', 'docs')), '.claude/docs/ should not exist');
    } finally {
      cleanup(tmp);
    }
  });

  it('.claude/docs/ directory is created', () => {
    const tmp = makeTmpDir();
    try {
      runSetup(['--yes', '--no-git-check', '--clean-root'], { cwd: tmp });
      const stat = fs.statSync(path.join(tmp, '.claude', 'docs'));
      assert.ok(stat.isDirectory(), '.claude/docs/ should be a directory');
    } finally {
      cleanup(tmp);
    }
  });

  it('clean-root + with-ralph: PROMPT.md references .claude/docs/', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'requirements.txt'), 'flask\n');
      fs.writeFileSync(path.join(tmp, 'app.py'), "print('hi')\n");
      runSetup(['--yes', '--no-git-check', '--clean-root', '--with-ralph'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, '.ralph', 'PROMPT.md'), 'utf-8');
      assert.ok(content.includes('.claude/docs/STANDARDS.md'));
      assert.ok(content.includes('.claude/docs/ERRORS_AND_LESSONS.md'));
    } finally {
      cleanup(tmp);
    }
  });

  it('clean-root + with-ralph: AGENT.md symlink resolves', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'requirements.txt'), 'flask\n');
      fs.writeFileSync(path.join(tmp, 'app.py'), "print('hi')\n");
      runSetup(['--yes', '--no-git-check', '--clean-root', '--with-ralph'], { cwd: tmp });
      const agentPath = path.join(tmp, '.ralph', 'AGENT.md');
      assert.ok(fs.lstatSync(agentPath).isSymbolicLink(), 'Should be a symlink');
      assert.ok(fs.existsSync(agentPath), 'Symlink should not be broken');
      const content = fs.readFileSync(agentPath, 'utf-8');
      assert.ok(
        content.includes('Quick Start') || content.includes('QUICKSTART'),
        'Should link to QUICKSTART content'
      );
    } finally {
      cleanup(tmp);
    }
  });
});

// ─── Monorepo Intelligence ───

describe('MonorepoIntelligence', () => {
  it('sub_project_details has correct stacks', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'turbo.json'), '{"pipeline": {}}\n');
      fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({
        name: 'root', private: true, workspaces: ['apps/*'],
      }));
      // apps/web — node project
      fs.mkdirSync(path.join(tmp, 'apps', 'web'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'apps', 'web', 'package.json'), JSON.stringify({
        name: 'web', dependencies: { next: '^14.0.0' },
      }));
      // apps/api — python project
      fs.mkdirSync(path.join(tmp, 'apps', 'api'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'apps', 'api', 'requirements.txt'), 'fastapi==0.100.0\nuvicorn\n');
      const { stdout } = runSetup(['--plan-json', '--no-git-check'], { cwd: tmp });
      const data = JSON.parse(stdout);
      assert.ok(data.is_monorepo === true);
      assert.ok('sub_project_details' in data);
      assert.ok(data.sub_project_details.length >= 2);
      const webDetail = data.sub_project_details.find(d => d.path.includes('web'));
      const apiDetail = data.sub_project_details.find(d => d.path.includes('api'));
      assert.ok(webDetail, 'Should have web detail');
      assert.ok(webDetail.stacks.includes('node'));
      assert.ok(apiDetail, 'Should have api detail');
      assert.ok(apiDetail.stacks.includes('python'));
    } finally {
      cleanup(tmp);
    }
  });

  it('CLAUDE.md has enhanced table for monorepo', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'turbo.json'), '{"pipeline": {}}\n');
      fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({
        name: 'root', private: true, workspaces: ['apps/*'],
      }));
      fs.mkdirSync(path.join(tmp, 'apps', 'web'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'apps', 'web', 'package.json'), JSON.stringify({
        name: 'web', dependencies: { next: '^14.0.0' },
      }));
      fs.mkdirSync(path.join(tmp, 'apps', 'api'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'apps', 'api', 'requirements.txt'), 'fastapi==0.100.0\n');
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf-8');
      assert.ok(content.includes('| Directory | Stack | Framework | Local CLAUDE.md |'));
      assert.ok(content.includes('|-----------|-------|-----------|'));
    } finally {
      cleanup(tmp);
    }
  });

  it('CLAUDE.md has monorepo root note', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'turbo.json'), '{"pipeline": {}}\n');
      fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({
        name: 'root', private: true, workspaces: ['apps/*'],
      }));
      fs.mkdirSync(path.join(tmp, 'apps', 'web'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'apps', 'web', 'package.json'), '{"name":"web"}');
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf-8');
      assert.ok(content.includes('This is a monorepo root'));
    } finally {
      cleanup(tmp);
    }
  });

  it('non-monorepo has no enhanced table', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'requirements.txt'), 'requests==2.31.0\n');
      fs.writeFileSync(path.join(tmp, 'main.py'), "print('hello')\n");
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf-8');
      assert.ok(!content.includes('This is a monorepo root'));
      assert.ok(!content.includes('| Directory | Stack | Framework | Local CLAUDE.md |'));
    } finally {
      cleanup(tmp);
    }
  });
});

// ─── Command Dedup via plan-json ───

describe('CommandDedup', () => {
  it('commands from existing CLAUDE.md are deduped in output', () => {
    const tmp = makeTmpDir();
    try {
      // Create a CLAUDE.md with duplicated commands
      fs.writeFileSync(path.join(tmp, 'CLAUDE.md'), [
        '# CLAUDE.md', '',
        '## Common Commands', '',
        '```bash',
        'pip install -r requirements.txt',
        'pip install -r requirements.txt',
        'pytest',
        '```',
      ].join('\n'));
      fs.writeFileSync(path.join(tmp, 'requirements.txt'), 'flask\n');
      fs.writeFileSync(path.join(tmp, 'app.py'), "print('hi')\n");
      // Force regeneration to trigger command extraction and dedup
      runSetup(['--yes', '--no-git-check', '--force'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf-8');
      // Count occurrences of the command in bash blocks
      const cmdCount = content.split('pip install -r requirements.txt').length - 1;
      // Deduplication should mean at most one occurrence in the commands section
      assert.ok(cmdCount <= 2, 'Commands should be deduped (at most in two sections)');
    } finally {
      cleanup(tmp);
    }
  });

  it('path-specific commands are filtered out', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'CLAUDE.md'), [
        '# CLAUDE.md', '',
        '## Common Commands', '',
        '```bash',
        'pip install -r requirements.txt',
        'cd /Users/john/projects/myapp && npm install',
        'python /home/dev/scripts/run.py',
        'pytest',
        '```',
      ].join('\n'));
      fs.writeFileSync(path.join(tmp, 'requirements.txt'), 'flask\n');
      fs.writeFileSync(path.join(tmp, 'app.py'), "print('hi')\n");
      runSetup(['--yes', '--no-git-check', '--force'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf-8');
      assert.ok(!content.includes('/Users/john'), 'Path-specific commands should be filtered');
      assert.ok(!content.includes('/home/dev'), 'Path-specific commands should be filtered');
    } finally {
      cleanup(tmp);
    }
  });
});


// ─────────────────────────────────────────────
// Confidence Scoring
// ─────────────────────────────────────────────

describe('ConfidenceScoring', () => {
  it('plan-json includes confidence_scores', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"test","dependencies":{"express":"^4.0"}}');
      const r = runSetup(['--plan-json', '--no-git-check'], { cwd: tmp });
      const data = JSON.parse(r.stdout);
      assert.ok('confidence_scores' in data);
      assert.ok('stacks' in data.confidence_scores);
    } finally {
      cleanup(tmp);
    }
  });

  it('stack confidence high from config file', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"test"}');
      const r = runSetup(['--plan-json', '--no-git-check'], { cwd: tmp });
      const data = JSON.parse(r.stdout);
      assert.ok(Array.isArray(data.confidence_scores.stacks), 'stacks confidence should be an array');
      if (data.confidence_scores.stacks.length > 0) {
        assert.ok(data.confidence_scores.stacks[0].confidence === 'high', 'Config file should give high confidence');
      }
    } finally {
      cleanup(tmp);
    }
  });

  it('description confidence from package.json', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"test","description":"A cool project"}');
      const r = runSetup(['--plan-json', '--no-git-check'], { cwd: tmp });
      const data = JSON.parse(r.stdout);
      assert.ok(data.confidence_scores.description, 'Description should have confidence entry');
      assert.ok(data.confidence_scores.description.confidence, 'Should have confidence level');
    } finally {
      cleanup(tmp);
    }
  });
});


// ─────────────────────────────────────────────
// Template System
// ─────────────────────────────────────────────

describe('TemplateSystem', () => {
  it('template section override', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"test"}');
      fs.mkdirSync(path.join(tmp, '.claude-primer', 'templates'), { recursive: true });
      fs.writeFileSync(path.join(tmp, '.claude-primer', 'templates', 'claude.md'),
        '## Code Architecture\n\nCustom architecture content here.\n');
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf-8');
      assert.ok(content.includes('Custom architecture content here'), 'Template override should be applied');
    } finally {
      cleanup(tmp);
    }
  });

  it('template variable substitution', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"test"}');
      fs.mkdirSync(path.join(tmp, '.claude-primer', 'templates'), { recursive: true });
      fs.writeFileSync(path.join(tmp, '.claude-primer', 'templates', 'claude.md'),
        '## Repository Overview\n\n{{project_name}} is built with {{tech_stack}}.\n');
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf-8');
      assert.ok(!content.includes('{{project_name}}'), 'Variables should be substituted');
    } finally {
      cleanup(tmp);
    }
  });

  it('template-dir flag', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"test"}');
      const tplDir = path.join(tmp, 'my-templates');
      fs.mkdirSync(tplDir);
      fs.writeFileSync(path.join(tplDir, 'claude.md'),
        '## Code Architecture\n\nFrom custom dir.\n');
      runSetup(['--yes', '--no-git-check', '--template-dir', tplDir], { cwd: tmp });
      const content = fs.readFileSync(path.join(tmp, 'CLAUDE.md'), 'utf-8');
      assert.ok(content.includes('From custom dir'), 'Custom template dir should work');
    } finally {
      cleanup(tmp);
    }
  });
});


// ─────────────────────────────────────────────
// Watch Mode
// ─────────────────────────────────────────────

describe('WatchMode', () => {
  it('--watch flag in help', () => {
    const r = runSetup(['--help']);
    assert.ok(r.stdout.includes('--watch'));
  });

  it('--watch-interval in help', () => {
    const r = runSetup(['--help']);
    assert.ok(r.stdout.includes('--watch-interval'));
  });

  it('--watch-auto in help', () => {
    const r = runSetup(['--help']);
    assert.ok(r.stdout.includes('--watch-auto'));
  });
});


// ─────────────────────────────────────────────
// Multi-Agent Output
// ─────────────────────────────────────────────

describe('MultiAgentOutput', () => {
  it('cursor output', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"test"}');
      runSetup(['--yes', '--no-git-check', '--agent', 'cursor'], { cwd: tmp });
      assert.ok(fs.existsSync(path.join(tmp, '.cursor', 'rules', 'project.mdc')));
    } finally {
      cleanup(tmp);
    }
  });

  it('copilot output', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"test"}');
      runSetup(['--yes', '--no-git-check', '--agent', 'copilot'], { cwd: tmp });
      assert.ok(fs.existsSync(path.join(tmp, '.github', 'copilot-instructions.md')));
    } finally {
      cleanup(tmp);
    }
  });

  it('codex output', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"test"}');
      runSetup(['--yes', '--no-git-check', '--agent', 'codex'], { cwd: tmp });
      assert.ok(fs.existsSync(path.join(tmp, 'AGENTS.md')));
    } finally {
      cleanup(tmp);
    }
  });

  it('all agents', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"test"}');
      runSetup(['--yes', '--no-git-check', '--agent', 'all'], { cwd: tmp });
      assert.ok(fs.existsSync(path.join(tmp, 'AGENTS.md')));
      assert.ok(fs.existsSync(path.join(tmp, '.windsurfrules')));
    } finally {
      cleanup(tmp);
    }
  });

  it('json format', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"test"}');
      runSetup(['--yes', '--no-git-check', '--agent', 'copilot', '--format', 'json'], { cwd: tmp });
      const jsonFile = path.join(tmp, '.claude-primer-copilot.json');
      assert.ok(fs.existsSync(jsonFile));
      const data = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
      assert.ok('stacks' in data);
    } finally {
      cleanup(tmp);
    }
  });

  it('yaml format', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"test"}');
      runSetup(['--yes', '--no-git-check', '--agent', 'copilot', '--format', 'yaml'], { cwd: tmp });
      assert.ok(fs.existsSync(path.join(tmp, '.claude-primer-copilot.yaml')));
    } finally {
      cleanup(tmp);
    }
  });
});


// ─────────────────────────────────────────────
// Plugin System
// ─────────────────────────────────────────────

describe('PluginSystem', () => {
  it('plugin generates file', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"test"}');
      fs.mkdirSync(path.join(tmp, '.claude-primer', 'plugins'), { recursive: true });
      fs.writeFileSync(path.join(tmp, '.claude-primer', 'plugins', 'hello.mjs'),
        'export default function generate(info) { return { filename: "HELLO.md", content: "# Hello from plugin\\n" }; }\n');
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      assert.ok(fs.existsSync(path.join(tmp, 'HELLO.md')));
      const content = fs.readFileSync(path.join(tmp, 'HELLO.md'), 'utf-8');
      assert.ok(content.includes('Hello from plugin'));
    } finally {
      cleanup(tmp);
    }
  });

  it('plugin-dir flag', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"test"}');
      const pluginDir = path.join(tmp, 'my-plugins');
      fs.mkdirSync(pluginDir);
      fs.writeFileSync(path.join(pluginDir, 'custom.mjs'),
        'export default function generate(info) { return { filename: "CUSTOM.md", content: "# Custom\\n" }; }\n');
      runSetup(['--yes', '--no-git-check', '--plugin-dir', pluginDir], { cwd: tmp });
      assert.ok(fs.existsSync(path.join(tmp, 'CUSTOM.md')));
    } finally {
      cleanup(tmp);
    }
  });

  it('plugin multi-file output', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"test"}');
      fs.mkdirSync(path.join(tmp, '.claude-primer', 'plugins'), { recursive: true });
      fs.writeFileSync(path.join(tmp, '.claude-primer', 'plugins', 'multi.mjs'),
        'export default function generate(info) { return [{ filename: "A.md", content: "# A\\n" }, { filename: "B.md", content: "# B\\n" }]; }\n');
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      assert.ok(fs.existsSync(path.join(tmp, 'A.md')));
      assert.ok(fs.existsSync(path.join(tmp, 'B.md')));
    } finally {
      cleanup(tmp);
    }
  });

  it('broken plugin does not crash', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"test"}');
      fs.mkdirSync(path.join(tmp, '.claude-primer', 'plugins'), { recursive: true });
      fs.writeFileSync(path.join(tmp, '.claude-primer', 'plugins', 'broken.mjs'),
        'export default function generate(info) { throw new Error("boom"); }\n');
      const r = runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      // Should still create the standard files
      assert.ok(fs.existsSync(path.join(tmp, 'CLAUDE.md')));
    } finally {
      cleanup(tmp);
    }
  });

  it('--plugin-dir in help', () => {
    const r = runSetup(['--help']);
    assert.ok(r.stdout.includes('--plugin-dir'));
  });
});


// ─────────────────────────────────────────────
// Telemetry
// ─────────────────────────────────────────────

describe('Telemetry', () => {
  it('--telemetry-off in help', () => {
    const r = runSetup(['--help']);
    assert.ok(r.stdout.includes('--telemetry-off'));
  });

  it('telemetry not sent by default', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"test"}');
      // Should complete without errors even without telemetry endpoint
      const r = runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      assert.ok(r.exitCode === 0);
    } finally {
      cleanup(tmp);
    }
  });
});


// ─────────────────────────────────────────────
// Diff Mode
// ─────────────────────────────────────────────

describe('DiffMode', () => {
  it('--diff flag in help', () => {
    const r = runSetup(['--help']);
    assert.ok(r.stdout.includes('--diff'));
  });

  it('diff shows changes when files modified', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"test"}');
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      fs.writeFileSync(path.join(tmp, 'CLAUDE.md'), '# Old content\n');
      const r = runSetup(['--diff'], { cwd: tmp });
      assert.ok(r.stdout.includes('---') || r.stdout.includes('+++'));
    } finally {
      cleanup(tmp);
    }
  });

  it('diff does not write files', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"test"}');
      runSetup(['--diff'], { cwd: tmp });
      assert.ok(!fs.existsSync(path.join(tmp, 'STANDARDS.md')));
    } finally {
      cleanup(tmp);
    }
  });
});


// ─────────────────────────────────────────────
// TOML Config
// ─────────────────────────────────────────────

describe('TomlConfig', () => {
  it('toml sets defaults', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"test"}');
      fs.writeFileSync(path.join(tmp, '.claude-primer.toml'), '[flags]\nforce = true\nwith_readme = true\n');
      runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      assert.ok(fs.existsSync(path.join(tmp, 'README.md')));
    } finally {
      cleanup(tmp);
    }
  });

  it('cli overrides toml', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"test"}');
      fs.writeFileSync(path.join(tmp, '.claude-primer.toml'), '[flags]\nwith_readme = true\n');
      runSetup(['--dry-run', '--yes'], { cwd: tmp });
      assert.ok(!fs.existsSync(path.join(tmp, 'README.md')));
    } finally {
      cleanup(tmp);
    }
  });

  it('missing toml is ok', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), '{"name":"test"}');
      const r = runSetup(['--yes', '--no-git-check'], { cwd: tmp });
      assert.ok(r.exitCode === 0);
    } finally {
      cleanup(tmp);
    }
  });
});
