import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(__dirname, "..", "index.mjs");

function run(...args) {
  return execFileSync("node", [CLI, ...args], {
    encoding: "utf-8",
    timeout: 10_000,
  });
}

function runWithStatus(...args) {
  try {
    const output = execFileSync("node", [CLI, ...args], {
      encoding: "utf-8",
      timeout: 10_000,
    });
    return { output, status: 0 };
  } catch (err) {
    return { output: err.stdout || "", stderr: err.stderr || "", status: err.status };
  }
}

// ── Help & Version ──

describe("mao-orchestrator CLI", () => {
  it("shows help with no arguments", () => {
    const output = run();
    assert.match(output, /MAO — Multi-Agent Orchestrator/);
    assert.match(output, /Usage:/);
    assert.match(output, /init/);
    assert.match(output, /status/);
    assert.match(output, /uninstall/);
    assert.match(output, /validate/);
    assert.match(output, /doctor/);
  });

  it("shows help with --help", () => {
    const output = run("--help");
    assert.match(output, /MAO — Multi-Agent Orchestrator/);
    assert.match(output, /Usage:/);
  });

  it("shows help with -h", () => {
    const output = run("-h");
    assert.match(output, /Usage:/);
  });

  it("shows version with --version", () => {
    const output = run("--version");
    assert.match(output.trim(), /^\d+\.\d+\.\d+$/);
  });

  it("shows version with -v", () => {
    const output = run("-v");
    assert.match(output.trim(), /^\d+\.\d+\.\d+$/);
  });

  it("version matches package.json", () => {
    const output = run("--version").trim();
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8"));
    assert.equal(output, pkg.version);
  });

  it("exits 1 for unknown command", () => {
    const { status } = runWithStatus("nonexistent");
    assert.equal(status, 1);
  });
});

// ── Doctor ──

describe("doctor command", () => {
  it("runs and reports checks", () => {
    const output = run("doctor");
    assert.match(output, /MAO — Doctor/);
    assert.match(output, /doctor: \d+\/\d+ checks passed/);
  });

  it("checks plugin directory", () => {
    const output = run("doctor");
    assert.match(output, /Plugin directory exists/);
  });

  it("checks all agent files", () => {
    const output = run("doctor");
    assert.match(output, /mao-architect\.md/);
    assert.match(output, /mao-orchestrator\.md/);
    assert.match(output, /mao-implementer\.md/);
    assert.match(output, /mao-worker\.md/);
    assert.match(output, /mao-verifier\.md/);
    assert.match(output, /mao-reviewer\.md/);
    assert.match(output, /mao-reflector\.md/);
    assert.match(output, /mao-explorer\.md/);
  });

  it("checks all command files", () => {
    const output = run("doctor");
    assert.match(output, /mao\.md/);
    assert.match(output, /mao-plan\.md/);
    assert.match(output, /mao-status\.md/);
  });

  it("checks all skills", () => {
    const output = run("doctor");
    assert.match(output, /multi-agent-orchestrator/);
    assert.match(output, /mao-plan/);
    assert.match(output, /mao-worktree/);
    assert.match(output, /mao-tdd/);
    assert.match(output, /mao-review/);
  });

  it("checks all hooks", () => {
    const output = run("doctor");
    assert.match(output, /pre-commit-tdd\.sh/);
    assert.match(output, /post-task-review\.sh/);
    assert.match(output, /pre-merge-verify\.sh/);
  });

  it("checks all rules", () => {
    const output = run("doctor");
    assert.match(output, /cost-discipline\.md/);
    assert.match(output, /worktree-hygiene\.md/);
    assert.match(output, /commit-format\.md/);
  });

  it("checks Node.js version", () => {
    const output = run("doctor");
    assert.match(output, /Node\.js version/);
  });
});

// ── Status ──

describe("status command", () => {
  it("shows installation status", () => {
    const output = run("status");
    assert.match(output, /MAO — Multi-Agent Orchestrator/);
    // Should show Global and/or Local status
    assert.ok(
      output.includes("Global:") || output.includes("Local:"),
      "Should report global or local status"
    );
  });
});

// ── Init (local) ──

