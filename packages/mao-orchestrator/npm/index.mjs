#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLUGIN_DIR = path.join(__dirname, "plugin");
const VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf-8")).version;

const AGENTS = [
  "mao-architect.md",
  "mao-orchestrator.md",
  "mao-implementer.md",
  "mao-worker.md",
  "mao-verifier.md",
  "mao-reviewer.md",
  "mao-reflector.md",
  "mao-explorer.md",
];

const COMMANDS = [
  "mao.md",
  "mao-plan.md",
  "mao-status.md",
];

const SKILLS = [
  "multi-agent-orchestrator",
  "mao-plan",
  "mao-worktree",
  "mao-tdd",
  "mao-review",
];

const HOOKS = [
  "pre-commit-tdd.sh",
  "post-task-review.sh",
  "pre-merge-verify.sh",
];

const RULES = [
  "cost-discipline.md",
  "worktree-hygiene.md",
  "commit-format.md",
];

// ── Helpers ──

function info(msg) { console.log(`  \x1b[32m✓\x1b[0m ${msg}`); }
function warn(msg) { console.log(`  \x1b[33m!\x1b[0m ${msg}`); }
function error(msg) { console.error(`  \x1b[31m✗\x1b[0m ${msg}`); }

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function symlinkSafe(target, linkPath) {
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  try { fs.unlinkSync(linkPath); } catch {}
  fs.symlinkSync(target, linkPath);
}

// ── Commands ──

function cmdInit(global) {
  console.log(`\n  MAO — Multi-Agent Orchestrator v${VERSION}\n`);

  if (!fs.existsSync(PLUGIN_DIR)) {
    error("Plugin files not found. Reinstall: npm install -g mao-orchestrator");
    process.exit(1);
  }

  if (global) {
    const home = process.env.HOME || process.env.USERPROFILE;
    const claudeDir = path.join(home, ".claude");
    const commandsDir = path.join(claudeDir, "commands");
    const agentsDir = path.join(claudeDir, "agents");

    fs.mkdirSync(commandsDir, { recursive: true });
    fs.mkdirSync(agentsDir, { recursive: true });

    // Symlink commands
    for (const cmd of COMMANDS) {
      const src = path.join(PLUGIN_DIR, "commands", cmd);
      const dest = path.join(commandsDir, cmd);
      symlinkSafe(src, dest);
    }
    info(`${COMMANDS.length} commands → ${commandsDir}`);

    // Symlink agents
    for (const agent of AGENTS) {
      const src = path.join(PLUGIN_DIR, "agents", agent);
      const dest = path.join(agentsDir, agent);
      symlinkSafe(src, dest);
    }
    info(`${AGENTS.length} agents → ${agentsDir}`);

    // Symlink skills
    fs.mkdirSync(path.join(claudeDir, "skills"), { recursive: true });
    for (const skill of SKILLS) {
      const skillSrc = path.join(PLUGIN_DIR, "skills", skill);
      if (fs.existsSync(skillSrc)) {
        const skillDest = path.join(claudeDir, "skills", skill);
        symlinkSafe(skillSrc, skillDest);
      }
    }
    info(`${SKILLS.length} skills → ${path.join(claudeDir, "skills")}`);

    // Symlink hooks
    const hooksDir = path.join(claudeDir, "hooks");
    fs.mkdirSync(hooksDir, { recursive: true });
    for (const hook of HOOKS) {
      const hookSrc = path.join(PLUGIN_DIR, "hooks", hook);
      if (fs.existsSync(hookSrc)) {
        const hookDest = path.join(hooksDir, hook);
        symlinkSafe(hookSrc, hookDest);
      }
    }
    info(`${HOOKS.length} hooks → ${hooksDir}`);

    // Symlink rules
    const rulesDir = path.join(claudeDir, "rules");
    fs.mkdirSync(rulesDir, { recursive: true });
    for (const rule of RULES) {
      const ruleSrc = path.join(PLUGIN_DIR, "rules", rule);
      if (fs.existsSync(ruleSrc)) {
        const ruleDest = path.join(rulesDir, rule);
        symlinkSafe(ruleSrc, ruleDest);
      }
    }
    info(`${RULES.length} rules → ${rulesDir}`);

    console.log(`\n  Installed globally. Commands available in all Claude Code sessions.\n`);
  } else {
    const target = process.cwd();
    const claudeDir = path.join(target, ".claude");
    const commandsDir = path.join(claudeDir, "commands");
    const agentsDir = path.join(claudeDir, "agents");

    // Copy commands
    fs.mkdirSync(commandsDir, { recursive: true });
    for (const cmd of COMMANDS) {
      fs.copyFileSync(
        path.join(PLUGIN_DIR, "commands", cmd),
        path.join(commandsDir, cmd)
      );
    }
    info(`${COMMANDS.length} commands → ${commandsDir}`);

    // Copy agents
    fs.mkdirSync(agentsDir, { recursive: true });
    for (const agent of AGENTS) {
      fs.copyFileSync(
        path.join(PLUGIN_DIR, "agents", agent),
        path.join(agentsDir, agent)
      );
    }
    info(`${AGENTS.length} agents → ${agentsDir}`);

    // Copy skills
    for (const skill of SKILLS) {
      const skillSrc = path.join(PLUGIN_DIR, "skills", skill);
      if (fs.existsSync(skillSrc)) {
        const skillDest = path.join(claudeDir, "skills", skill);
        copyDir(skillSrc, skillDest);
      }
    }
    info(`${SKILLS.length} skills → ${path.join(claudeDir, "skills")}`);

    // Copy hooks
    const hooksDir = path.join(claudeDir, "hooks");
    fs.mkdirSync(hooksDir, { recursive: true });
    for (const hook of HOOKS) {
      const hookSrc = path.join(PLUGIN_DIR, "hooks", hook);
      if (fs.existsSync(hookSrc)) {
        fs.copyFileSync(hookSrc, path.join(hooksDir, hook));
      }
    }
    info(`${HOOKS.length} hooks → ${hooksDir}`);

    // Copy rules
    const rulesDir = path.join(claudeDir, "rules");
    fs.mkdirSync(rulesDir, { recursive: true });
    for (const rule of RULES) {
      const ruleSrc = path.join(PLUGIN_DIR, "rules", rule);
      if (fs.existsSync(ruleSrc)) {
        fs.copyFileSync(ruleSrc, path.join(rulesDir, rule));
      }
    }
    info(`${RULES.length} rules → ${rulesDir}`);

    // Add .orchestrator/ to .gitignore
    const gitignore = path.join(target, ".gitignore");
    if (fs.existsSync(gitignore)) {
      const content = fs.readFileSync(gitignore, "utf-8");
      if (!content.includes(".orchestrator/")) {
        fs.appendFileSync(gitignore, "\n.orchestrator/\n");
        info("Added .orchestrator/ to .gitignore");
      }
    }

    console.log(`\n  Installed to ${claudeDir}. Commands available in this project.\n`);
  }
}

