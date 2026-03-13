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

// ── Integration: Full Lifecycle ──

describe("integration: init → doctor → validate → uninstall lifecycle", () => {
  const tmpDir = path.join(__dirname, "..", ".test-lifecycle");

  before(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, ".gitignore"), "node_modules/\n");
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("full lifecycle runs without errors", () => {
    // Step 1: Init
    const initOutput = execFileSync("node", [CLI, "init"], {
      encoding: "utf-8", timeout: 15_000, cwd: tmpDir,
    });
    assert.match(initOutput, /3 commands/);
    assert.match(initOutput, /8 agents/);

    // Step 2: Doctor should pass after init (plugin checks)
    const doctorOutput = execFileSync("node", [CLI, "doctor"], {
      encoding: "utf-8", timeout: 10_000, cwd: tmpDir,
    });
    assert.match(doctorOutput, /doctor: \d+\/\d+ checks passed/);

    // Step 3: Validate a task graph
    const graphDir = path.join(tmpDir, ".orchestrator", "state");
    fs.mkdirSync(graphDir, { recursive: true });
    const graph = {
      tasks: [
        { id: "T1", name: "setup", model: "haiku", deps: [] },
        { id: "T2", name: "implement", model: "sonnet", deps: ["T1"] },
      ],
      dag_waves: [
        { wave: 1, tasks: ["T1"] },
        { wave: 2, tasks: ["T2"] },
      ],
      config: { quality_level: "standard", max_parallel: 4 },
    };
    const graphPath = path.join(graphDir, "task-graph.json");
    fs.writeFileSync(graphPath, JSON.stringify(graph));

    const validateOutput = execFileSync("node", [CLI, "validate", graphPath], {
      encoding: "utf-8", timeout: 10_000, cwd: tmpDir,
    });
    assert.match(validateOutput, /Valid task graph: 2 tasks, 2 waves/);

    // Step 4: Uninstall
    const uninstallOutput = execFileSync("node", [CLI, "uninstall"], {
      encoding: "utf-8", timeout: 10_000, cwd: tmpDir,
    });
    assert.match(uninstallOutput, /Removed \d+ items/);

    // Step 5: Verify files are gone
    const claudeDir = path.join(tmpDir, ".claude");
    assert.ok(!fs.existsSync(path.join(claudeDir, "commands", "mao.md")));
    assert.ok(!fs.existsSync(path.join(claudeDir, "agents", "mao-orchestrator.md")));
  });
});

// ── Integration: Installed Files Match Source ──

