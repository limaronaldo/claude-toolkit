#!/usr/bin/env node

import { execFileSync, execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf-8")).version;

// ── Helpers ──

function info(msg) { console.log(`  \x1b[32m✓\x1b[0m ${msg}`); }
function warn(msg) { console.log(`  \x1b[33m!\x1b[0m ${msg}`); }
function error(msg) { console.error(`  \x1b[31m✗\x1b[0m ${msg}`); }

function which(cmd) {
  try {
    return execSync(`which ${cmd}`, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
}

function run(cmd, args, opts = {}) {
  try {
    execFileSync(cmd, args, { stdio: "inherit", ...opts });
    return true;
  } catch {
    return false;
  }
}

function resolvePrimer() {
  // Check PATH first, then npx
  const bin = which("claude-primer");
  if (bin) return { cmd: bin, args: [] };
  return { cmd: "npx", args: ["--yes", "claude-primer"] };
}

function resolveMao() {
  const bin = which("mao-orchestrator");
  if (bin) return { cmd: bin, args: [] };
  return { cmd: "npx", args: ["--yes", "mao-orchestrator"] };
}

// ── Commands ──

function cmdInit(args) {
  console.log(`\n  Claude Toolkit v${VERSION}\n`);
  console.log("  Phase 1/2: Priming project with Claude Primer...\n");

  const primer = resolvePrimer();
  const primerArgs = [...primer.args, "--mao", "--force", "--yes", ...args];
  const primerOk = run(primer.cmd, primerArgs);

  if (!primerOk) {
    error("Claude Primer failed. Install it: npm install -g claude-primer");
    process.exit(1);
  }

  console.log("\n  Phase 2/2: Installing MAO agents, commands, and skills...\n");

  const mao = resolveMao();
  const maoArgs = [...mao.args, "init"];
  const maoOk = run(mao.cmd, maoArgs);

  if (!maoOk) {
    error("MAO installer failed. Install it: npm install -g mao-orchestrator");
    process.exit(1);
  }

  console.log("  Setup complete. You can now use /mao in Claude Code.\n");
}

function cmdDoctor() {
  console.log(`\n  Claude Toolkit v${VERSION} — Health Check\n`);

  const cwd = process.cwd();
  let healthy = true;

  // Check Primer outputs
  const primerFiles = ["CLAUDE.md", "STANDARDS.md", "QUICKSTART.md", "ERRORS_AND_LESSONS.md"];
  for (const file of primerFiles) {
    if (fs.existsSync(path.join(cwd, file))) {
      info(file);
    } else {
      warn(`${file} — missing (run: claude-toolkit init)`);
      healthy = false;
    }
  }

  // Check MAO config
  const configPath = path.join(cwd, ".claude", "project-config.json");
  if (fs.existsSync(configPath)) {
    info(".claude/project-config.json");
  } else {
    warn(".claude/project-config.json — missing (run: claude-toolkit init)");
    healthy = false;
  }

  // Check MAO agents/commands/skills
  const claudeDir = path.join(cwd, ".claude");
  const homeClaudeDir = path.join(process.env.HOME || process.env.USERPROFILE, ".claude");

  let maoFound = false;
  for (const dir of [claudeDir, homeClaudeDir]) {
    const hasCommands = fs.existsSync(path.join(dir, "commands", "mao.md"));
    const hasAgents = fs.existsSync(path.join(dir, "agents", "mao-orchestrator.md"));
    const hasSkill = fs.existsSync(path.join(dir, "skills", "multi-agent-orchestrator", "SKILL.md"));

    if (hasCommands && hasAgents && hasSkill) {
      const label = dir === homeClaudeDir ? "global" : "local";
      info(`MAO installed (${label}): commands, agents, skill`);
      maoFound = true;
      break;
    }
  }

  if (!maoFound) {
    warn("MAO not installed (run: claude-toolkit init)");
    healthy = false;
  }

  console.log();
  if (healthy) {
    info("All checks passed.\n");
  } else {
    warn("Some components missing. Run 'claude-toolkit init' to fix.\n");
  }
}

function getInstalledVersion(pkg) {
  try {
    return execSync(`npm ls -g ${pkg} --depth=0 --json 2>/dev/null`, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
  } catch { return null; }
}

function getLatestVersion(pkg) {
  try {
    return execSync(`npm view ${pkg} version 2>/dev/null`, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch { return null; }
}

function cmdUpdate() {
  console.log(`\n  Claude Toolkit v${VERSION} — Updating...\n`);

  const packages = ["claude-primer", "mao-orchestrator", "claude-supertools"];

  for (const pkg of packages) {
    const latest = getLatestVersion(pkg);
    if (!latest) {
      warn(`${pkg}: not found on npm`);
      continue;
    }
    console.log(`  Updating ${pkg} to ${latest}...`);
    run("npm", ["install", "-g", `${pkg}@latest`]);
    info(`${pkg}@${latest}`);
  }

  // Re-sync MAO assets after update
  console.log("\n  Re-syncing MAO assets...\n");
  const mao = resolveMao();
  run(mao.cmd, [...mao.args, "init", "--global"]);

  console.log();
  info("All packages updated and synced.\n");
}

function showHelp() {
  console.log(`
  Claude Toolkit v${VERSION}

  Unified CLI for Claude Code — combines Claude Primer + MAO Orchestrator.

  Usage:
    claude-toolkit init [args]    Prime project + install MAO (extra args passed to primer)
    claude-toolkit doctor         Check that all components are installed
    claude-toolkit update         Update all tools to latest versions
    claude-toolkit primer [args]  Run claude-primer with given arguments
    claude-toolkit mao [args]     Run mao-orchestrator with given arguments
    claude-toolkit --help         Show this help
    claude-toolkit --version      Show version

  Examples:
    claude-toolkit init                    # Full setup
    claude-toolkit init --agent all        # Full setup with all primer agents
    claude-toolkit doctor                  # Verify installation
    claude-toolkit primer --dry-run        # Preview primer output
    claude-toolkit mao status              # Check MAO installation

  More info: https://github.com/limaronaldo/claude-toolkit
`);
}

// ── Main ──

const args = process.argv.slice(2);
const command = args[0];
const rest = args.slice(1);

switch (command) {
  case "init":
    cmdInit(rest);
    break;
  case "doctor":
    cmdDoctor();
    break;
  case "update":
    cmdUpdate();
    break;
  case "primer": {
    const primer = resolvePrimer();
    run(primer.cmd, [...primer.args, ...rest]);
    break;
  }
  case "mao": {
    const mao = resolveMao();
    run(mao.cmd, [...mao.args, ...rest]);
    break;
  }
  case "--version":
  case "-v":
    console.log(VERSION);
    break;
  case "--help":
  case "-h":
  case undefined:
    showHelp();
    break;
  default:
    error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
}