function cmdStatus() {
  console.log(`\n  MAO — Multi-Agent Orchestrator v${VERSION}\n`);

  const home = process.env.HOME || process.env.USERPROFILE;
  const locations = [
    { label: "Global", dir: path.join(home, ".claude") },
    { label: "Local", dir: path.join(process.cwd(), ".claude") },
  ];

  for (const { label, dir } of locations) {
    const cmds = COMMANDS.filter(c => fs.existsSync(path.join(dir, "commands", c)));
    const agents = AGENTS.filter(a => fs.existsSync(path.join(dir, "agents", a)));
    const skillCount = SKILLS.filter(s => fs.existsSync(path.join(dir, "skills", s, "SKILL.md"))).length;
    const hookCount = HOOKS.filter(h => fs.existsSync(path.join(dir, "hooks", h))).length;
    const ruleCount = RULES.filter(r => fs.existsSync(path.join(dir, "rules", r))).length;

    if (cmds.length || agents.length || skillCount) {
      info(`${label}: ${cmds.length} commands, ${agents.length} agents, ${skillCount} skills, ${hookCount} hooks, ${ruleCount} rules`);
    } else {
      warn(`${label}: not installed`);
    }
  }
  console.log();
}

function cmdUninstall() {
  console.log(`\n  MAO — Uninstalling...\n`);

  const target = process.cwd();
  const claudeDir = path.join(target, ".claude");
  let removed = 0;

  for (const cmd of COMMANDS) {
    const p = path.join(claudeDir, "commands", cmd);
    if (fs.existsSync(p)) { fs.unlinkSync(p); removed++; }
  }
  for (const agent of AGENTS) {
    const p = path.join(claudeDir, "agents", agent);
    if (fs.existsSync(p)) { fs.unlinkSync(p); removed++; }
  }
  for (const skill of SKILLS) {
    const skillDir = path.join(claudeDir, "skills", skill);
    if (fs.existsSync(skillDir)) {
      fs.rmSync(skillDir, { recursive: true });
      removed++;
    }
  }
  for (const hook of HOOKS) {
    const p = path.join(claudeDir, "hooks", hook);
    if (fs.existsSync(p)) { fs.unlinkSync(p); removed++; }
  }
  for (const rule of RULES) {
    const p = path.join(claudeDir, "rules", rule);
    if (fs.existsSync(p)) { fs.unlinkSync(p); removed++; }
  }

  if (removed) {
    info(`Removed ${removed} items from ${claudeDir}`);
  } else {
    warn("Nothing to remove (MAO not installed in this project)");
  }
  console.log();
}