describe("integration: installed files match plugin source", () => {
  const tmpDir = path.join(__dirname, "..", ".test-file-match");
  const pluginDir = path.join(__dirname, "..", "plugin");

  before(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
    execFileSync("node", [CLI, "init"], {
      encoding: "utf-8", timeout: 15_000, cwd: tmpDir,
    });
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("installed agent files match source plugin files", () => {
    const agents = ["mao-orchestrator.md", "mao-implementer.md", "mao-verifier.md", "mao-worker.md"];
    for (const agent of agents) {
      const src = fs.readFileSync(path.join(pluginDir, "agents", agent), "utf-8");
      const installed = fs.readFileSync(path.join(tmpDir, ".claude", "agents", agent), "utf-8");
      assert.equal(installed, src, `Agent ${agent} content mismatch`);
    }
  });

  it("installed command files match source plugin files", () => {
    for (const cmd of ["mao.md", "mao-plan.md", "mao-status.md"]) {
      const src = fs.readFileSync(path.join(pluginDir, "commands", cmd), "utf-8");
      const installed = fs.readFileSync(path.join(tmpDir, ".claude", "commands", cmd), "utf-8");
      assert.equal(installed, src, `Command ${cmd} content mismatch`);
    }
  });

  it("installed SKILL.md files match source plugin files", () => {
    for (const skill of ["multi-agent-orchestrator", "mao-plan", "mao-tdd"]) {
      const src = fs.readFileSync(path.join(pluginDir, "skills", skill, "SKILL.md"), "utf-8");
      const installed = fs.readFileSync(path.join(tmpDir, ".claude", "skills", skill, "SKILL.md"), "utf-8");
      assert.equal(installed, src, `Skill ${skill}/SKILL.md content mismatch`);
    }
  });

  it("installed reference files include tdd-whiteboard.md and patch-protocol.md", () => {
    const refsDir = path.join(tmpDir, ".claude", "skills", "multi-agent-orchestrator", "references");
    assert.ok(fs.existsSync(path.join(refsDir, "tdd-whiteboard.md")), "tdd-whiteboard.md missing");
    assert.ok(fs.existsSync(path.join(refsDir, "patch-protocol.md")), "patch-protocol.md missing");
    assert.ok(fs.existsSync(path.join(refsDir, "model-routing.md")), "model-routing.md missing");
    assert.ok(fs.existsSync(path.join(refsDir, "self-correction.md")), "self-correction.md missing");
  });

  it("installed rule files match source plugin files", () => {
    for (const rule of ["cost-discipline.md", "worktree-hygiene.md", "commit-format.md"]) {
      const src = fs.readFileSync(path.join(pluginDir, "rules", rule), "utf-8");
      const installed = fs.readFileSync(path.join(tmpDir, ".claude", "rules", rule), "utf-8");
      assert.equal(installed, src, `Rule ${rule} content mismatch`);
    }
  });

  it("installed hook files match source plugin files", () => {
    for (const hook of ["pre-commit-tdd.sh", "post-task-review.sh", "pre-merge-verify.sh"]) {
      const src = fs.readFileSync(path.join(pluginDir, "hooks", hook), "utf-8");
      const installed = fs.readFileSync(path.join(tmpDir, ".claude", "hooks", hook), "utf-8");
      assert.equal(installed, src, `Hook ${hook} content mismatch`);
    }
  });
});

// ── Integration: Init Idempotency ──

describe("integration: init is idempotent", () => {
  const tmpDir = path.join(__dirname, "..", ".test-idempotent");

  before(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, ".gitignore"), "node_modules/\n");
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("running init twice produces the same result", () => {
    // First init
    execFileSync("node", [CLI, "init"], {
      encoding: "utf-8", timeout: 15_000, cwd: tmpDir,
    });

    // Snapshot file list
    const claudeDir = path.join(tmpDir, ".claude");
    const listFiles = (dir) => {
      const results = [];
      if (!fs.existsSync(dir)) return results;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) results.push(...listFiles(full));
        else results.push(full);
      }
      return results.sort();
    };
    const firstFiles = listFiles(claudeDir);
    const firstContents = {};
    for (const f of firstFiles) {
      firstContents[f] = fs.readFileSync(f, "utf-8");
    }

    // Second init
    execFileSync("node", [CLI, "init"], {
      encoding: "utf-8", timeout: 15_000, cwd: tmpDir,
    });

    const secondFiles = listFiles(claudeDir);
    assert.deepEqual(secondFiles, firstFiles, "File list should be identical after second init");

    for (const f of secondFiles) {
      assert.equal(
        fs.readFileSync(f, "utf-8"),
        firstContents[f],
        `File content changed after second init: ${f}`
      );
    }
  });

  it(".gitignore does not duplicate .orchestrator/ entry", () => {
    const gitignore = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf-8");
    const matches = gitignore.match(/\.orchestrator\//g);
    assert.equal(matches.length, 1, ".orchestrator/ should appear only once");
  });
});

// ── Integration: Validate with quality_level ──

