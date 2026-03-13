import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
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

describe("claude-toolkit CLI", () => {
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

  it("shows version with --version", () => {
    const output = run("--version");
    assert.match(output.trim(), /^\d+\.\d+\.\d+$/);
  });

  it("shows version with -v", () => {
    const output = run("-v");
    assert.match(output.trim(), /^\d+\.\d+\.\d+$/);
  });

  it("exits with error for unknown command", () => {
    assert.throws(
      () => run("nonexistent"),
      (err) => err.status === 1
    );
  });

  it("doctor runs without crashing", () => {
    const output = run("doctor");
    assert.match(output, /Health Check/);
  });
});
