// Claude Primer — VS Code Extension
// Runs claude-primer CLI commands from within VS Code.

const vscode = require("vscode");
const { execFile, exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

// ---------------------------------------------------------------------------
// Binary resolution
// ---------------------------------------------------------------------------

let resolvedBinary = null;

/**
 * Find the claude-primer binary. Checks, in order:
 *   1. "claude-primer" on PATH
 *   2. npx claude-primer
 *   3. pipx run claude-primer
 * Caches the result for the session.
 */
async function findBinary() {
  if (resolvedBinary) return resolvedBinary;

  // 1. Check PATH
  const cmd = process.platform === "win32" ? "where" : "which";
  const found = await new Promise((resolve) => {
    exec(`${cmd} claude-primer`, (err, stdout) => {
      resolve(!err && stdout.trim() ? stdout.trim().split("\n")[0] : null);
    });
  });
  if (found) {
    resolvedBinary = { cmd: found, args: [] };
    return resolvedBinary;
  }

  // 2. Try npx
  const npxOk = await new Promise((resolve) => {
    exec("npx --yes claude-primer --help", { timeout: 30000 }, (err) =>
      resolve(!err)
    );
  });
  if (npxOk) {
    resolvedBinary = { cmd: "npx", args: ["--yes", "claude-primer"] };
    return resolvedBinary;
  }

  // 3. Try pipx
  const pipxOk = await new Promise((resolve) => {
    exec("pipx run claude-primer --help", { timeout: 30000 }, (err) =>
      resolve(!err)
    );
  });
  if (pipxOk) {
    resolvedBinary = { cmd: "pipx", args: ["run", "claude-primer"] };
    return resolvedBinary;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getWorkspaceFolder() {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showErrorMessage(
      "Claude Primer: No workspace folder is open."
    );
    return null;
  }
  return folders[0].uri.fsPath;
}

/**
 * Run claude-primer with the given extra args and stream output to the channel.
 * Returns { code, stdout, stderr }.
 */
function runPrimer(channel, cwd, extraArgs) {
  return new Promise(async (resolve, reject) => {
    const bin = await findBinary();
    if (!bin) {
      const msg =
        "claude-primer not found. Install it with: pip install claude-primer";
      channel.appendLine(msg);
      vscode.window.showErrorMessage(msg);
      return reject(new Error(msg));
    }

    const allArgs = [...bin.args, ...extraArgs];
    channel.appendLine(`> ${bin.cmd} ${allArgs.join(" ")}`);
    channel.show(true);

    const child = execFile(bin.cmd, allArgs, {
      cwd,
      maxBuffer: 10 * 1024 * 1024,
      timeout: 120000,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data;
      channel.append(data.toString());
    });

    child.stderr.on("data", (data) => {
      stderr += data;
      channel.append(data.toString());
    });

    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });

    child.on("error", (err) => {
      reject(err);
    });
  });
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/** claude-primer.run — full generation */
async function cmdRun(channel) {
  const cwd = getWorkspaceFolder();
  if (!cwd) return;
  try {
    const { code } = await runPrimer(channel, cwd, [
      ".",
      "--yes",
      "--git-mode",
      "skip",
    ]);
    if (code === 0) {
      vscode.window.showInformationMessage(
        "Claude Primer: Generation complete."
      );
    } else {
      vscode.window.showWarningMessage(
        `Claude Primer exited with code ${code}.`
      );
    }
  } catch (e) {
    vscode.window.showErrorMessage(`Claude Primer error: ${e.message}`);
  }
}

/** claude-primer.dryRun — preview without writing */
async function cmdDryRun(channel) {
  const cwd = getWorkspaceFolder();
  if (!cwd) return;
  try {
    await runPrimer(channel, cwd, [".", "--dry-run", "--yes", "--git-mode", "skip"]);
  } catch (e) {
    vscode.window.showErrorMessage(`Claude Primer error: ${e.message}`);
  }
}

/** claude-primer.diff — show diff in VS Code diff editor */
async function cmdDiff(channel) {
  const cwd = getWorkspaceFolder();
  if (!cwd) return;
  try {
    const { code, stdout } = await runPrimer(channel, cwd, [
      ".",
      "--diff",
      "--yes",
      "--git-mode",
      "skip",
    ]);
    if (code !== 0) return;

    // Write diff output to a temp file and open it
    const tmpFile = path.join(os.tmpdir(), "claude-primer-diff.diff");
    fs.writeFileSync(tmpFile, stdout, "utf8");
    const doc = await vscode.workspace.openTextDocument(tmpFile);
    await vscode.window.showTextDocument(doc, { preview: true });
  } catch (e) {
    vscode.window.showErrorMessage(`Claude Primer error: ${e.message}`);
  }
}

/** claude-primer.planJson — show project analysis in a webview */
async function cmdPlanJson(channel) {
  const cwd = getWorkspaceFolder();
  if (!cwd) return;
  try {
    const { code, stdout } = await runPrimer(channel, cwd, [
      ".",
      "--plan-json",
      "--yes",
      "--git-mode",
      "skip",
    ]);
    if (code !== 0) return;

    let plan;
    try {
      // The JSON may be preceded by log lines; find the first '{' or '['
      const jsonStart = stdout.search(/[\[{]/);
      plan = JSON.parse(stdout.slice(jsonStart));
    } catch {
      vscode.window.showErrorMessage(
        "Claude Primer: Could not parse plan JSON."
      );
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "claudePrimerPlan",
      "Claude Primer — Plan",
      vscode.ViewColumn.One,
      { enableScripts: false }
    );

    const pretty = JSON.stringify(plan, null, 2);
    panel.webview.html = buildPlanHtml(pretty, plan);
  } catch (e) {
    vscode.window.showErrorMessage(`Claude Primer error: ${e.message}`);
  }
}

/** Build a simple HTML page for the plan webview. */
function buildPlanHtml(prettyJson, plan) {
  const projectName =
    plan.project_name || plan.projectName || plan.name || "Project";
  const language =
    plan.primary_language || plan.primaryLanguage || plan.language || "";
  const frameworks = Array.isArray(plan.frameworks)
    ? plan.frameworks.join(", ")
    : plan.frameworks || "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: var(--vscode-editor-font-family, monospace);
           padding: 16px; color: var(--vscode-editor-foreground);
           background: var(--vscode-editor-background); }
    h1   { font-size: 1.4em; margin-bottom: 4px; }
    .meta { opacity: 0.7; margin-bottom: 16px; }
    pre  { white-space: pre-wrap; word-wrap: break-word;
           background: var(--vscode-textBlockQuote-background, #1e1e1e);
           padding: 12px; border-radius: 4px; overflow: auto; }
  </style>
</head>
<body>
  <h1>${escapeHtml(projectName)}</h1>
  <div class="meta">
    ${language ? `Language: ${escapeHtml(language)}` : ""}
    ${frameworks ? ` &middot; Frameworks: ${escapeHtml(frameworks)}` : ""}
  </div>
  <pre>${escapeHtml(prettyJson)}</pre>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** claude-primer.init — interactive config via VS Code quick-pick UI */
async function cmdInit(channel) {
  const cwd = getWorkspaceFolder();
  if (!cwd) return;

  try {
    // Gather configuration via VS Code UI
    const projectName = await vscode.window.showInputBox({
      prompt: "Project name",
      value: path.basename(cwd),
    });
    if (projectName === undefined) return; // cancelled

    const language = await vscode.window.showQuickPick(
      [
        "python",
        "javascript",
        "typescript",
        "go",
        "rust",
        "java",
        "ruby",
        "other",
      ],
      { placeHolder: "Primary language" }
    );
    if (language === undefined) return;

    const framework = await vscode.window.showInputBox({
      prompt: "Framework(s) — comma-separated, or leave blank",
      value: "",
    });
    if (framework === undefined) return;

    const withReadme = await vscode.window.showQuickPick(["No", "Yes"], {
      placeHolder: "Generate README.md?",
    });
    if (withReadme === undefined) return;

    const gitMode = await vscode.window.showQuickPick(
      ["skip", "stash", "ask"],
      { placeHolder: "Git safety mode" }
    );
    if (gitMode === undefined) return;

    // Write .claude-setup.rc in INI format matching CLI parser
    const rcPath = path.join(cwd, ".claude-setup.rc");
    const lines = [
      "# Generated by Claude Primer VS Code extension",
      "# Re-run with --reconfigure to update",
      "",
      "[project]",
      `description = ${projectName}`,
      `stacks = ${language}`,
    ];
    if (framework) lines.push(`frameworks = ${framework}`);
    fs.writeFileSync(rcPath, lines.join("\n") + "\n", "utf8");

    channel.appendLine(`Wrote config to ${rcPath}`);
    channel.appendLine(lines.join("\n"));
    channel.show(true);

    vscode.window.showInformationMessage(
      `Claude Primer: Config saved to .claude-setup.rc`
    );
  } catch (e) {
    vscode.window.showErrorMessage(`Claude Primer init error: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

function activate(context) {
  const channel = vscode.window.createOutputChannel("Claude Primer");

  context.subscriptions.push(
    vscode.commands.registerCommand("claude-primer.run", () =>
      cmdRun(channel)
    ),
    vscode.commands.registerCommand("claude-primer.dryRun", () =>
      cmdDryRun(channel)
    ),
    vscode.commands.registerCommand("claude-primer.diff", () =>
      cmdDiff(channel)
    ),
    vscode.commands.registerCommand("claude-primer.init", () =>
      cmdInit(channel)
    ),
    vscode.commands.registerCommand("claude-primer.planJson", () =>
      cmdPlanJson(channel)
    ),
    channel
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