describe("integration: validate with quality_level config", () => {
  const tmpDir = path.join(__dirname, "..", ".test-quality");

  before(() => {
    fs.mkdirSync(path.join(tmpDir, ".orchestrator", "state"), { recursive: true });
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("accepts task graph with quality_level: standard", () => {
    const graph = {
      tasks: [
        { id: "T1", name: "setup", model: "haiku", deps: [] },
      ],
      dag_waves: [{ wave: 1, tasks: ["T1"] }],
      config: { quality_level: "standard", max_parallel: 4 },
    };
    const graphPath = path.join(tmpDir, "standard.json");
    fs.writeFileSync(graphPath, JSON.stringify(graph));

    const output = run("validate", graphPath);
    assert.match(output, /Valid task graph: 1 tasks, 1 waves/);
  });

  it("accepts task graph with quality_level: quality", () => {
    const graph = {
      tasks: [
        { id: "T1", name: "setup", model: "sonnet", deps: [] },
        { id: "T2", name: "core", model: "opus", deps: ["T1"] },
        { id: "T3", name: "tests", model: "sonnet", deps: ["T2"] },
      ],
      dag_waves: [
        { wave: 1, tasks: ["T1"] },
        { wave: 2, tasks: ["T2"] },
        { wave: 3, tasks: ["T3"] },
      ],
      config: {
        quality_level: "quality",
        max_parallel: 4,
        max_opus_concurrent: 2,
        escalation_budget: 5,
      },
    };
    const graphPath = path.join(tmpDir, "quality.json");
    fs.writeFileSync(graphPath, JSON.stringify(graph));

    const output = run("validate", graphPath);
    assert.match(output, /Valid task graph: 3 tasks, 3 waves/);
  });

  it("accepts task graph matching template schema", () => {
    // Full template-matching graph with all fields
    const graph = {
      intent: "Test full template compliance",
      created_at: new Date().toISOString(),
      config: {
        quality_level: "standard",
        max_parallel_agents: 4,
        max_opus_concurrent: 1,
        max_retries_per_task: 2,
        escalation_budget: 3,
        max_opus_invocations: 5,
      },
      tasks: [
        {
          id: "T1",
          name: "scaffold",
          description: "Create project structure",
          complexity_score: 2,
          model: "haiku",
          deps: [],
          tools: ["Read", "Write"],
          verify: "ls -la src/",
          status: "pending",
        },
        {
          id: "T2",
          name: "implement",
          description: "Core logic",
          complexity_score: 6,
          model: "sonnet",
          deps: ["T1"],
          tools: ["Read", "Write", "Bash"],
          verify: "npm test",
          status: "pending",
        },
      ],
      dag_waves: [
        { wave: 1, tasks: ["T1"], parallel: true },
        { wave: 2, tasks: ["T2"], parallel: true },
      ],
      worktrees: {},
      escalation_log: [],
      exploration_log: [],
    };
    const graphPath = path.join(tmpDir, "full-template.json");
    fs.writeFileSync(graphPath, JSON.stringify(graph));

    const output = run("validate", graphPath);
    assert.match(output, /Valid task graph: 2 tasks, 2 waves/);
  });
});

// ── Validate Warnings ──

describe("validate warnings", () => {
  const tmpDir = path.join(__dirname, "..", ".test-validate-warnings");

  before(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeGraph(filename, tasks) {
    const graph = {
      tasks,
      dag_waves: [{ wave: 1, tasks: tasks.map(t => t.id) }],
      config: { max_parallel: 4 },
    };
    const p = path.join(tmpDir, filename);
    fs.writeFileSync(p, JSON.stringify(graph));
    return p;
  }

  it("warns when verify field looks like prose", () => {
    const graphPath = writeGraph("prose-verify.json", [
      { id: "T1", name: "task1", model: "haiku", deps: [], verify: "it should work" },
    ]);
    const output = run("validate", graphPath);
    assert.match(output, /Valid task graph/);
    assert.match(output, /Warning|verify field may not be a shell command.*it should work/);
  });

  it("does not warn when verify field is a shell command", () => {
    const graphPath = writeGraph("shell-verify.json", [
      { id: "T1", name: "task1", model: "haiku", deps: [], verify: "npm test" },
    ]);
    const output = run("validate", graphPath);
    assert.match(output, /Valid task graph/);
    assert.ok(!output.includes("verify field may not be a shell command"));
  });

  it("does not warn for verify with && operator", () => {
    const graphPath = writeGraph("and-verify.json", [
      { id: "T1", name: "task1", model: "haiku", deps: [], verify: "ls src && echo ok" },
    ]);
    const output = run("validate", graphPath);
    assert.ok(!output.includes("verify field may not be a shell command"));
  });

  it("does not warn for verify starting with common commands", () => {
    const graphPath = writeGraph("cmd-verify.json", [
      { id: "T1", name: "task1", model: "haiku", deps: [], verify: "ls -la src/" },
    ]);
    const output = run("validate", graphPath);
    assert.ok(!output.includes("verify field may not be a shell command"));
  });

  it("warns when complexity_factors.files_touched is out of range", () => {
    const graphPath = writeGraph("cf-files.json", [
      { id: "T1", name: "task1", model: "haiku", deps: [], complexity_factors: { files_touched: 5 } },
    ]);
    const output = run("validate", graphPath);
    assert.match(output, /Valid task graph/);
    assert.match(output, /files_touched = 5 is out of range \[0-2\]/);
  });

  it("warns when complexity_factors.new_logic is out of range", () => {
    const graphPath = writeGraph("cf-logic.json", [
      { id: "T1", name: "task1", model: "haiku", deps: [], complexity_factors: { new_logic: 3 } },
    ]);
    const output = run("validate", graphPath);
    assert.match(output, /new_logic = 3 is out of range \[0-2\]/);
  });

  it("warns when complexity_factors.security_risk is out of range", () => {
    const graphPath = writeGraph("cf-security.json", [
      { id: "T1", name: "task1", model: "haiku", deps: [], complexity_factors: { security_risk: 2 } },
    ]);
    const output = run("validate", graphPath);
    assert.match(output, /security_risk = 2 is out of range \[0-1\]/);
  });

  it("warns when complexity_factors.concurrency is out of range", () => {
    const graphPath = writeGraph("cf-concurrency.json", [
      { id: "T1", name: "task1", model: "haiku", deps: [], complexity_factors: { concurrency: -1 } },
    ]);
    const output = run("validate", graphPath);
    assert.match(output, /concurrency = -1 is out of range \[0-1\]/);
  });

  it("does not warn when complexity_factors are within range", () => {
    const graphPath = writeGraph("cf-ok.json", [
      { id: "T1", name: "task1", model: "haiku", deps: [], complexity_factors: { files_touched: 1, new_logic: 2, security_risk: 0, concurrency: 1 } },
    ]);
    const output = run("validate", graphPath);
    assert.ok(!output.includes("out of range"));
  });

  it("warns when model mismatches complexity_score routing (low score, non-haiku)", () => {
    const graphPath = writeGraph("score-model-low.json", [
      { id: "T1", name: "task1", model: "opus", deps: [], complexity_score: 2 },
    ]);
    const output = run("validate", graphPath);
    assert.match(output, /Valid task graph/);
    assert.match(output, /complexity_score 2 \(suggests haiku\) but model is "opus"/);
  });

  it("warns when model mismatches complexity_score routing (mid score, non-sonnet)", () => {
    const graphPath = writeGraph("score-model-mid.json", [
      { id: "T1", name: "task1", model: "haiku", deps: [], complexity_score: 5 },
    ]);
    const output = run("validate", graphPath);
    assert.match(output, /complexity_score 5 \(suggests sonnet\) but model is "haiku"/);
  });

  it("warns when model mismatches complexity_score routing (high score, non-opus)", () => {
    const graphPath = writeGraph("score-model-high.json", [
      { id: "T1", name: "task1", model: "sonnet", deps: [], complexity_score: 9 },
    ]);
    const output = run("validate", graphPath);
    assert.match(output, /complexity_score 9 \(suggests opus\) but model is "sonnet"/);
  });

  it("does not warn when model matches complexity_score routing", () => {
    const graphPath = writeGraph("score-model-ok.json", [
      { id: "T1", name: "task1", model: "haiku", deps: [], complexity_score: 2 },
      { id: "T2", name: "task2", model: "sonnet", deps: [], complexity_score: 5 },
      { id: "T3", name: "task3", model: "opus", deps: [], complexity_score: 8 },
    ]);
    const output = run("validate", graphPath);
    assert.ok(!output.includes("suggests"));
  });

  it("exits with code 0 even when warnings are present", () => {
    const graphPath = writeGraph("warnings-exit-0.json", [
      { id: "T1", name: "task1", model: "opus", deps: [], complexity_score: 1, verify: "it should work", complexity_factors: { files_touched: 99 } },
    ]);
    const { status, output } = runWithStatus("validate", graphPath);
    assert.equal(status, 0);
    assert.match(output, /Valid task graph/);
    assert.match(output, /verify field may not be a shell command/);
    assert.match(output, /out of range/);
    assert.match(output, /suggests haiku/);
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
