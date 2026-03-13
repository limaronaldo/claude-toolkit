import { describe, it } from "node:test";
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

// ── Help ──

describe("claude-toolkit help", () => {
  it("shows help with no arguments", () => {
    const output = run();
    assert.match(output, /Claude Toolkit/);
    assert.match(output, /Usage:/);
    assert.match(output, /init/);
    assert.match(output, /doctor/);
    assert.match(output, /primer/);
    assert.match(output, /mao/);
  });

  it("shows help with --help", () => {
    const output = run("--help");
    assert.match(output, /Claude Toolkit/);
    assert.match(output, /Usage:/);
  });

  it("shows help with -h", () => {
    const output = run("-h");
    assert.match(output, /Usage:/);
  });

  it("help includes update command", () => {
    const output = run("--help");
    assert.match(output, /update/);
  });

  it("help includes examples section", () => {
    const output = run("--help");
    assert.match(output, /Examples:/);
  });

  it("help includes repo URL", () => {
    const output = run("--help");
    assert.match(output, /limaronaldo\/claude-toolkit/);
  });
});

// ── Version ──

describe("claude-toolkit version", () => {
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
});

// ── Unknown Command ──

describe("claude-toolkit unknown command", () => {
  it("exits 1 for unknown command", () => {
    const { status } = runWithStatus("nonexistent");
    assert.equal(status, 1);
  });

  it("shows error message for unknown command", () => {
    const { output, stderr } = runWithStatus("nonexistent");
    const combined = (output || "") + (stderr || "");
    assert.match(combined, /Unknown command/i);
  });

  it("shows help after unknown command error", () => {
    const { output } = runWithStatus("nonexistent");
    assert.match(output, /Usage:/);
  });
});

// ── Doctor ──

describe("claude-toolkit doctor", () => {
  it("runs without crashing", () => {
    const output = run("doctor");
    assert.match(output, /Health Check/);
  });

  it("shows version in doctor output", () => {
    const output = run("doctor");
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8"));
    assert.ok(output.includes(pkg.version), "Doctor output should include version");
  });

  it("checks for CLAUDE.md", () => {
    const output = run("doctor");
    assert.match(output, /CLAUDE\.md/);
  });

  it("checks for STANDARDS.md", () => {
    const output = run("doctor");
    assert.match(output, /STANDARDS\.md/);
  });

  it("checks for QUICKSTART.md", () => {
    const output = run("doctor");
    assert.match(output, /QUICKSTART\.md/);
  });

  it("checks for ERRORS_AND_LESSONS.md", () => {
    const output = run("doctor");
    assert.match(output, /ERRORS_AND_LESSONS\.md/);
  });

  it("checks for project-config.json", () => {
    const output = run("doctor");
    assert.match(output, /project-config\.json/);
  });

  it("checks MAO installation status", () => {
    const output = run("doctor");
    assert.match(output, /MAO/);
  });
});