describe("init command (local)", () => {
  const tmpDir = path.join(__dirname, "..", ".test-project");

  before(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
    // Create a .gitignore so init can append to it
    fs.writeFileSync(path.join(tmpDir, ".gitignore"), "node_modules/\n");
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("installs commands, agents, skills, hooks, and rules", () => {
    const output = execFileSync("node", [CLI, "init"], {
      encoding: "utf-8",
      timeout: 15_000,
      cwd: tmpDir,
    });

    assert.match(output, /MAO — Multi-Agent Orchestrator/);
    assert.match(output, /3 commands/);
    assert.match(output, /8 agents/);
    assert.match(output, /5 skills/);
    assert.match(output, /3 hooks/);
    assert.match(output, /3 rules/);

    // Verify files exist
    const claudeDir = path.join(tmpDir, ".claude");
    assert.ok(fs.existsSync(path.join(claudeDir, "commands", "mao.md")));
    assert.ok(fs.existsSync(path.join(claudeDir, "agents", "mao-orchestrator.md")));
    assert.ok(fs.existsSync(path.join(claudeDir, "skills", "multi-agent-orchestrator", "SKILL.md")));
    assert.ok(fs.existsSync(path.join(claudeDir, "hooks", "pre-commit-tdd.sh")));
    assert.ok(fs.existsSync(path.join(claudeDir, "rules", "cost-discipline.md")));
  });

  it("adds .orchestrator/ to .gitignore", () => {
    const gitignore = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf-8");
    assert.ok(gitignore.includes(".orchestrator/"));
  });
});

// ── Uninstall ──

describe("uninstall command", () => {
  const tmpDir = path.join(__dirname, "..", ".test-uninstall");

  before(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
    // Install first
    execFileSync("node", [CLI, "init"], {
      encoding: "utf-8",
      timeout: 15_000,
      cwd: tmpDir,
    });
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("removes all installed files", () => {
    const output = execFileSync("node", [CLI, "uninstall"], {
      encoding: "utf-8",
      timeout: 10_000,
      cwd: tmpDir,
    });

    assert.match(output, /Removed \d+ items/);

    // Verify files are gone
    const claudeDir = path.join(tmpDir, ".claude");
    assert.ok(!fs.existsSync(path.join(claudeDir, "commands", "mao.md")));
    assert.ok(!fs.existsSync(path.join(claudeDir, "agents", "mao-orchestrator.md")));
    assert.ok(!fs.existsSync(path.join(claudeDir, "hooks", "pre-commit-tdd.sh")));
    assert.ok(!fs.existsSync(path.join(claudeDir, "rules", "cost-discipline.md")));
  });

  it("reports nothing to remove when already uninstalled", () => {
    const output = execFileSync("node", [CLI, "uninstall"], {
      encoding: "utf-8",
      timeout: 10_000,
      cwd: tmpDir,
    });

    assert.match(output, /Nothing to remove/);
  });
});

// ── Validate ──

describe("validate command", () => {
  const tmpDir = path.join(__dirname, "..", ".test-validate");

  before(() => {
    fs.mkdirSync(path.join(tmpDir, ".orchestrator", "state"), { recursive: true });
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("validates a correct task graph", () => {
    const graph = {
      tasks: [
        { id: "T1", name: "task1", model: "haiku", deps: [] },
        { id: "T2", name: "task2", model: "sonnet", deps: ["T1"] },
      ],
      dag_waves: [
        { wave: 1, tasks: ["T1"] },
        { wave: 2, tasks: ["T2"] },
      ],
      config: { max_parallel: 4 },
    };

    const graphPath = path.join(tmpDir, "task-graph.json");
    fs.writeFileSync(graphPath, JSON.stringify(graph));

    const output = run("validate", graphPath);
    assert.match(output, /Valid task graph: 2 tasks, 2 waves/);
  });

  it("rejects a task graph with missing deps field", () => {
    const graph = {
      tasks: [
        { id: "T1", name: "task1", model: "haiku" },
      ],
      dag_waves: [{ wave: 1, tasks: ["T1"] }],
      config: {},
    };

    const graphPath = path.join(tmpDir, "bad-graph.json");
    fs.writeFileSync(graphPath, JSON.stringify(graph));

    const { status } = runWithStatus("validate", graphPath);
    assert.equal(status, 1);
  });

  it("rejects a task graph with unknown dependency", () => {
    const graph = {
      tasks: [
        { id: "T1", name: "task1", model: "haiku", deps: ["T99"] },
      ],
      dag_waves: [{ wave: 1, tasks: ["T1"] }],
      config: {},
    };

    const graphPath = path.join(tmpDir, "bad-deps.json");
    fs.writeFileSync(graphPath, JSON.stringify(graph));

    const { status } = runWithStatus("validate", graphPath);
    assert.equal(status, 1);
  });

  it("rejects a task graph with a cycle", () => {
    const graph = {
      tasks: [
        { id: "T1", name: "task1", model: "haiku", deps: ["T2"] },
        { id: "T2", name: "task2", model: "haiku", deps: ["T1"] },
      ],
      dag_waves: [{ wave: 1, tasks: ["T1", "T2"] }],
      config: {},
    };

    const graphPath = path.join(tmpDir, "cyclic.json");
    fs.writeFileSync(graphPath, JSON.stringify(graph));

    const { status } = runWithStatus("validate", graphPath);
    assert.equal(status, 1);
  });

  it("exits cleanly when no task graph exists", () => {
    const output = run("validate", path.join(tmpDir, "nonexistent.json"));
    assert.match(output, /No task graph found/);
  });

  it("rejects invalid JSON", () => {
    const graphPath = path.join(tmpDir, "invalid.json");
    fs.writeFileSync(graphPath, "{ not valid json");

    const { status } = runWithStatus("validate", graphPath);
    assert.equal(status, 1);
  });
});