function cmdValidate(graphPath) {
  const file = graphPath || path.join(process.cwd(), ".orchestrator", "state", "task-graph.json");

  if (!fs.existsSync(file)) {
    warn(`No task graph found at ${file}`);
    process.exit(0);
  }

  try {
    const data = JSON.parse(fs.readFileSync(file, "utf-8"));
    const errors = [];

    if (!data.tasks || !Array.isArray(data.tasks)) errors.push("Missing or invalid 'tasks' array");
    if (!data.dag_waves) errors.push("Missing 'dag_waves'");
    if (!data.config) errors.push("Missing 'config'");

    if (data.tasks) {
      const ids = new Set(data.tasks.map(t => t.id));
      for (const task of data.tasks) {
        if (!task.id) errors.push(`Task missing 'id'`);
        if (!task.model) errors.push(`Task ${task.id || "?"} missing 'model'`);
        if (!task.deps) errors.push(`Task ${task.id || "?"} missing 'deps'`);
        if (task.deps) {
          for (const dep of task.deps) {
            if (!ids.has(dep)) errors.push(`Task ${task.id} depends on unknown task ${dep}`);
          }
        }
      }

      // Cycle detection (Kahn's algorithm)
      const inDeg = {};
      const adj = {};
      for (const t of data.tasks) {
        inDeg[t.id] = 0;
        adj[t.id] = [];
      }
      for (const t of data.tasks) {
        for (const d of (t.deps || [])) {
          if (adj[d]) adj[d].push(t.id);
          inDeg[t.id] = (inDeg[t.id] || 0) + 1;
        }
      }
      const queue = Object.keys(inDeg).filter(k => inDeg[k] === 0);
      let visited = 0;
      while (queue.length) {
        const node = queue.shift();
        visited++;
        for (const next of (adj[node] || [])) {
          inDeg[next]--;
          if (inDeg[next] === 0) queue.push(next);
        }
      }
      if (visited !== data.tasks.length) errors.push("DAG contains a cycle");
    }

    if (errors.length) {
      error("Validation failed:");
      for (const e of errors) error(`  ${e}`);
      process.exit(1);
    }

    info(`Valid task graph: ${data.tasks.length} tasks, ${(data.dag_waves || []).length} waves`);
  } catch (e) {
    error(`Invalid JSON: ${e.message}`);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
  MAO — Multi-Agent Orchestrator v${VERSION}

  Usage:
    mao-orchestrator init             Install MAO to .claude/ in current project
    mao-orchestrator init --global    Install globally to ~/.claude/ (symlinks)
    mao-orchestrator status           Show installation status
    mao-orchestrator uninstall        Remove MAO from current project
    mao-orchestrator validate [path]  Validate a task-graph.json file
    mao-orchestrator --help           Show this help
    mao-orchestrator --version        Show version

  More info: https://github.com/limaronaldo/claude-toolkit
`);
}

// ── Main ──

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case "init":
    cmdInit(args.includes("--global"));
    break;
  case "status":
    cmdStatus();
    break;
  case "uninstall":
    cmdUninstall();
    break;
  case "validate":
    cmdValidate(args[1]);
    break;
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
