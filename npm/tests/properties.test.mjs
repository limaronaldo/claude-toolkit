#!/usr/bin/env node
/**
 * Property-based tests for claude-primer npm port.
 * Run: node --test tests/properties.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, '..', 'index.mjs');

function runPrimer(args = [], { cwd, timeout = 30000 } = {}) {
  const cmd = `node ${SCRIPT} ${args.join(' ')}`;
  try {
    const output = execSync(cmd, { cwd, timeout, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { stdout: output, exitCode: 0 };
  } catch (e) {
    return { stdout: e.stdout || '', stderr: e.stderr || '', exitCode: e.status ?? 1 };
  }
}

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'claude-primer-prop-'));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function randomPackageJson() {
  const allDeps = [
    'express', 'react', 'vue', 'angular', 'fastify', 'koa',
    'next', 'nuxt', 'svelte', 'typescript', 'webpack', 'vite',
    'esbuild', 'rollup', 'jest', 'mocha', 'vitest', 'eslint', 'prettier',
  ];
  const count = 1 + Math.floor(Math.random() * 6);
  const shuffled = allDeps.sort(() => Math.random() - 0.5);
  const deps = {};
  for (let i = 0; i < count; i++) deps[shuffled[i]] = '^1.0.0';

  const name = Array.from({ length: 8 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('');
  const pkg = { name, version: '1.0.0', dependencies: deps };

  if (Math.random() > 0.5) {
    const scripts = {};
    if (Math.random() > 0.5) scripts.test = ['jest', 'vitest', 'mocha'][Math.floor(Math.random() * 3)];
    if (Math.random() > 0.5) scripts.build = ['tsc', 'webpack', 'vite build'][Math.floor(Math.random() * 3)];
    if (Object.keys(scripts).length) pkg.scripts = scripts;
  }
  return pkg;
}

describe('Property-based tests', () => {
  it('always generates CLAUDE.md', () => {
    for (let i = 0; i < 10; i++) {
      const tmp = makeTmpDir();
      try {
        const pkg = randomPackageJson();
        fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify(pkg));
        const r = runPrimer([tmp, '--yes', '--no-git-check']);
        assert.equal(r.exitCode, 0, `Failed for ${JSON.stringify(pkg)}: ${r.stderr}`);
        assert.ok(fs.existsSync(path.join(tmp, 'CLAUDE.md')), `No CLAUDE.md for ${pkg.name}`);
      } finally {
        cleanup(tmp);
      }
    }
  });

  it('--plan-json always returns valid JSON', () => {
    for (let i = 0; i < 10; i++) {
      const tmp = makeTmpDir();
      try {
        const pkg = randomPackageJson();
        fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify(pkg));
        const r = runPrimer([tmp, '--plan-json', '--no-git-check']);
        assert.equal(r.exitCode, 0, `Failed for ${pkg.name}: ${r.stderr}`);
        const data = JSON.parse(r.stdout);
        assert.ok('stacks' in data);
        assert.ok('tier' in data);
        assert.ok('frameworks' in data);
      } finally {
        cleanup(tmp);
      }
    }
  });

  it('--force skips unchanged files', () => {
    for (let i = 0; i < 5; i++) {
      const tmp = makeTmpDir();
      try {
        const pkg = randomPackageJson();
        fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify(pkg));
        runPrimer([tmp, '--yes', '--no-git-check']);
        const r = runPrimer([tmp, '--yes', '--no-git-check', '--force']);
        assert.equal(r.exitCode, 0, `Failed for ${pkg.name}: ${r.stderr}`);
        assert.ok(r.stdout.includes('SKIP'), `Expected SKIP in output for ${pkg.name}`);
      } finally {
        cleanup(tmp);
      }
    }
  });

  it('--diff never crashes', () => {
    for (let i = 0; i < 10; i++) {
      const tmp = makeTmpDir();
      try {
        const pkg = randomPackageJson();
        fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify(pkg));
        if (Math.random() > 0.5) runPrimer([tmp, '--yes', '--no-git-check']);
        const r = runPrimer([tmp, '--diff', '--no-git-check']);
        assert.equal(r.exitCode, 0, `--diff crashed for ${pkg.name}: ${r.stderr}`);
      } finally {
        cleanup(tmp);
      }
    }
  });

  it('--dry-run writes nothing', () => {
    for (let i = 0; i < 10; i++) {
      const tmp = makeTmpDir();
      try {
        const pkg = randomPackageJson();
        fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify(pkg));
        const before = new Set(fs.readdirSync(tmp));
        runPrimer([tmp, '--dry-run', '--yes', '--no-git-check']);
        const after = new Set(fs.readdirSync(tmp));
        const diff = [...after].filter(x => !before.has(x));
        assert.equal(diff.length, 0, `--dry-run created files: ${diff.join(', ')}`);
      } finally {
        cleanup(tmp);
      }
    }
  });
});

describe('v1.8.0 features', () => {
  it('--check passes on fresh generation', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'test', version: '1.0.0', dependencies: { express: '^4.0.0' } }));
      runPrimer([tmp, '--yes', '--no-git-check']);
      const r = runPrimer([tmp, '--check', '--no-git-check']);
      assert.equal(r.exitCode, 0, `--check failed on fresh docs: ${r.stdout}`);
      assert.ok(r.stdout.includes('All files up-to-date'));
    } finally {
      cleanup(tmp);
    }
  });

  it('--check fails when docs are stale', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'test', version: '1.0.0', dependencies: { express: '^4.0.0' } }));
      runPrimer([tmp, '--yes', '--no-git-check']);
      // Add a new dependency to make docs stale
      fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'test', version: '2.0.0', dependencies: { express: '^4.0.0', react: '^18.0.0' } }));
      const r = runPrimer([tmp, '--check', '--no-git-check']);
      assert.equal(r.exitCode, 1, '--check should fail when docs are stale');
    } finally {
      cleanup(tmp);
    }
  });

  it('--export creates markdown by default', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'test', version: '1.0.0', dependencies: { express: '^4.0.0' } }));
      runPrimer([tmp, '--yes', '--no-git-check']);
      const out = path.join(tmp, 'out.md');
      const r = runPrimer([tmp, '--export', out, '--no-git-check']);
      assert.equal(r.exitCode, 0, `--export failed: ${r.stderr}`);
      assert.ok(fs.existsSync(out), 'Export file not created');
      const content = fs.readFileSync(out, 'utf-8');
      assert.ok(content.includes('<!-- FILE: CLAUDE.md -->'));
    } finally {
      cleanup(tmp);
    }
  });

  it('--export reports nothing for empty project', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'bare', version: '1.0.0' }));
      const out = path.join(tmp, 'out.md');
      const r = runPrimer([tmp, '--export', out, '--no-git-check']);
      assert.equal(r.exitCode, 0);
      assert.ok(r.stdout.includes('No generated files'));
    } finally {
      cleanup(tmp);
    }
  });

  it('--migrate converts rc to toml', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, '.claude-setup.rc'), '[project]\ndescription = test project\nstacks = node\n');
      const r = runPrimer([tmp, '--migrate', '--no-git-check']);
      assert.equal(r.exitCode, 0, `--migrate failed: ${r.stderr}`);
      assert.ok(fs.existsSync(path.join(tmp, '.claude-primer.toml')), '.claude-primer.toml not created');
    } finally {
      cleanup(tmp);
    }
  });

  it('--init --yes creates default toml', () => {
    const tmp = makeTmpDir();
    try {
      const r = runPrimer([tmp, '--init', '--yes', '--no-git-check']);
      assert.equal(r.exitCode, 0, `--init failed: ${r.stderr}`);
      assert.ok(fs.existsSync(path.join(tmp, '.claude-primer.toml')), '.claude-primer.toml not created');
    } finally {
      cleanup(tmp);
    }
  });

  it('--format json produces valid JSON', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'test', version: '1.0.0', dependencies: { express: '^4.0.0' } }));
      const r = runPrimer([tmp, '--yes', '--no-git-check', '--format', 'json', '--force-all']);
      assert.equal(r.exitCode, 0, `--format json failed: ${r.stderr}`);
      const jsonFile = path.join(tmp, 'claude-primer.json');
      assert.ok(fs.existsSync(jsonFile), 'claude-primer.json not created');
      const data = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
      assert.ok(typeof data === 'object');
    } finally {
      cleanup(tmp);
    }
  });

  it('--format yaml produces YAML', () => {
    const tmp = makeTmpDir();
    try {
      fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'test', version: '1.0.0', dependencies: { express: '^4.0.0' } }));
      const r = runPrimer([tmp, '--yes', '--no-git-check', '--format', 'yaml', '--force-all']);
      assert.equal(r.exitCode, 0, `--format yaml failed: ${r.stderr}`);
      const yamlFile = path.join(tmp, 'claude-primer.yaml');
      assert.ok(fs.existsSync(yamlFile), 'claude-primer.yaml not created');
      const content = fs.readFileSync(yamlFile, 'utf-8');
      assert.ok(content.includes(':'), 'YAML should contain key: value pairs');
    } finally {
      cleanup(tmp);
    }
  });
});
