#!/usr/bin/env node

/**
 * claude-primer — Claude Code Knowledge Architecture Bootstrap (v4)
 *
 * Usage:
 *   claude-primer                            # current directory, interactive
 *   claude-primer /path/to/repo              # specific directory
 *   claude-primer --dry-run                  # preview without writing
 *   claude-primer --force                    # overwrite changed files (skip unchanged)
 *   claude-primer --force-all                # overwrite all files unconditionally
 *   claude-primer --yes                      # accept all defaults (no prompts)
 *   claude-primer --with-readme              # also generate README.md
 *   claude-primer --with-ralph               # generate Ralph integration files
 *   claude-primer --no-git-check             # skip git safety entirely
 *   claude-primer --plan-json                # output project analysis as JSON
 *   claude-primer --reconfigure              # re-run wizard (ignores saved .claude-setup.rc)
 *   claude-primer --clean-root               # move aux docs to .claude/docs/
 *
 * Git safety modes (--git-mode):
 *   ask          prompt before acting (default in interactive)
 *   stash        auto-stash dirty changes, no prompt
 *   skip         do nothing with git
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import readline from "readline";
import os from "os";

const __version__ = "1.5.0";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const IGNORE_DIRS = new Set([
  ".git", ".claude", "node_modules", "__pycache__", ".venv", "venv",
  "env", ".env", "dist", "build", "out", ".next", ".nuxt", "target",
  ".idea", ".vscode", ".mypy_cache", ".pytest_cache", "coverage",
  ".tox", "egg-info", ".eggs", "htmlcov",
]);

const STACK_SIGNALS = {
  python: {
    files: ["requirements.txt", "pyproject.toml", "setup.py", "setup.cfg", "Pipfile", "poetry.lock"],
    extensions: [".py"],
  },
  node: {
    files: ["package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb"],
    extensions: [".js", ".ts", ".jsx", ".tsx", ".mjs"],
  },
  rust: {
    files: ["Cargo.toml", "Cargo.lock"],
    extensions: [".rs"],
  },
  go: {
    files: ["go.mod", "go.sum"],
    extensions: [".go"],
  },
  ruby: {
    files: ["Gemfile", "Gemfile.lock", "Rakefile"],
    extensions: [".rb"],
  },
  java: {
    files: ["pom.xml", "build.gradle", "build.gradle.kts"],
    extensions: [".java", ".kt"],
  },
  php: {
    files: ["composer.json", "composer.lock"],
    extensions: [".php"],
  },
  dotnet: {
    files: [],
    extensions: [".cs", ".csproj", ".sln", ".fsproj"],
  },
  elixir: {
    files: ["mix.exs", "mix.lock"],
    extensions: [".ex", ".exs"],
  },
  swift: {
    files: ["Package.swift", "Package.resolved"],
    extensions: [".swift"],
  },
  dart: {
    files: ["pubspec.yaml", "pubspec.lock"],
    extensions: [".dart"],
  },
  zig: {
    files: ["build.zig", "build.zig.zon"],
    extensions: [".zig"],
  },
  scala: {
    files: ["build.sbt"],
    extensions: [".scala", ".sc"],
  },
};

const FRAMEWORK_SIGNALS = {
  django: ["manage.py", "django"],
  flask: ["flask"],
  fastapi: ["fastapi"],
  streamlit: ["streamlit"],
  nextjs: ["next.config.js", "next.config.mjs", "next.config.ts"],
  react: ["react"],
  vue: ["vue", "nuxt.config"],
  svelte: ["svelte", "@sveltejs"],
  sveltekit: ["@sveltejs/kit"],
  solidjs: ["solid-js", "vite-plugin-solid"],
  remix: ["@remix-run"],
  astro: ["astro"],
  express: ["express"],
  nestjs: ["@nestjs"],
  hono: ["hono"],
  axum: ["axum"],
  actix: ["actix-web"],
  rocket: ["rocket"],
  gin: ["github.com/gin-gonic/gin"],
  fiber: ["github.com/gofiber/fiber"],
  echo: ["github.com/labstack/echo"],
  phoenix: ["phoenix", "phoenix_html"],
  spring: ["org.springframework", "spring-boot"],
  laravel: ["laravel/framework"],
  flutter: ["flutter"],
};

const DEPLOY_SIGNALS = {
  docker: ["Dockerfile", "docker-compose.yml", "docker-compose.yaml", ".dockerignore"],
  vercel: ["vercel.json", ".vercel"],
  render: ["render.yaml"],
  "fly.io": ["fly.toml"],
  github_actions: [".github/workflows"],
  gitlab_ci: [".gitlab-ci.yml"],
};

const RALPH_TOOLS_BY_STACK = {
  python: "Bash(pip *),Bash(python *),Bash(pytest)",
  node: "Bash(npm *),Bash(npx *),Bash(node *)",
  rust: "Bash(cargo *)",
  go: "Bash(go *)",
  elixir: "Bash(mix *),Bash(iex *)",
  java: "Bash(mvn *),Bash(gradle *),Bash(java *)",
  php: "Bash(php *),Bash(composer *)",
  dart: "Bash(dart *),Bash(flutter *)",
  ruby: "Bash(bundle *),Bash(ruby *),Bash(rails *)",
  dotnet: "Bash(dotnet *)",
  swift: "Bash(swift *),Bash(xcodebuild *)",
  zig: "Bash(zig *)",
  scala: "Bash(sbt *),Bash(scala *)",
};

const MONOREPO_SIGNALS = {
  pnpm: ["pnpm-workspace.yaml"],
  turborepo: ["turbo.json"],
  nx: ["nx.json"],
  lerna: ["lerna.json"],
  yarn_workspaces: [],
};

const MONOREPO_DIRS = new Set(["apps", "packages", "services", "libs", "modules", "plugins", "tools"]);

const CMD_PREFIXES = [
  "pip", "npm", "npx", "node", "python", "python3", "pytest", "cargo",
  "cd ", "git ", "docker", "make", "go ", "ruby", "bundle", "rails",
  "brew", "apt", "yum", "curl", "wget", "ssh", "scp", "rsync",
  "mkdir", "cp ", "mv ", "rm ", "ls ", "cat ", "echo ", "grep",
  "playwright", "flask", "django", "uvicorn", "gunicorn", "next",
  "tsc", "eslint", "prettier", "vitest", "jest", "mocha", "pnpm",
  "turbo", "nx ", "lerna",
  "mix ", "iex", "elixir",
  "swift ", "swiftc", "xcodebuild",
  "dart ", "flutter ", "pub ",
  "zig ",
  "sbt ", "scala ",
  "go build", "go test", "go run", "go mod",
  "mvn ", "gradle", "java ", "javac",
  "php ", "composer ", "artisan",
  "dotnet ",
];

const TREE_CHARS = new Set(["├", "│", "└", "─"]);

const EXTERNAL_FRAMEWORKS = new Set([
  "django", "flask", "fastapi", "nextjs", "nestjs", "hono", "express",
  "phoenix", "spring", "laravel", "gin", "fiber", "echo", "remix",
  "astro", "rocket", "axum", "actix", "sveltekit",
]);

const RC_FILENAME = ".claude-setup.rc";

const RALPH_GITIGNORE_ENTRIES = `
# Ralph runtime files
.ralph/logs/
.ralph/.ralph_session
.ralph/.ralph_session_history
.ralph/status.json
.ralph/live.log
.ralph/docs/generated/
`;

// ─────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────

function existsSync(p) {
  try { fs.statSync(p); return true; } catch { return false; }
}

function isFileSync(p) {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

function isDirSync(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function isSymlinkBroken(p) {
  try {
    const stat = fs.lstatSync(p);
    if (!stat.isSymbolicLink()) return false;
    try { fs.statSync(p); return false; } catch { return true; }
  } catch { return false; }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nowFormatted() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function safeRead(filepath, maxChars = 50000) {
  try {
    if (!isFileSync(filepath)) return "";
    let content = fs.readFileSync(filepath, "utf-8");
    if (content.length <= maxChars) return content;
    const truncated = content.slice(0, maxChars);
    const lastHeading = truncated.lastIndexOf("\n## ");
    if (lastHeading > maxChars * 0.6) return truncated.slice(0, lastHeading);
    return truncated;
  } catch { return ""; }
}

function _mark(tag) {
  return `<!-- [${tag}] -->`;
}


function rootDocRefs(cleanRoot) {
  if (cleanRoot) {
    return {
      claude: "CLAUDE.md",
      quickstart: ".claude/docs/QUICKSTART.md",
      standards: ".claude/docs/STANDARDS.md",
      errors: ".claude/docs/ERRORS_AND_LESSONS.md",
    };
  }
  return {
    claude: "CLAUDE.md",
    quickstart: "QUICKSTART.md",
    standards: "STANDARDS.md",
    errors: "ERRORS_AND_LESSONS.md",
  };
}


function ralphDocRefs(cleanRoot) {
  if (cleanRoot) {
    return {
      claude: "../CLAUDE.md",
      quickstart: "../.claude/docs/QUICKSTART.md",
      standards: "../.claude/docs/STANDARDS.md",
      errors: "../.claude/docs/ERRORS_AND_LESSONS.md",
    };
  }
  return {
    claude: "../CLAUDE.md",
    quickstart: "../QUICKSTART.md",
    standards: "../STANDARDS.md",
    errors: "../ERRORS_AND_LESSONS.md",
  };
}

// ─────────────────────────────────────────────
// Git helpers
// ─────────────────────────────────────────────

function _git(target, ...args) {
  try {
    const result = execSync(["git", ...args].join(" "), {
      cwd: target,
      timeout: 10000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { returncode: 0, stdout: result || "" };
  } catch (e) {
    return { returncode: e.status || 1, stdout: (e.stdout || "").toString() };
  }
}

function gitCheck(target) {
  const result = {
    is_git: false, has_remote: false, branch: "",
    dirty: false, status_summary: "",
    modified_files: [], untracked_files: [],
  };

  try {
    const inside = _git(target, "rev-parse", "--is-inside-work-tree");
    if (inside.returncode !== 0 || inside.stdout.trim() !== "true") return result;

    result.is_git = true;

    let branch = _git(target, "rev-parse", "--abbrev-ref", "HEAD").stdout.trim();
    if (branch === "HEAD") {
      branch = _git(target, "rev-parse", "--short", "HEAD").stdout.trim();
    }
    result.branch = branch;

    result.has_remote = !!_git(target, "remote").stdout.trim();

    const status = _git(target, "status", "--porcelain");
    const lines = status.stdout.split("\n").filter((l) => l.trim());

    for (const line of lines) {
      if (line.startsWith("??")) {
        result.untracked_files.push(line.slice(3).trim());
      } else {
        result.modified_files.push(line.slice(3).trim());
      }
    }

    result.dirty = lines.length > 0;

    const parts = [];
    if (result.modified_files.length) parts.push(`${result.modified_files.length} modified/staged`);
    if (result.untracked_files.length) parts.push(`${result.untracked_files.length} untracked`);
    result.status_summary = parts.length ? parts.join(", ") : "clean";
  } catch {}

  return result;
}

function gitStash(target) {
  try {
    const ts = nowFormatted();
    const msg = `claude-primer safety stash (${ts})`;
    const r = _git(target, "stash", "push", "-u", "-m", `"${msg}"`);
    if (r.returncode === 0 && !r.stdout.includes("No local changes")) {
      const ref = _git(target, "stash", "list", "--max-count=1").stdout.trim();
      return ref || "stash@{0}";
    }
    return null;
  } catch { return null; }
}

function gitSelectiveCommit(target, files) {
  try {
    const ts = nowFormatted();
    const msg = `chore: backup before claude-primer (${ts})`;
    const existing = files.filter((f) => existsSync(path.join(target, f)));
    if (!existing.length) return true;

    const add = _git(target, "add", "--", ...existing);
    if (add.returncode !== 0) return false;

    const r = _git(target, "commit", "-m", `"${msg}"`, "--only", "--", ...existing);
    return r.returncode === 0;
  } catch { return false; }
}

// ─────────────────────────────────────────────
// Readline prompt helper
// ─────────────────────────────────────────────

function _safeInput(prompt, defaultVal = "") {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer || defaultVal);
    });
    rl.on("close", () => resolve(defaultVal));
    rl.on("error", () => resolve(defaultVal));
  });
}

// ─────────────────────────────────────────────
// Git safety orchestration
// ─────────────────────────────────────────────

async function runGitSafety(target, gitMode, filesToWrite, interactive) {
  const git = gitCheck(target);

  if (!git.is_git) return "no-git";

  if (!git.dirty) {
    console.log(`  Git: ${git.branch} — clean`);
    return "skipped";
  }

  console.log(`  Git: ${git.branch} — ${git.status_summary}`);

  if (gitMode === "skip") {
    console.log("  Git safety: skipped (--git-mode skip)");
    return "skipped";
  }

  if (gitMode === "stash") {
    const ref = gitStash(target);
    if (ref) {
      console.log(`  Git safety: stashed → ${ref}`);
      console.log(`  To restore: git stash pop`);
      return "stash";
    } else {
      console.log("  Git safety: stash failed, continuing anyway");
      return "skipped";
    }
  }

  // git_mode === "ask"
  if (!interactive) {
    const ref = gitStash(target);
    if (ref) {
      console.log(`  Git safety: auto-stashed → ${ref}`);
      return "stash";
    }
    return "skipped";
  }

  console.log();
  console.log("  Options:");
  console.log("    [s] Stash changes (recommended — easy to restore with git stash pop)");
  console.log("    [c] Commit only files that will be overwritten");
  console.log("    [n] Skip — continue without safety net");
  console.log("    [a] Abort — stop, change nothing");
  console.log();

  const answer = (await _safeInput("  Choice [S/c/n/a]: ", "s")).trim().toLowerCase();

  if (answer === "a" || answer === "abort") {
    console.log("\n  Aborted. No files modified.");
    return "aborted";
  }

  if (answer === "c" || answer === "commit") {
    const ok = gitSelectiveCommit(target, filesToWrite);
    if (ok) {
      console.log("  Committed backup of files that will be overwritten.");
      return "committed";
    } else {
      console.log("  Commit failed.");
      const retry = (await _safeInput("  Continue anyway? [y/N]: ", "n")).trim().toLowerCase();
      return (retry === "y" || retry === "yes" || retry === "s" || retry === "sim") ? "skipped" : "aborted";
    }
  }

  if (answer === "n" || answer === "skip") {
    console.log("  Skipping git safety.");
    return "skipped";
  }

  // Default: stash
  const ref = gitStash(target);
  if (ref) {
    console.log(`  Stashed → ${ref}`);
    console.log(`  To restore: git stash pop`);
    return "stash";
  } else {
    console.log("  Stash failed, continuing anyway.");
    return "skipped";
  }
}

// ─────────────────────────────────────────────
// Markdown section extraction
// ─────────────────────────────────────────────

function extractMdSections(content) {
  const sections = {};
  const headingStack = [];
  let currentKey = "";
  let currentLines = [];
  let inCodeBlock = false;

  function save() {
    const body = currentLines.join("\n").trim();
    if (body || currentKey) {
      sections[currentKey] = body;
    }
  }

  for (const line of content.split("\n")) {
    const stripped = line.trim();
    if (stripped.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      currentLines.push(line);
      continue;
    }

    if (inCodeBlock) {
      currentLines.push(line);
      continue;
    }

    const match = stripped.match(/^(#{1,4})\s+(.+)/);
    if (match) {
      save();
      const level = match[1].length;
      const heading = match[2].trim();

      while (headingStack.length && headingStack[headingStack.length - 1][0] >= level) {
        headingStack.pop();
      }
      headingStack.push([level, heading]);

      if (headingStack.length === 1) {
        currentKey = heading;
      } else {
        currentKey = headingStack.map((h) => h[1]).join(" > ");
      }
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  save();

  if ("" in sections && !sections[""]) {
    delete sections[""];
  }

  return sections;
}

// ─────────────────────────────────────────────
// Command dedup & ranking
// ─────────────────────────────────────────────

function dedupAndRankCommands(commands) {
  if (!commands || !commands.length) return [];

  const ABS_PATH_MARKERS = ["/Users/", "/home/", "C:\\", "/var/", "/opt/", "/tmp/"];
  const COMMIT_HASH_RE = /\b[0-9a-f]{40}\b/;
  const BARE_CD_RE = /^cd\s+\S/;

  const CATEGORIES = [
    [0, ["pip install", "npm install", "cargo build", "go mod", "mix deps",
         "bundle install", "composer install", "dotnet restore",
         "flutter pub", "dart pub"]],
    [1, ["npm run dev", "python manage.py runserver", "flask run",
         "cargo run", "go run", "mix phx.server", "uvicorn"]],
    [2, ["pytest", "npm test", "cargo test", "go test", "mix test",
         "flutter test", "dotnet test"]],
    [3, ["eslint", "prettier", "black", "ruff", "cargo fmt", "cargo clippy"]],
    [4, ["npm run build", "cargo build --release", "go build", "dotnet build"]],
    [5, ["migrate", "ecto"]],
    [6, ["deploy", "docker"]],
  ];

  // Deduplicate preserving order
  const seen = new Set();
  const unique = [];
  for (const cmd of commands) {
    if (!seen.has(cmd)) {
      seen.add(cmd);
      unique.push(cmd);
    }
  }

  // Filter
  const filtered = unique.filter((cmd) => {
    if (ABS_PATH_MARKERS.some((m) => cmd.includes(m))) return false;
    if (BARE_CD_RE.test(cmd)) return false;
    if (COMMIT_HASH_RE.test(cmd)) return false;
    return true;
  });

  // Rank
  function priority(cmd) {
    const lower = cmd.toLowerCase();
    for (const [prio, patterns] of CATEGORIES) {
      if (patterns.some((p) => lower.includes(p))) return prio;
    }
    return 99;
  }

  filtered.sort((a, b) => priority(a) - priority(b));
  return filtered;
}

// ─────────────────────────────────────────────
// Existing content reader
// ─────────────────────────────────────────────

function readExistingContent(root) {
  const ec = {
    readme_sections: {},
    claude_sections: {},
    standards_sections: {},
    errors_entries: [],
    description: "",
    architecture_notes: "",
    commands: [],
    env_notes: "",
    formatting_rules: [],
    deploy_notes: "",
    checklist_items: [],
    stakeholder_notes: "",
    data_sources: "",
    sub_project_table: "",
    sources: new Set(),
  };

  // README.md
  const readme = safeRead(path.join(root, "README.md"));
  if (readme) {
    ec.readme_sections = extractMdSections(readme);
    for (const line of readme.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("[") &&
          !trimmed.startsWith("!") && !trimmed.startsWith(">") &&
          !trimmed.startsWith("|") && !trimmed.startsWith("```") &&
          !trimmed.startsWith("---") && !trimmed.startsWith("*")) {
        ec.description = trimmed.slice(0, 300);
        ec.sources.add("README.md");
        break;
      }
    }
  }

  // CLAUDE.md
  const claude = safeRead(path.join(root, "CLAUDE.md"));
  if (claude) {
    const sections = extractMdSections(claude);
    ec.claude_sections = sections;

    const isSelfGenerated = claude.slice(0, 500).includes("generated_by:") &&
      ["claude-primer", "super-claude"].some((marker) => claude.slice(0, 500).includes(marker));

    const SELF_SECTIONS = new Set([
      "routing rules", "invariants", "decision heuristics",
      "verification standard", "red flags", "stuck protocol",
      "pre-task protocol", "post-task", "key decisions",
      "active risks", "parallel development", "provenance",
      "repository overview", "document information",
      "environment", "common commands", "code architecture",
      "formatting standards",
    ]);

    // Global command extraction
    const bashBlockRe = /```(?:bash|sh|cmd)?\n([\s\S]*?)```/g;
    let bashMatch;
    while ((bashMatch = bashBlockRe.exec(claude)) !== null) {
      for (const line of bashMatch[1].trim().split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        if ([...TREE_CHARS].some((c) => trimmed.includes(c))) continue;
        if (CMD_PREFIXES.some((p) => trimmed.toLowerCase().startsWith(p))) {
          ec.commands.push(trimmed);
        }
      }
    }
    ec.commands = dedupAndRankCommands(ec.commands);
    if (ec.commands.length) ec.sources.add("CLAUDE.md:commands");

    for (const [key, body] of Object.entries(sections)) {
      const kl = key.toLowerCase();

      if (isSelfGenerated && [...SELF_SECTIONS].some((s) => kl.includes(s))) continue;
      if (body.includes("<!-- [placeholder] -->") && body.trim().startsWith("<!-- [")) continue;

      if (["architect", "code architect", "data flow", "pattern"].some((w) => kl.includes(w))) {
        if (ec.architecture_notes) {
          ec.architecture_notes += `\n\n**${key}:**\n${body.slice(0, 2000)}`;
        } else {
          ec.architecture_notes = body.slice(0, 3000);
        }
        ec.sources.add("CLAUDE.md:architecture");
      }

      if (["environment", "env"].some((w) => kl.includes(w)) &&
          !["virtual", "venv"].some((w) => kl.includes(w))) {
        if (!ec.env_notes) {
          ec.env_notes = body.slice(0, 1000);
          ec.sources.add("CLAUDE.md:environment");
        }
      }

      if (kl.includes("format")) {
        for (const line of body.split("\n")) {
          const trimmed = line.trim();
          if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            ec.formatting_rules.push(trimmed.slice(2).trim());
          }
        }
        if (ec.formatting_rules.length) ec.sources.add("CLAUDE.md:formatting");
      }

      if (["deploy", "application"].some((w) => kl.includes(w))) {
        ec.deploy_notes = body.slice(0, 1500);
        ec.sources.add("CLAUDE.md:deploy");
      }

      if (["checklist", "pre-"].some((w) => kl.includes(w))) {
        for (const line of body.split("\n")) {
          const trimmed = line.trim();
          if (trimmed.startsWith("- [")) {
            ec.checklist_items.push(trimmed);
          }
        }
        if (ec.checklist_items.length) ec.sources.add("CLAUDE.md:checklist");
      }

      if (["stakeholder", "working with"].some((w) => kl.includes(w))) {
        ec.stakeholder_notes = body.slice(0, 1000);
        ec.sources.add("CLAUDE.md:stakeholders");
      }

      if (kl.includes("data source") || (kl.includes("data") && body.toLowerCase().includes("column"))) {
        ec.data_sources = body.slice(0, 2000);
        ec.sources.add("CLAUDE.md:data-sources");
      }

      if (["subdirectory", "sub-project", "routing"].some((w) => kl.includes(w))) {
        ec.sub_project_table = body.slice(0, 2000);
        ec.sources.add("CLAUDE.md:routing");
      }
    }
  }

  // STANDARDS.md
  const standards = safeRead(path.join(root, "STANDARDS.md"));
  if (standards) {
    const isSelfStandards = ["claude-primer", "super-claude"].some((marker) => standards.slice(0, 300).includes(marker));
    if (!isSelfStandards) {
      ec.standards_sections = extractMdSections(standards);
      if (Object.keys(ec.standards_sections).length >= 4) {
        ec.sources.add("STANDARDS.md");
      }
    }
  }

  // Error catalog
  for (const errFile of ["ERRORS_AND_LESSONS.md", "ERROS_E_ACERTOS.md", "analysis/ERROS_E_ACERTOS.md"]) {
    const err = safeRead(path.join(root, errFile));
    if (err) {
      if (err.toLowerCase().includes("replace with real entries") || err.includes("(template)")) break;
      const errClean = err.replace(/```[\s\S]*?```/g, "");
      const entries = errClean.match(/###\s+(.+?)(?=\n###|\Z)/gs) || [];
      for (let e of entries) {
        e = e.replace(/^###\s+/, "").trim();
        if (!e || e.length < 20) continue;
        if (e.split("\n")[0].toLowerCase().includes("short description")) continue;
        ec.errors_entries.push(e.slice(0, 500));
      }
      if (ec.errors_entries.length) ec.sources.add(errFile);
      break;
    }
  }

  return ec;
}

// ─────────────────────────────────────────────
// Extract from external document
// ─────────────────────────────────────────────

function extractFromDocument(filepath) {
  const result = {
    description: "",
    architecture_notes: "",
    commands: [],
    sources: new Set(),
  };

  const content = safeRead(filepath);
  if (!content) return result;

  result.sources.add("from-doc");

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (["#", "[", "!", ">", "|", "```", "---", "*"].some((c) => trimmed.startsWith(c))) continue;
    result.description = trimmed.slice(0, 300);
    break;
  }

  const sections = extractMdSections(content);
  const archParts = [];
  for (const [key, body] of Object.entries(sections)) {
    const kl = key.toLowerCase();
    if (["architect", "design", "system"].some((w) => kl.includes(w))) {
      if (archParts.length) {
        archParts.push(`\n\n**${key}:**\n${body.slice(0, 2000)}`);
      } else {
        archParts.push(body.slice(0, 3000));
      }
    }
  }
  if (archParts.length) result.architecture_notes = archParts.join("");

  const bashBlockRe = /```(?:bash|sh|cmd)?\n([\s\S]*?)```/g;
  let bashMatch;
  while ((bashMatch = bashBlockRe.exec(content)) !== null) {
    for (const line of bashMatch[1].trim().split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      if ([...TREE_CHARS].some((c) => trimmed.includes(c))) continue;
      if (CMD_PREFIXES.some((p) => trimmed.toLowerCase().startsWith(p))) {
        result.commands.push(trimmed);
      }
    }
  }

  return result;
}

// ─────────────────────────────────────────────
// Directory scanner
// ─────────────────────────────────────────────

function walkSync(dir, root, ignoreDirs) {
  const allFiles = [];
  const allDirs = [];

  function walk(current) {
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (ignoreDirs.has(entry.name) || entry.name.startsWith(".")) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        const rel = path.relative(root, full);
        allDirs.push(rel);
        walk(full);
      } else if (entry.isFile()) {
        allFiles.push(path.relative(root, full));
      }
    }
  }

  walk(dir);
  return { allFiles, allDirs };
}

function scanDirectory(root) {
  const result = {
    root: path.resolve(root),
    name: path.basename(path.resolve(root)),
    is_empty: true,
    stacks: [],
    frameworks: [],
    deploy: [],
    has_git: false,
    existing_docs: [],
    sub_projects: [],
    directories: [],
    file_count: 0,
    extension_counts: {},
    config_files: [],
    test_dirs: [],
    env_files: [],
    scripts: {},
    description: "",
    existing_content: {},
    is_monorepo: false,
    monorepo_tool: "",
    workspace_dirs: [],
    sub_project_details: [],
  };

  const rootFiles = new Set();

  try {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      try {
        if (entry.name === ".git") {
          result.has_git = true;
          continue;
        }
        const fullPath = path.join(root, entry.name);
        if (entry.isSymbolicLink() && isSymlinkBroken(fullPath)) continue;
        if (entry.name.startsWith(".") && ![".env", ".env.example", ".github", ".gitlab-ci.yml"].includes(entry.name)) continue;
        if (entry.isFile()) {
          rootFiles.add(entry.name);
        } else if (entry.isDirectory() && entry.name === ".github") {
          rootFiles.add(entry.name);
        }
      } catch {}
    }
  } catch (e) {
    console.log(`  Warning: cannot read directory ${root}: ${e.message}`);
    return result;
  }

  if (!result.has_git) {
    try {
      const r = _git(root, "rev-parse", "--is-inside-work-tree");
      if (r.returncode === 0 && r.stdout.trim() === "true") {
        result.has_git = true;
      }
    } catch {}
  }

  const { allFiles, allDirs } = walkSync(root, root, IGNORE_DIRS);
  for (const f of allFiles) {
    const ext = path.extname(f).toLowerCase();
    if (ext) {
      result.extension_counts[ext] = (result.extension_counts[ext] || 0) + 1;
    }
    result.file_count++;
  }

  result.is_empty = result.file_count === 0;
  result.directories = allDirs.sort().slice(0, 100);

  // Stacks
  for (const [stack, signals] of Object.entries(STACK_SIGNALS)) {
    let foundFile = signals.files.some((f) => rootFiles.has(f));
    const foundExt = signals.extensions.some((ext) => (result.extension_counts[ext] || 0) > 0);
    if (!foundFile) {
      foundFile = signals.files.some((f) =>
        allFiles.includes(f) || allFiles.some((af) => af.endsWith("/" + f))
      );
    }
    if (foundFile || foundExt) {
      result.stacks.push(stack);
    }
  }

  // Frameworks (order-preserving dedup)
  const frameworksSeen = [];
  for (const [framework, keywords] of Object.entries(FRAMEWORK_SIGNALS)) {
    let found = false;
    for (const kw of keywords) {
      if (rootFiles.has(kw)) {
        frameworksSeen.push(framework);
        found = true;
        break;
      }
      const depFiles = ["package.json", "requirements.txt", "Pipfile", "Cargo.toml",
                         "pyproject.toml", "go.mod", "mix.exs", "build.sbt",
                         "pubspec.yaml", "composer.json"];
      let depFound = false;
      for (const depFile of depFiles) {
        const depPath = path.join(root, depFile);
        if (existsSync(depPath)) {
          try {
            const content = fs.readFileSync(depPath, "utf-8").slice(0, 10000);
            if (content.toLowerCase().includes(kw.toLowerCase())) {
              frameworksSeen.push(framework);
              depFound = true;
              break;
            }
          } catch {}
        }
      }
      if (depFound) { found = true; break; }
    }
  }
  result.frameworks = [...new Map(frameworksSeen.map((f) => [f, f])).keys()];

  // Deploy
  for (const [platform, signals] of Object.entries(DEPLOY_SIGNALS)) {
    for (const s of signals) {
      if (existsSync(path.join(root, s)) || rootFiles.has(s) || allFiles.includes(s)) {
        result.deploy.push(platform);
        break;
      }
    }
  }

  // Existing docs
  for (const df of ["CLAUDE.md", "README.md", "STANDARDS.md", "QUICKSTART.md",
                     "ERRORS_AND_LESSONS.md", "ERROS_E_ACERTOS.md", "CONTRIBUTING.md",
                     "PLAN.md", "CHANGELOG.md"]) {
    if (existsSync(path.join(root, df))) {
      result.existing_docs.push(df);
    }
  }

  // Monorepo detection
  for (const [tool, markers] of Object.entries(MONOREPO_SIGNALS)) {
    for (const m of markers) {
      if (existsSync(path.join(root, m))) {
        result.is_monorepo = true;
        result.monorepo_tool = tool;
        break;
      }
    }
  }

  // Check package.json for workspaces
  const pkgJsonPath = path.join(root, "package.json");
  if (existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
      result.scripts = pkg.scripts || {};
      result.description = pkg.description || "";
      if (pkg.workspaces) {
        result.is_monorepo = true;
        result.monorepo_tool = result.monorepo_tool || "yarn_workspaces";
      }
    } catch {}
  }

  // Sub-projects
  const subProjectsSeen = new Set();
  for (const d of allDirs) {
    const dp = path.join(root, d);
    const parts = d.split(path.sep);
    const depth = parts.length;

    if (depth === 2 && MONOREPO_DIRS.has(parts[0])) {
      const markers = ["package.json", "requirements.txt", "Cargo.toml", "pyproject.toml", "CLAUDE.md"];
      if (markers.some((f) => existsSync(path.join(dp, f)))) {
        subProjectsSeen.add(d);
        result.is_monorepo = true;
      }
    }

    if (depth === 1 && !MONOREPO_DIRS.has(d)) {
      const markers = ["CLAUDE.md", "package.json", "requirements.txt", "Cargo.toml"];
      if (markers.some((f) => existsSync(path.join(dp, f)))) {
        subProjectsSeen.add(d);
      }
    }
  }
  result.sub_projects = [...subProjectsSeen].sort();

  // Sub-project details
  for (const sp of result.sub_projects) {
    const spPath = path.join(root, sp);
    const detail = { path: sp, stacks: [], frameworks: [], has_claude_md: false };
    detail.has_claude_md = existsSync(path.join(spPath, "CLAUDE.md"));

    const spFiles = new Set();
    try {
      for (const item of fs.readdirSync(spPath, { withFileTypes: true })) {
        if (item.isFile()) spFiles.add(item.name);
      }
    } catch {}

    for (const [stack, signals] of Object.entries(STACK_SIGNALS)) {
      if (signals.files.some((f) => spFiles.has(f))) {
        detail.stacks.push(stack);
      }
    }

    for (const [framework, keywords] of Object.entries(FRAMEWORK_SIGNALS)) {
      let found = false;
      for (const kw of keywords) {
        if (spFiles.has(kw)) { detail.frameworks.push(framework); found = true; break; }
        const depFiles = ["package.json", "requirements.txt", "Cargo.toml", "pyproject.toml"];
        for (const depFile of depFiles) {
          const dep = path.join(spPath, depFile);
          if (existsSync(dep)) {
            try {
              const content = fs.readFileSync(dep, "utf-8").slice(0, 5000);
              if (content.toLowerCase().includes(kw.toLowerCase())) {
                detail.frameworks.push(framework);
                found = true;
                break;
              }
            } catch {}
          }
        }
        if (found) break;
      }
    }

    result.sub_project_details.push(detail);
  }

  // Workspace dirs
  for (const d of MONOREPO_DIRS) {
    if (isDirSync(path.join(root, d))) {
      result.workspace_dirs.push(d);
    }
  }

  // Test dirs
  const testNames = new Set(["test", "tests", "__tests__", "spec", "specs", "e2e", "integration"]);
  for (const d of allDirs) {
    if (testNames.has(path.basename(d).toLowerCase())) {
      result.test_dirs.push(d);
    }
  }

  // Config/env
  for (const f of rootFiles) {
    if (f.startsWith(".env")) result.env_files.push(f);
    if ((f.endsWith(".yaml") || f.endsWith(".yml") || f.endsWith(".toml") ||
         f.endsWith(".ini") || f.endsWith(".cfg")) && !f.startsWith(".")) {
      result.config_files.push(f);
    }
  }

  // Deep read
  if (!result.is_empty) {
    result.existing_content = readExistingContent(result.root);
    if (!result.description && result.existing_content.description) {
      result.description = result.existing_content.description;
    }
  }

  // Confidence scoring
  const scores = {};
  const stackScores = [];
  for (const stack of result.stacks) {
    const signals = STACK_SIGNALS[stack] || {};
    const foundFile = (signals.files || []).some(f => rootFiles.has(f));
    stackScores.push({ value: stack, source: foundFile ? "root config file" : "file extensions", confidence: foundFile ? "high" : "medium" });
  }
  scores.stacks = stackScores;

  const fwScores = [];
  for (const fw of result.frameworks) {
    const keywords = FRAMEWORK_SIGNALS[fw] || [];
    const fromFile = keywords.some(kw => rootFiles.has(kw));
    fwScores.push({ value: fw, source: fromFile ? "root file" : "dependency file keyword", confidence: fromFile ? "high" : "medium" });
  }
  scores.frameworks = fwScores;

  if (result.description) {
    const ecSources = (result.existing_content || {}).sources || new Set();
    if (ecSources.has && ecSources.has("README.md")) {
      scores.description = { value: result.description, source: "README.md", confidence: "medium" };
    } else if (Object.keys(result.scripts || {}).length) {
      scores.description = { value: result.description, source: "package.json", confidence: "high" };
    } else {
      scores.description = { value: result.description, source: "inferred", confidence: "low" };
    }
  }

  const ecCmds = (result.existing_content || {}).commands || [];
  scores.commands = ecCmds.map(cmd => ({ value: cmd, source: "extracted from docs", confidence: "medium" }));

  result.confidence_scores = scores;

  return result;
}

// ─────────────────────────────────────────────
// Tier detection
// ─────────────────────────────────────────────

function detectProjectTier(info) {
  const reasons = [];
  const frameworks = new Set(info.frameworks || []);
  const hasDeploy = !!(info.deploy && info.deploy.length);
  const hasExternal = [...frameworks].some((f) => EXTERNAL_FRAMEWORKS.has(f));
  const isMonorepo = info.is_monorepo || false;
  const isEmpty = info.is_empty || false;
  const hasCode = !!(info.stacks && info.stacks.length);

  if (hasDeploy && hasExternal && isMonorepo) {
    reasons.push("deploy platform detected", "external-facing framework", "monorepo structure");
    return { tier: 1, confidence: "high", reasons };
  }
  if (hasDeploy && hasExternal) {
    reasons.push("deploy platform detected", "external-facing framework");
    return { tier: 1, confidence: "medium", reasons };
  }
  if (hasExternal) {
    reasons.push("external-facing framework detected");
    if (hasDeploy) reasons.push("deploy platform detected");
    return { tier: 2, confidence: hasDeploy ? "high" : "medium", reasons };
  }
  if (hasCode) {
    reasons.push("code detected but no external-facing framework");
    return { tier: 3, confidence: "medium", reasons };
  }
  if (isEmpty || !hasCode) {
    reasons.push("no code detected");
    return { tier: 4, confidence: "low", reasons };
  }
  return { tier: 3, confidence: "low", reasons: ["unable to determine"] };
}

function emptyScanResult(target) {
  return {
    root: target,
    name: path.basename(target),
    is_empty: true,
    stacks: [],
    frameworks: [],
    deploy: [],
    has_git: false,
    existing_docs: [],
    sub_projects: [],
    directories: [],
    file_count: 0,
    extension_counts: {},
    config_files: [],
    test_dirs: [],
    env_files: [],
    scripts: {},
    description: "",
    existing_content: {},
    is_monorepo: false,
    monorepo_tool: "",
    workspace_dirs: [],
    sub_project_details: [],
  };
}

// ─────────────────────────────────────────────
// Generators
// ─────────────────────────────────────────────

function generateClaudeMd(info) {
  const name = info.name;
  const ec = info.existing_content || {};
  const desc = info.description || ec.description || `${name} project`;
  const stacks = info.stacks.length ? info.stacks.join(", ") : "not detected";
  const frameworks = info.frameworks.length ? info.frameworks.join(", ") : "none detected";
  const today = todayISO();
  const sources = ec.sources || new Set();

  const tier = info.tier || {};
  const tierNum = tier.tier || 3;
  const tierConf = tier.confidence || "low";
  const tierReasons = tier.reasons || [];

  const L = [
    "---",
    `project: ${name}`,
    `stack: ${stacks}`,
    `framework: ${frameworks}`,
    `tier: T${tierNum}`,
    `generated_by: claude-primer v${__version__}`,
    `last_updated: ${today}`,
    "---", "",
    "# CLAUDE.md", "",
    "<!-- Target: keep this file under 300 lines. Split detail into STANDARDS.md or local CLAUDE.md files. -->",
    "",
    "This file provides guidance to Claude Code when working in this repository.", "",
  ];

  if (info.clean_root) {
    L.push(
      "**Quick reference:** [QUICKSTART.md](.claude/docs/QUICKSTART.md)",
      "**Standards:** [STANDARDS.md](.claude/docs/STANDARDS.md)",
      "**Mistakes:** [ERRORS_AND_LESSONS.md](.claude/docs/ERRORS_AND_LESSONS.md)",
    );
  } else {
    L.push(
      "**Quick reference:** [QUICKSTART.md](QUICKSTART.md)",
      "**Standards:** [STANDARDS.md](STANDARDS.md)",
      "**Mistakes:** [ERRORS_AND_LESSONS.md](ERRORS_AND_LESSONS.md)",
    );
  }

  L.push("", "---", "",
    "## Routing Rules", "",
    "If the task is inside a subdirectory that has its own CLAUDE.md:",
    "1. **Read the local CLAUDE.md first** — it is the primary source for that scope.",
    "2. Use this root file only as general context.",
    "3. If the local file conflicts with this file, **the local file wins**.",
    "",
  );

  // Sub-projects
  if (ec.sub_project_table && ec.sub_project_table.length > 100) {
    L.push(_mark("migrated"), ec.sub_project_table, "");
  } else if (info.is_monorepo && info.sub_project_details && info.sub_project_details.length) {
    L.push(
      "### Sub-Projects", "",
      "> This is a monorepo root. Each sub-project may have its own CLAUDE.md.",
      "> Run `claude-primer <sub-project-path>` to generate sub-project docs.", "",
      _mark("inferred"),
      "| Directory | Stack | Framework | Local CLAUDE.md |",
      "|-----------|-------|-----------|-----------------|",
    );
    for (const spd of info.sub_project_details) {
      const spStacks = spd.stacks.length ? spd.stacks.join(", ") : "-";
      const spFws = spd.frameworks.length ? spd.frameworks.join(", ") : "-";
      const spClaude = spd.has_claude_md ? "Yes" : "No";
      L.push(`| \`${spd.path}/\` | ${spStacks} | ${spFws} | ${spClaude} |`);
    }
    L.push("");
  } else if (info.sub_projects && info.sub_projects.length) {
    L.push(_mark("inferred"), "| Directory | Notes |", "|-----------|-------|");
    for (const sp of info.sub_projects) {
      const hasC = existsSync(path.join(info.root, sp, "CLAUDE.md"));
      L.push(`| \`${sp}/\` | ${hasC ? "Has CLAUDE.md" : "Has own deps"} |`);
    }
    L.push("");
  }

  // Overview
  L.push("---", "", "## Repository Overview", "", desc, "");
  L.push(`**Tech stack:** ${stacks}`);
  L.push(`**Frameworks:** ${frameworks}`);
  L.push(`**Suggested tier:** T${tierNum} (${tierConf} confidence) — review required`);
  if (tierReasons.length) L.push(`**Tier rationale:** ${tierReasons.join("; ")}`);
  if (info.deploy && info.deploy.length) L.push(`**Deploy:** ${info.deploy.join(", ")}`);
  if (info.is_monorepo) {
    L.push(`**Monorepo:** ${info.monorepo_tool || "detected"}`);
    if (info.workspace_dirs && info.workspace_dirs.length) {
      L.push(`**Workspace dirs:** ${info.workspace_dirs.join(", ")}`);
    }
  }
  L.push("");

  // Directory tree
  L.push("### Directory Structure", "", "```", `${name}/`);
  for (const d of (info.directories || []).filter((d) => !d.includes("/")).slice(0, 15)) {
    L.push(`├── ${d}/`);
  }
  for (const doc of info.existing_docs || []) {
    L.push(`├── ${doc}`);
  }
  L.push("```", "");

  // Deploy notes
  if (ec.deploy_notes) {
    L.push(_mark("migrated"), "### Deployed Applications", "", ec.deploy_notes, "");
  }

  // Environment
  L.push("---", "", "## Environment", "");
  if (ec.env_notes) {
    L.push(_mark("migrated"), ec.env_notes, "");
  } else {
    L.push(_mark("inferred"));
    if (info.stacks.includes("python")) L.push("- **Python:** 3.11+ recommended");
    if (info.stacks.includes("node")) L.push("- **Node.js:** 18+ recommended");
    if (info.stacks.includes("rust")) L.push("- **Rust:** stable toolchain");
    if (info.stacks.includes("go")) L.push("- **Go:** 1.21+");
    if (info.stacks.includes("elixir")) L.push("- **Elixir:** 1.16+ / OTP 26+");
    if (info.stacks.includes("swift")) L.push("- **Swift:** 5.9+");
    if (info.stacks.includes("dart")) L.push("- **Dart:** 3.0+ / Flutter 3.16+");
    if (info.stacks.includes("java")) L.push("- **Java:** 17+ (LTS)");
    if (info.stacks.includes("dotnet")) L.push("- **dotnet:** 8.0+");
    if (!info.stacks.length) {
      L.push(
        "- **Language:** (specify language and version)",
        "- **Package manager:** (pip, npm, cargo, etc.)",
        "- **Runtime:** (Node, Python, etc.)",
      );
    }
    L.push("");
  }

  // Commands
  L.push("---", "", "## Common Commands", "");
  if (ec.commands && ec.commands.length >= 3) {
    const rankedCmds = dedupAndRankCommands(ec.commands);
    L.push(_mark("migrated"), "```bash");
    for (const cmd of rankedCmds.slice(0, 20)) L.push(cmd);
    L.push("```", "");
  } else {
    L.push(_mark("inferred"));
    if (info.stacks.includes("python")) {
      L.push("```bash");
      if (existsSync(path.join(info.root, "requirements.txt"))) {
        L.push("pip install -r requirements.txt");
      } else if (existsSync(path.join(info.root, "pyproject.toml"))) {
        L.push("pip install -e .");
      } else {
        L.push("pip install -r requirements.txt  # or: pip install -e .");
      }
      L.push("```", "");
    }
    if (info.stacks.includes("node")) {
      L.push("```bash", "npm install");
      for (const [sn, sc] of Object.entries(info.scripts || {}).slice(0, 10)) {
        L.push(`npm run ${sn.padEnd(20)} # ${String(sc).slice(0, 60)}`);
      }
      L.push("```", "");
    }
    if (info.stacks.includes("rust")) L.push("```bash", "cargo build", "cargo test", "cargo run", "```", "");
    if (info.stacks.includes("go")) L.push("```bash", "go mod download", "go build ./...", "go test ./...", "```", "");
    if (info.stacks.includes("elixir")) L.push("```bash", "mix deps.get", "mix compile", "mix test", "```", "");
    if (info.stacks.includes("dart")) {
      if (info.frameworks.includes("flutter")) {
        L.push("```bash", "flutter pub get", "flutter run", "flutter test", "```", "");
      } else {
        L.push("```bash", "dart pub get", "dart run", "dart test", "```", "");
      }
    }
    if (info.stacks.includes("java")) {
      if (existsSync(path.join(info.root, "pom.xml"))) {
        L.push("```bash", "mvn install", "mvn test", "```", "");
      } else if (existsSync(path.join(info.root, "build.gradle")) || existsSync(path.join(info.root, "build.gradle.kts"))) {
        L.push("```bash", "gradle build", "gradle test", "```", "");
      } else {
        L.push("```bash", "mvn install  # or: gradle build", "```", "");
      }
    }
    if (info.stacks.includes("dotnet")) L.push("```bash", "dotnet restore", "dotnet build", "dotnet test", "```", "");
    if (!info.stacks.length) {
      L.push(
        _mark("placeholder"),
        "```bash",
        "# Install dependencies",
        "# (add install command here)",
        "",
        "# Run development server",
        "# (add run command here)",
        "",
        "# Run tests",
        "# (add test command here)",
        "",
        "# Build for production",
        "# (add build command here)",
        "```", "",
      );
    }

    // Framework-specific commands
    const fw = new Set(info.frameworks || []);
    const fwCmds = [];
    if (fw.has("django")) fwCmds.push("python manage.py migrate", "python manage.py runserver", "python manage.py createsuperuser");
    if (fw.has("flask")) fwCmds.push("flask run", "flask db upgrade");
    if (fw.has("fastapi")) fwCmds.push("uvicorn main:app --reload");
    if (fw.has("nextjs")) fwCmds.push("npm run dev", "npm run build", "npm run start");
    if (fw.has("phoenix")) fwCmds.push("mix phx.server", "mix ecto.setup", "mix ecto.migrate");
    if (fw.has("spring")) fwCmds.push("mvn spring-boot:run");
    if (fw.has("laravel")) fwCmds.push("php artisan serve", "php artisan migrate");
    if (fwCmds.length) {
      L.push(_mark("inferred"), "### Framework Commands", "", "```bash");
      for (const cmd of fwCmds) L.push(cmd);
      L.push("```", "");
    }
  }

  // Testing
  if (info.test_dirs && info.test_dirs.length) {
    L.push("---", "", "## Testing", "", `Test directories: ${info.test_dirs.join(", ")}`, "", "```bash");
    if (info.stacks.includes("python")) L.push("pytest");
    if (info.stacks.includes("node")) L.push("npm test");
    if (info.stacks.includes("rust")) L.push("cargo test");
    if (info.stacks.includes("go")) L.push("go test ./...");
    if (info.stacks.includes("elixir")) L.push("mix test");
    if (info.stacks.includes("dart")) L.push(info.frameworks.includes("flutter") ? "flutter test" : "dart test");
    if (info.stacks.includes("java")) L.push(existsSync(path.join(info.root, "pom.xml")) ? "mvn test" : "gradle test");
    if (info.stacks.includes("dotnet")) L.push("dotnet test");
    L.push("```", "");
  }

  // Architecture
  L.push("---", "", "## Code Architecture", "");
  if (ec.architecture_notes) {
    L.push(_mark("migrated"), ec.architecture_notes, "");
  } else {
    L.push(
      _mark("placeholder"), "",
      "### Patterns",
      "<!-- Ex: MVC, Clean Architecture, Event-driven, Layered, etc. -->", "",
      "### Key Modules",
      "<!-- List the main modules/packages and their responsibilities -->", "",
      "### Data Flow",
      "<!-- Describe the primary data flow of the application -->", "",
    );
  }

  // Data sources
  if (ec.data_sources) {
    L.push("---", "", "## Data Sources", "", _mark("migrated"), ec.data_sources, "");
  }

  // Invariants
  L.push(
    "---", "", "## Invariants", "",
    "> **Iron Law:** Read before writing. Understand existing code before changing it.",
    "",
    "- Validate external input at system boundaries",
    "- Never silently swallow errors — log or propagate with context",
    "- Prefer dry-run for operations with external side effects",
    "- Document decisions that affect future tasks",
    "- Read local CLAUDE.md before modifying scoped code",
    "",
  );

  // Decision Heuristics
  L.push(
    "---", "", "## Decision Heuristics", "",
    "When in doubt, apply these in order:", "",
    "1. **Reversible over perfect** — prefer actions you can undo over waiting for certainty",
    "2. **Smallest viable change** — solve the immediate problem, nothing more",
    "3. **Existing patterns over new abstractions** — follow what the codebase already does",
    "4. **Explicit failure over silent success** — if unsure something worked, make it loud",
    "5. **Data over debate** — run the test, check the log, read the error",
    "6. **Ask over assume** — when a decision has consequences you cannot reverse, ask the user",
    "",
  );

  // Verification Standard
  L.push(
    "---", "", "## Verification Standard", "",
    "> **Iron Law:** Evidence before claims, always.",
    "",
    "- Run the actual command — don't assume success",
    "- Fresh verification after every change — stale results are lies",
    "- Independent verification — don't trust agent output without checking",
    "- Verify at every layer the data passes through (defense-in-depth)",
    "",
  );

  // Red Flags
  L.push(
    "---", "", "## Red Flags", "",
    "If you catch yourself thinking any of these, **STOP and follow the process:**", "",
    "- \"This is just a quick fix\" → Follow the full process anyway",
    "- \"I don't need to test this\" → You definitely need to test this",
    "- \"It should work now\" → RUN the verification",
    "- \"One more attempt should fix it\" → 3+ failures = architectural problem, step back",
    "- \"Too simple to need a plan\" → Simple changes break complex systems",
    "- \"I'll clean it up later\" → Later never comes. Do it right now",
    "",
  );

  // Stuck Protocol
  L.push(
    "---", "", "## Stuck Protocol", "",
    "If you have tried **3+ approaches** to the same problem without progress:", "",
    "1. **Stop** — do not attempt another fix",
    "2. **Document** the blocker: what you tried, what failed, what you suspect",
    "3. **List** remaining untried approaches (if any)",
    "4. **Skip** — move to the next task or ask the user for guidance", "",
    "Spinning without progress is the most expensive failure mode. Detecting it early is critical.",
    "",
  );

  // Key Decisions
  L.push(
    "---", "", "## Key Decisions", "",
    _mark("placeholder"),
    "| Decision | Rationale | Status |",
    "|----------|-----------|--------|",
    "| <!-- e.g. Use PostgreSQL --> | <!-- why this choice --> | <!-- Active / Revisit / Superseded --> |",
    "",
    "<!-- Track decisions that constrain future work. Remove rows when no longer relevant. -->",
    "",
  );

  // Active Risks
  L.push(
    "---", "", "## Active Risks", "",
    _mark("placeholder"),
    "<!-- What is currently fragile, under migration, or operationally risky -->",
    "<!-- Remove items as they are resolved -->",
    "",
  );

  // Formatting
  L.push("---", "", "## Formatting Standards", "");
  if (ec.formatting_rules && ec.formatting_rules.length) {
    L.push(_mark("migrated"));
    for (const rule of ec.formatting_rules) L.push(`- ${rule}`);
    L.push("");
  } else {
    L.push(
      _mark("placeholder"),
      "- Use consistent indentation (spaces or tabs, not mixed)",
      "- Maximum line length: 100 characters",
      "- Files end with a single newline",
      "- No trailing whitespace",
      "- Use descriptive variable and function names",
      "- Keep functions focused — one responsibility per function",
      "- Prefer explicit over implicit",
      "",
    );
  }

  // Stakeholders
  if (ec.stakeholder_notes) {
    L.push("---", "", "## Stakeholder Preferences", "",
      _mark("migrated"), ec.stakeholder_notes, "");
  }

  // Pre-Task Protocol
  L.push("---", "", "## Pre-Task Protocol", "");
  L.push(
    "### Announce at Start", "",
    "Before writing any code, announce:", "",
    "1. **What approach** you are using (fix, feature, refactor, etc.)",
    "2. **Which files** you expect to modify",
    "3. **What verification** you will run when done", "",
  );
  L.push("### Checklist", "", "Before starting any task:", "");
  if (ec.checklist_items && ec.checklist_items.length) {
    L.push(_mark("migrated"));
    L.push(...ec.checklist_items);
  } else {
    L.push(_mark("placeholder"));
    L.push("- [ ] Read ERRORS_AND_LESSONS.md for known pitfalls");
    L.push("- [ ] Check if a local CLAUDE.md exists in the working directory");
    L.push("- [ ] Understand the existing code before making changes");
    L.push("- [ ] Run tests after changes to verify nothing broke");
    L.push("- [ ] Keep changes minimal and focused on the task");
    if (info.env_files && info.env_files.length) {
      L.push("- [ ] Verify `.env` configuration is up to date");
    }
  }
  L.push("");

  // Post-Task
  L.push(
    "### Post-Task", "",
    "Before ending a session or completing a task:", "",
    "- [ ] Update ERRORS_AND_LESSONS.md if you hit a non-obvious problem",
    "- [ ] Record any decision that constrains future work in Key Decisions",
    "- [ ] If work is incomplete, leave a clear note about what remains",
    "- [ ] Run final verification to confirm nothing is broken",
    "",
  );

  // Parallel Development
  if (info.has_git) {
    L.push(
      "---", "", "## Parallel Development", "",
      "Use git worktrees for parallel tasks without branch-switching conflicts:", "",
      "```bash",
      "claude --worktree feature-name    # isolated worktree + Claude session",
      "claude -w bugfix-123 --tmux       # worktree in tmux session",
      "git worktree list                 # see all active worktrees",
      "```", "",
      "- Each worktree gets its own branch and working directory",
      "- Worktrees share git history — no duplicate clones",
      "- Focus independent tasks in parallel — avoid editing same files",
      "- Cleanup is automatic when Claude session ends without changes",
      "",
    );
  }

  // Provenance
  if (sources.size) {
    L.push("---", "", "## Provenance", "",
      "Content in this file was assembled from:", "");
    for (const src of [...sources].sort()) L.push(`- \`${src}\``);
    L.push("");
    L.push("Sections containing `migrated` in a comment came from existing files — verify accuracy.");
    L.push("Sections containing `inferred` were detected from project structure — may need correction.");
    L.push("Sections containing `placeholder` need manual input.");
    L.push("");
  }

  L.push("---", "", "## Document Information", "",
    `**Last Updated:** ${today}`,
    `**Generated by:** claude-primer v${__version__}`);

  return L.join("\n") + "\n";
}

function generateQuickstartMd(info) {
  const ec = info.existing_content || {};
  let claudeRef, standardsRef;
  if (info.clean_root) {
    claudeRef = "[CLAUDE.md](../../CLAUDE.md)";
    standardsRef = "[STANDARDS.md](STANDARDS.md)";
  } else {
    claudeRef = "[CLAUDE.md](CLAUDE.md)";
    standardsRef = "[STANDARDS.md](STANDARDS.md)";
  }
  const L = [
    "<!-- AUTO-MAINTAINED by claude-primer. Manual edits below the marker will be preserved. -->",
    "",
    "# Quick Start — Command Reference", "",
    `Commands only. For context: ${claudeRef}. For rules: ${standardsRef}.`,
    "", "---", "",
  ];

  if (ec.commands && ec.commands.length >= 3) {
    const rankedCmds = dedupAndRankCommands(ec.commands);
    L.push(_mark("migrated"), "## Commands", "", "```bash");
    for (const cmd of rankedCmds.slice(0, 15)) L.push(cmd);
    L.push("```", "");
  } else {
    L.push(_mark("inferred"), "## Setup", "", "```bash");
    if (info.stacks.includes("python")) {
      if (existsSync(path.join(info.root, "requirements.txt"))) {
        L.push("pip install -r requirements.txt");
      } else if (existsSync(path.join(info.root, "pyproject.toml"))) {
        L.push("pip install -e .");
      } else {
        L.push("pip install -r requirements.txt");
      }
    }
    if (info.stacks.includes("node")) L.push("npm install");
    if (info.stacks.includes("rust")) L.push("cargo build");
    if (info.stacks.includes("go")) L.push("go mod download");
    if (info.stacks.includes("elixir")) L.push("mix deps.get");
    if (info.stacks.includes("dart")) L.push(info.frameworks.includes("flutter") ? "flutter pub get" : "dart pub get");
    if (info.stacks.includes("java")) {
      if (existsSync(path.join(info.root, "pom.xml"))) L.push("mvn install");
      else if (existsSync(path.join(info.root, "build.gradle")) || existsSync(path.join(info.root, "build.gradle.kts"))) L.push("gradle build");
      else L.push("mvn install");
    }
    if (info.stacks.includes("dotnet")) L.push("dotnet restore");
    if (!info.stacks.length) {
      L.push(
        "# 1. Install dependencies",
        "# (add install command here)",
        "",
        "# 2. Configure environment",
        "# cp .env.example .env",
        "",
        "# 3. Run",
        "# (add run command here)",
      );
    }
    L.push("```", "");

    if (info.scripts && Object.keys(info.scripts).length) {
      L.push("## Run", "", "```bash");
      const priority = ["dev", "start", "build", "test", "lint", "format", "deploy"];
      const added = new Set();
      for (const s of priority) {
        if (info.scripts[s]) { L.push(`npm run ${s}`); added.add(s); }
      }
      for (const s of Object.keys(info.scripts)) {
        if (!added.has(s) && added.size < 10) { L.push(`npm run ${s}`); added.add(s); }
      }
      L.push("```", "");
    }
  }

  if (info.test_dirs && info.test_dirs.length) {
    L.push("## Test", "", "```bash");
    if (info.stacks.includes("python")) L.push("pytest");
    if (info.stacks.includes("node")) L.push("npm test");
    if (info.stacks.includes("rust")) L.push("cargo test");
    if (info.stacks.includes("go")) L.push("go test ./...");
    if (info.stacks.includes("elixir")) L.push("mix test");
    if (info.stacks.includes("dart")) L.push(info.frameworks.includes("flutter") ? "flutter test" : "dart test");
    if (info.stacks.includes("dotnet")) L.push("dotnet test");
    L.push("```", "");
  }

  L.push("## Quick Fixes", "", "| Problem | Fix |", "|---------|-----|");
  if (info.stacks.includes("python")) L.push("| Module not found | `pip install -r requirements.txt` |");
  if (info.stacks.includes("node")) {
    L.push("| Module not found | `rm -rf node_modules && npm install` |");
    L.push("| Port in use | `npm run dev -- -p 3001` |");
  }
  if (info.stacks.includes("elixir")) L.push("| Deps conflict | `mix deps.clean --all && mix deps.get` |");
  if (info.stacks.includes("go")) L.push("| Module mismatch | `go mod tidy` |");
  if (!info.stacks.length) {
    L.push("| Permission denied | `chmod +x script.sh` |");
    L.push("| Port already in use | `lsof -i :PORT` then `kill -9 PID` |");
    L.push("| Git merge conflict | Resolve manually, then `git add . && git commit` |");
    L.push("| Env var missing | Check `.env` file or export manually |");
  }

  // Complete Workflow Example
  L.push("", "## Complete Workflow Example", "",
    "A typical development cycle from start to finish:", "",
    "```bash",
    "# 1. Set up (first time only)",
  );
  if (info.stacks.includes("python")) {
    L.push("python -m venv .venv && source .venv/bin/activate");
    L.push("pip install -r requirements.txt");
  } else if (info.stacks.includes("node")) {
    L.push("npm install");
  } else if (info.stacks.includes("rust")) {
    L.push("cargo build");
  } else {
    L.push("# (run install command)");
  }
  L.push("", "# 2. Create a branch for your work", "git checkout -b feature/my-feature", "", "# 3. Make changes, then verify");
  if (info.stacks.includes("python")) L.push("pytest  # run tests");
  else if (info.stacks.includes("node")) L.push("npm test  # run tests");
  else if (info.stacks.includes("rust")) L.push("cargo test  # run tests");
  else L.push("# (run test command)");
  L.push("", "# 4. Commit and push",
    "git add -A && git commit -m 'feat: describe your change'",
    "git push -u origin feature/my-feature",
    "```", "");

  if (info.clean_root) {
    L.push("## References", "",
      "- [CLAUDE.md](../../CLAUDE.md)",
      "- [STANDARDS.md](STANDARDS.md)",
      "- [ERRORS_AND_LESSONS.md](ERRORS_AND_LESSONS.md)",
      "", "---", `**Last Updated:** ${todayISO()}`);
  } else {
    L.push("## References", "",
      "- [CLAUDE.md](CLAUDE.md)",
      "- [STANDARDS.md](STANDARDS.md)",
      "- [ERRORS_AND_LESSONS.md](ERRORS_AND_LESSONS.md)",
      "", "---", `**Last Updated:** ${todayISO()}`);
  }

  return L.join("\n") + "\n";
}

function generateStandardsMd(info) {
  const today = todayISO();
  const ec = info.existing_content || {};
  const externalFwList = ["django", "flask", "fastapi", "nextjs", "nestjs", "hono", "express",
    "phoenix", "spring", "laravel", "gin", "fiber", "echo", "remix", "astro"];
  const hasExternal = (info.frameworks || []).some((f) => externalFwList.includes(f));

  const existing = ec.standards_sections || {};
  if (Object.keys(existing).length >= 4) {
    const L = [
      "# STANDARDS.md — QA & Documentation Standards", "",
      "Quality assurance and documentation standards for this repository.", "",
      "**Referenced by CLAUDE.md. Enforced by Claude Code.**", "",
      "**Verifiability principle:** Every rule in this file can be checked objectively.",
      "", _mark("migrated"), "", "---", "",
    ];
    for (const [heading, body] of Object.entries(existing)) {
      if (!heading) continue;
      L.push(`## ${heading}`, "", body, "");
    }
    L.push(`**Last Updated:** ${today}`);
    return L.join("\n") + "\n";
  }

  const tier = info.tier || {};
  const tierNum = tier.tier || 3;

  const L = [
    "# STANDARDS.md — Governance & Quality Standards", "",
    "Lean governance for this repository. Every rule is objectively verifiable.", "",
    info.clean_root ? "**Referenced by:** [CLAUDE.md](../../CLAUDE.md)" : "**Referenced by:** [CLAUDE.md](CLAUDE.md)", "",
    "**Assumed knowledge:** Language-standard conventions (PEP 8, ESLint defaults, etc.) are assumed.",
    "This file only documents project-specific rules and deviations.",
    "", "---", "",

    "## 1. Core Principles", "",
    "> **Iron Law:** Every rule must protect more than it costs. Remove rules that create drag without value.",
    "",
    "- **Evidence over opinion** — decisions backed by data or tested behavior",
    "- **Parse at the boundary** — validate external input where it enters the system",
    "- **Errors carry context** — never swallow exceptions; log or propagate with details",
    "- **Idempotency where it matters** — re-running should be safe or explicitly documented as unsafe",
    "- **Document decisions that affect future work** — not all decisions, just consequential ones",
    "- **Least powerful tool** — use the simplest approach that solves the problem",
    "- **Verify before claiming done** — evidence before completion claims, always",
    "", "---", "",

    "## 2. Project Tiers", "",
    "| Tier | Blast Radius | Required Gates | Max Iterations |",
    "|------|-------------|----------------|----------------|",
    "| **T1** | Multi-phase, writes to external systems | README, CLAUDE.md, PLAN.md, dry-run, preflight, manifest | 15 |",
    "| **T2** | Single-phase, external reads/writes | README, CLAUDE.md, dry-run, preflight | 10 |",
    "| **T3** | Local only — reads data, generates reports | README | 7 |",
    "| **T4** | Reference material, static resources | Optional | 5 |",
    "", "---", "",

    "## 3. Required Gates by Tier", "",
  ];

  if (tierNum <= 2 || hasExternal) {
    L.push(
      "### T1/T2 — External Systems", "",
      "- **Dry-run default:** no writes without `--live` flag",
      "- **Preflight validation:** inputs exist and are well-formed before execution",
      "- **Manifest output:** JSON manifest in `output/` after every run",
      "- **Rollback info:** manifest contains enough data to undo manually",
      "- **Idempotency:** README documents whether re-running is safe", "",
    );
  }

  L.push(
    "### T3 — Local Processing", "",
    "- Validate input files before processing",
    "- Clear error messages on failure",
    "- Non-zero exit code on error", "",
    "### T4 — Documentation", "",
    "- No execution-level gates required",
    "", "---", "",
  );

  // Naming Conventions
  L.push("## 4. Naming Conventions", "");
  if (info.stacks.includes("python")) L.push("### Python", "- Files: `snake_case.py`", "- Verb-first for scripts: `publish_`, `validate_`", "");
  if (info.stacks.includes("node")) L.push("### JavaScript/TypeScript", "- Files: `camelCase.ts` or `kebab-case.ts` (be consistent)", "- Components: `PascalCase.tsx`", "");
  if (info.stacks.includes("rust")) L.push("### Rust", "- Files: `snake_case.rs`", "");
  if (info.stacks.includes("go")) L.push("### Go", "- Files: `snake_case.go`", "- Packages: short, lowercase, no underscores", "");
  if (info.stacks.includes("elixir")) L.push("### Elixir", "- Files: `snake_case.ex`", "- Modules: `PascalCase`", "");
  if (info.stacks.includes("java")) L.push("### Java/Kotlin", "- Files: `PascalCase.java` / `PascalCase.kt`", "- Packages: `com.company.project`", "");
  if (info.stacks.includes("dart")) L.push("### Dart", "- Files: `snake_case.dart`", "- Classes: `PascalCase`", "");
  if (!info.stacks.length) {
    L.push(
      "### General",
      "- Files: lowercase with hyphens or underscores (be consistent)",
      "- Constants: `UPPER_SNAKE_CASE`",
      "- Functions/methods: descriptive, verb-first names",
      "- Classes: `PascalCase`",
      "",
    );
  }

  L.push(
    "### Config & Output",
    "- Config: YAML or TOML", "- Data/output: JSON", "- Secrets: `.env` (never committed)",
    "", "---", "",

    "## 5. Code Quality", "",
    "<HARD-GATE>No hardcoded secrets or credentials in code — ever.</HARD-GATE>", "",
    "| Rule | Severity |",
    "|------|----------|",
    "| No hardcoded secrets or credentials | CRITICAL |",
    "| Error handling: never silently swallow exceptions | CRITICAL |",
    "| No silent failures — if something goes wrong, it must be visible | HIGH |",
    "| No commented-out code in commits | HIGH |",
    "| No `TODO` without a linked issue or explanation | MEDIUM |",
    "| Dependencies: pin versions in lock files | MEDIUM |",
    "", "---", "",

    "## 6. Git Conventions", "",
    "- Branch naming: `feature/`, `fix/`, `chore/` prefixes",
    "- Commit messages: imperative mood, max 72 chars first line",
    "- One logical change per commit",
    "- Never commit `.env`, credentials, or large binaries",
    "", "---", "",

    "## 7. Plan Format Standard", "",
    "When writing implementation plans:", "",
    "- Break work into bite-sized tasks (2-5 minutes each)",
    "- Each task specifies: exact file paths, expected changes, verification command",
    "- Tasks are written for someone with zero context about the codebase",
    "- Order: setup → implement → test → verify → document",
    "- Include expected output for verification commands",
    "", "---", "",

    "## 8. Documentation Relevance Rule", "",
    "Document only what helps someone proceed safely with the next task.", "",
    "- If a decision constrains future work → document it",
    "- If a workaround exists for a known issue → document it in ERRORS_AND_LESSONS.md",
    "- If documentation would be stale within a sprint → skip it",
    "- Pressure-test documentation: if an agent rationalizes around a rule, add an explicit counter",
    "", "---", "",

    "## 9. Exception Rule", "",
    "<HARD-GATE>Undocumented exceptions are treated as bugs.</HARD-GATE>", "",
    "Any rule in this file can be overridden if:", "",
    "1. The exception is documented in the PR or commit message",
    "2. The reason explains why the rule does not apply",
    "3. The override is scoped — it does not disable the rule globally",
    "",
    "### Common Legitimate Exceptions", "",
    "| Scenario | Minimum Requirement |",
    "|----------|-------------------|",
    "| Prototype/spike (will be discarded) | Mark branch as throwaway, no merge to main |",
    "| Third-party/vendored code | Document source and version |",
    "| Emergency hotfix | Post-incident review within 48 hours |",
    "| Generated code (codegen, migrations) | Document generator and regeneration steps |",
    "| One-time script | Comment with purpose and expiration at top of file |",
    "", "---", "",

    "## 10. Error Catalog", "",
    "All recurring errors must be documented in [ERRORS_AND_LESSONS.md](ERRORS_AND_LESSONS.md).", "",
    "---", "",
    `**Created:** ${today}`, `**Last Updated:** ${today}`,
  );

  return L.join("\n") + "\n";
}

function generateErrorsMd(info) {
  const ec = info.existing_content || {};
  const entries = ec.errors_entries || [];

  const L = [
    "# Errors & Lessons — Mistake Catalog", "",
    "Consult this file **before starting any task**. Organized by category, not chronologically.",
    "", "## Format", "",
    "```markdown",
    "### [Category] Short description",
    "**Context:** When/where this happens",
    "**Wrong:** What we did that failed",
    "**Right:** What actually works",
    "**Date:** When discovered",
    "```", "",
    "## Categories", "",
    "Use one of: Data Processing, Dependencies, API, Deploy, Logic, Config, Testing,",
    "Tech Debt, Security, Performance, Fragile Areas",
    "", "---", "",
  ];

  if (entries.length) {
    L.push(_mark("migrated"), "");
    for (const entry of entries) {
      const firstLine = entry.split("\n")[0];
      const rest = entry.split("\n").slice(1).join("\n").trim();
      L.push(`### ${firstLine}`);
      if (rest) L.push(rest);
      L.push("");
    }
  } else {
    L.push(
      _mark("placeholder"), "",
      "### [Dependencies] Example: version mismatch after update",
      "**Context:** After updating a dependency, imports or builds break",
      "**Wrong:** Blindly updating all deps at once without testing",
      "**Right:** Update one dependency at a time, run tests between each",
      "**Date:** (template)", "",
      "### [Config] Example: environment variable not loaded",
      "**Context:** App fails on startup with missing config error",
      "**Wrong:** Hardcoding the value as a workaround",
      "**Right:** Check .env file exists, verify loading mechanism, add to .env.example",
      "**Date:** (template)", "",
      "### [Logic] Example: off-by-one in pagination",
      "**Context:** API returns duplicate or missing items at page boundaries",
      "**Wrong:** Using 1-based offset with 0-based index",
      "**Right:** Standardize on 0-based indexing internally, convert at boundaries",
      "**Date:** (template)", "",
      "> **Note:** Replace these examples with real entries as errors are discovered.",
      "> Delete the examples once you have real entries.",
    );
  }

  L.push(
    "", "---", "",
    "## Rationalization Table", "",
    "Common excuses that lead to mistakes. If you catch yourself thinking these, stop.", "",
    "| Excuse | Reality |",
    "|--------|---------|",
    '| "Too simple to test" | Simple code breaks. A test takes 30 seconds. |',
    '| "I\'ll fix it later" | Later never comes. First fix sets the pattern. |',
    '| "Should work now" | RUN the verification. Assumptions are bugs waiting to happen. |',
    '| "Just a quick fix" | Quick fixes become permanent. Follow the full process. |',
    '| "I\'ll test after I finish" | Tests written after code are weaker. Write them first. |',
    '| "The agent said it succeeded" | Verify independently. Trust but verify. |',
    '| "One more attempt should fix it" | 3+ failures = architectural problem. Step back. |',
    '| "This doesn\'t need a plan" | Plans prevent wasted effort. 5 minutes of planning saves hours. |',
    '| "I know this codebase" | Read the code anyway. Memory is unreliable. |',
    "",
  );

  L.push(
    "---", "",
    "## Defense-in-Depth Debugging", "",
    "After fixing any bug, validate at every layer the data passes through:", "",
    "1. **Entry point** — is the input correct where it enters the system?",
    "2. **Business logic** — does the transformation produce the right result?",
    "3. **Environment guards** — are configs, permissions, and dependencies correct?",
    "4. **Output verification** — does the final output match expectations?", "",
    "Don't stop at the first layer that looks correct. Bugs hide behind other bugs.",
    "",
  );

  return L.join("\n") + "\n";
}

function generateReadmeMd(info) {
  const name = info.name;
  const desc = info.description || "(Add project description)";
  const stacks = info.stacks.length ? info.stacks.join(", ") : "";
  const docRefs = rootDocRefs(Boolean(info.clean_root));

  const L = [`# ${name}`, "", desc, ""];
  if (stacks) L.push(`**Stack:** ${stacks}`, "");
  if (info.is_monorepo) L.push(`**Monorepo:** ${info.monorepo_tool || "detected"}`, "");

  L.push(
    "## Setup", "", `See [QUICKSTART.md](${docRefs.quickstart}) for commands.`, "",
    "## Documentation", "",
    `- [CLAUDE.md](${docRefs.claude}) — Full project context for Claude Code`,
    `- [STANDARDS.md](${docRefs.standards}) — QA and documentation rules`,
    `- [QUICKSTART.md](${docRefs.quickstart}) — Command reference`,
    `- [ERRORS_AND_LESSONS.md](${docRefs.errors}) — Mistake catalog`,
  );

  return L.join("\n") + "\n";
}

// ─────────────────────────────────────────────
// Ralph integration generators
// ─────────────────────────────────────────────

function generateRalphPromptMd(info) {
  const docRefs = ralphDocRefs(Boolean(info.clean_root));
  const L = [
    "# Ralph Development Instructions", "",
    "## Project Context", "",
    "All project context, architecture, conventions, and standards are maintained in the",
    "repository knowledge architecture files. Read them in this order:", "",
    `1. **[${docRefs.claude}](${docRefs.claude})** — Primary project context (architecture, stack, conventions)`,
    `2. **[${docRefs.standards}](${docRefs.standards})** — QA rules, tier system, naming conventions`,
    `3. **[${docRefs.errors}](${docRefs.errors})** — Mistakes catalog (read BEFORE starting work)`,
    "",
    "Do NOT duplicate information from those files here.", "",
    "## Ralph-Specific Instructions", "",
    "### Loop Behavior",
    "- Work through tasks in `.ralph/fix_plan.md` in priority order",
    "- After completing each task, mark the checkbox as done",
    "- Run tests after every meaningful change",
    "- If all tasks are complete, set `EXIT_SIGNAL: true` in your response", "",
    "### Progress Reporting",
    "At the end of each loop iteration, include this block:", "",
    "```",
    "RALPH_STATUS:",
    "{",
    '  "status": "in_progress|complete",',
    '  "current_task": "description of what you just did",',
    '  "next_task": "description of what comes next",',
    '  "tasks_remaining": N,',
    '  "EXIT_SIGNAL": false',
    "}",
    "```", "",
    "### Error Handling",
    `- If you encounter a recurring error, add it to \`${docRefs.errors}\``,
    "- If you're stuck on the same problem for 2+ loops, describe the blocker in RALPH_STATUS",
    "- Never silently skip a failing test", "",
    "### Auto-Documentation",
    "After completing a milestone:", "",
    `1. Update \`${docRefs.quickstart}\` if new commands were added (only if it has the AUTO-MAINTAINED marker)`,
    `2. Update \`${docRefs.claude}\` if architecture changed`,
    `3. Add errors/lessons to \`${docRefs.errors}\``,
  ];
  return L.join("\n") + "\n";
}

function generateRalphFixPlanMd(info) {
  const name = info.name || "project";
  const L = [
    "# Fix Plan — Task Priorities", "",
    "## Current Sprint", "",
    `- [ ] [P0] Define and implement core ${name} structure`,
    "- [ ] [P1] (Add your tasks here)",
    "- [ ] [P2] Write tests for core functionality",
    "- [ ] [P3] Documentation and cleanup", "",
    "## Completed", "",
    "(Ralph moves completed tasks here)",
  ];
  return L.join("\n") + "\n";
}

function generateRalphrc(info) {
  const name = info.name || "my-project";
  const stacks = info.stacks || [];

  const baseTools = "Write,Read,Edit,Bash(git *),Bash(cat *),Bash(ls *)";
  const stackTools = [];
  for (const stack of stacks) {
    if (RALPH_TOOLS_BY_STACK[stack]) stackTools.push(RALPH_TOOLS_BY_STACK[stack]);
  }
  const allTools = stackTools.length ? baseTools + "," + stackTools.join(",") : baseTools;
  const projectType = stacks[0] || "generic";

  const L = [
    "# .ralphrc — Ralph project configuration",
    `# Generated by claude-primer for ${name}`,
    "",
    "# ── Project identity ──",
    `PROJECT_NAME="${name}"`,
    `PROJECT_TYPE="${projectType}"`,
    "",
    "# ── Loop control ──",
    "MAX_CALLS_PER_HOUR=100",
    "CLAUDE_TIMEOUT_MINUTES=15",
    'CLAUDE_OUTPUT_FORMAT="json"',
    "",
    "# ── Tool permissions ──",
    "# Auto-generated from detected stacks. Adjust as needed.",
    `ALLOWED_TOOLS="${allTools}"`,
    "",
    "# ── Session management ──",
    "SESSION_CONTINUITY=true",
    "SESSION_EXPIRY_HOURS=24",
    "",
    "# ── Circuit breaker thresholds ──",
    "CB_NO_PROGRESS_THRESHOLD=3",
    "CB_SAME_ERROR_THRESHOLD=5",
  ];
  return L.join("\n") + "\n";
}

function generateRalphPostLoopHook(info) {
  const L = [
    "#!/usr/bin/env bash",
    "# .ralph/hooks/post-loop.sh",
    "# Called after each Ralph loop iteration",
    "# Checks if knowledge architecture files were modified",
    "",
    'CHANGED_FILES=$(git diff --name-only HEAD 2>/dev/null || true)',
    "",
    'if echo "$CHANGED_FILES" | grep -q "ERRORS_AND_LESSONS.md"; then',
    '  echo "[ralph-hook] New error/lesson added to catalog"',
    "fi",
    "",
    'if echo "$CHANGED_FILES" | grep -q "QUICKSTART.md"; then',
    '  echo "[ralph-hook] QUICKSTART.md updated (new commands discovered)"',
    "fi",
    "",
    'if echo "$CHANGED_FILES" | grep -q "CLAUDE.md"; then',
    '  echo "[ralph-hook] CLAUDE.md updated (architecture change)"',
    "fi",
  ];
  return L.join("\n") + "\n";
}

function setupRalph(target, info, dryRun = false, force = false) {
  const actions = [];
  const ralphDir = path.join(target, ".ralph");
  const hooksDir = path.join(ralphDir, "hooks");
  const docRefs = ralphDocRefs(Boolean(info.clean_root));

  if (!dryRun) {
    fs.mkdirSync(ralphDir, { recursive: true });
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  // 1. .ralph/PROMPT.md
  const promptPath = path.join(ralphDir, "PROMPT.md");
  const promptExists = existsSync(promptPath);
  let content = generateRalphPromptMd(info);
  if (!dryRun) fs.writeFileSync(promptPath, content, "utf-8");
  actions.push({ filename: ".ralph/PROMPT.md", action: promptExists ? "overwrite" : "create", lines: content.split("\n").length });

  // 2. .ralph/AGENT.md symlink
  const agentPath = path.join(ralphDir, "AGENT.md");
  const agentExists = existsSync(agentPath) || isSymlinkBroken(agentPath);
  if (!dryRun) {
    try { fs.unlinkSync(agentPath); } catch {}
    fs.symlinkSync(docRefs.quickstart, agentPath);
  }
  actions.push({ filename: ".ralph/AGENT.md", action: agentExists ? "overwrite" : "create", reason: `symlink → ${docRefs.quickstart}` });

  // 3. .ralph/fix_plan.md
  const fixPlanPath = path.join(ralphDir, "fix_plan.md");
  const fixPlanExists = existsSync(fixPlanPath);
  if (fixPlanExists) {
    actions.push({ filename: ".ralph/fix_plan.md", action: "skip", reason: "Ralph owns this file" });
  } else {
    content = generateRalphFixPlanMd(info);
    if (!dryRun) {
      fs.writeFileSync(fixPlanPath, content, "utf-8");
    }
    actions.push({ filename: ".ralph/fix_plan.md", action: "create", lines: content.split("\n").length, reason: "Ralph owns this file" });
  }

  // 4. .ralphrc
  const ralphrcPath = path.join(target, ".ralphrc");
  const ralphrcExists = existsSync(ralphrcPath);
  content = generateRalphrc(info);
  if (ralphrcExists && !force) {
    actions.push({ filename: ".ralphrc", action: "skip", reason: "exists" });
  } else {
    if (!dryRun) fs.writeFileSync(ralphrcPath, content, "utf-8");
    const mode = ralphrcExists ? "overwrite" : "create";
    actions.push({ filename: ".ralphrc", action: mode, lines: content.split("\n").length });
  }

  // 5. post-loop hook
  const hookPath = path.join(hooksDir, "post-loop.sh");
  const hookExists = existsSync(hookPath);
  content = generateRalphPostLoopHook(info);
  if (!dryRun) {
    fs.writeFileSync(hookPath, content, "utf-8");
    fs.chmodSync(hookPath, 0o755);
  }
  actions.push({ filename: ".ralph/hooks/post-loop.sh", action: hookExists ? "overwrite" : "create", lines: content.split("\n").length });

  // 6. .gitignore
  const gitignorePath = path.join(target, ".gitignore");
  const gitignoreExists = existsSync(gitignorePath);
  let existingGI = "";
  try { existingGI = fs.readFileSync(gitignorePath, "utf-8"); } catch {}
  if (!existingGI.includes(".ralph/logs/")) {
    if (!dryRun) fs.appendFileSync(gitignorePath, RALPH_GITIGNORE_ENTRIES, "utf-8");
    actions.push({ filename: ".gitignore", action: gitignoreExists ? "update" : "create", reason: "added Ralph entries" });
  }

  return actions;
}

// ─────────────────────────────────────────────
// Interactive wizard
// ─────────────────────────────────────────────

const FRAMEWORKS_BY_STACK = {
  python: ["django", "flask", "fastapi", "streamlit"],
  node: ["nextjs", "react", "vue", "svelte", "solidjs", "remix", "astro", "express", "nestjs", "hono"],
  rust: ["axum", "actix", "rocket"],
  go: ["gin", "fiber", "echo"],
  elixir: ["phoenix"],
  java: ["spring"],
  php: ["laravel"],
  dart: ["flutter"],
  ruby: [], dotnet: [], swift: [], zig: [], scala: [],
};

const DEPLOY_OPTIONS = ["docker", "vercel", "render", "fly.io", "github_actions", "gitlab_ci"];

const STACK_DISPLAY = {
  python: "Python", node: "Node.js/TypeScript", rust: "Rust",
  go: "Go", ruby: "Ruby", java: "Java/Kotlin", php: "PHP",
  dotnet: ".NET", elixir: "Elixir", swift: "Swift",
  dart: "Dart/Flutter", zig: "Zig", scala: "Scala",
};

async function pickMulti(prompt, options, display = null) {
  console.log(`\n  ${prompt}`);
  for (let i = 0; i < options.length; i++) {
    const label = display ? (display[options[i]] || options[i]) : options[i];
    console.log(`    ${String(i + 1).padStart(2)}) ${label}`);
  }
  console.log(`    Enter) skip`);
  const raw = (await _safeInput("  Choice (e.g. 1,3,5): ", "")).trim();
  if (!raw) return [];
  const selected = [];
  for (const part of raw.replace(/ /g, "").split(",")) {
    const idx = parseInt(part, 10) - 1;
    if (!isNaN(idx) && idx >= 0 && idx < options.length) {
      selected.push(options[idx]);
    } else {
      const lower = part.toLowerCase();
      const match = options.find((o) => o.toLowerCase() === lower);
      if (match) selected.push(match);
    }
  }
  // order-preserving dedup
  return [...new Map(selected.map((s) => [s, s])).keys()];
}

async function runWizard(info) {
  console.log("  No code detected — starting project wizard.");
  console.log("  Answer a few questions to generate contextual docs.");
  console.log("  Press Enter to skip any question.\n");

  const desc = (await _safeInput("  Project description (one line): ", "")).trim();
  if (desc) info.description = desc;

  const stackKeys = Object.keys(STACK_DISPLAY);
  const chosenStacks = await pickMulti("Which language(s)/runtime(s)?", stackKeys, STACK_DISPLAY);
  if (chosenStacks.length) info.stacks = chosenStacks;

  let availableFrameworks = [];
  for (const s of info.stacks) {
    availableFrameworks.push(...(FRAMEWORKS_BY_STACK[s] || []));
  }
  availableFrameworks = [...new Map(availableFrameworks.map((f) => [f, f])).keys()];
  if (availableFrameworks.length) {
    const chosenFrameworks = await pickMulti("Which framework(s)?", availableFrameworks);
    if (chosenFrameworks.length) info.frameworks = chosenFrameworks;
  }

  const chosenDeploy = await pickMulti("Deploy target(s)?", DEPLOY_OPTIONS);
  if (chosenDeploy.length) info.deploy = chosenDeploy;

  if (info.stacks.length > 1 || info.stacks.includes("node")) {
    const mono = (await _safeInput("\n  Is this a monorepo? [y/N]: ", "n")).trim().toLowerCase();
    if (mono === "y" || mono === "yes" || mono === "s" || mono === "sim") {
      info.is_monorepo = true;
      const tool = (await _safeInput("  Monorepo tool (turborepo/nx/pnpm/lerna) [Enter to skip]: ", "")).trim().toLowerCase();
      if (["turborepo", "nx", "pnpm", "lerna"].includes(tool)) info.monorepo_tool = tool;
    }
  }

  const hasConfig = !!(info.stacks.length || info.frameworks.length || info.description);
  if (hasConfig) {
    if (!info.existing_content) info.existing_content = {};
    if (!info.existing_content.sources) info.existing_content.sources = new Set();
    info.existing_content.sources.add("wizard");
    info.is_empty = false;

    console.log();
    console.log("  ─── Wizard summary ───");
    if (info.description) console.log(`  Description: ${info.description}`);
    if (info.stacks.length) console.log(`  Stacks: ${info.stacks.join(", ")}`);
    if (info.frameworks.length) console.log(`  Frameworks: ${info.frameworks.join(", ")}`);
    if (info.deploy.length) console.log(`  Deploy: ${info.deploy.join(", ")}`);
    if (info.is_monorepo) console.log(`  Monorepo: ${info.monorepo_tool || "yes"}`);
    console.log("  ──────────────────────\n");
  } else {
    console.log("\n  All questions skipped — generating generic templates.\n");
  }

  return info;
}

// ─────────────────────────────────────────────
// RC file persistence
// ─────────────────────────────────────────────

function rcPath(target) {
  return path.join(target, RC_FILENAME);
}

function loadRc(target) {
  const rc = rcPath(target);
  if (!existsSync(rc)) return {};
  try {
    const content = fs.readFileSync(rc, "utf-8");
    const result = {};
    const lines = content.split("\n");
    // Simple INI parser for [project] section
    let inProject = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === "[project]") { inProject = true; continue; }
      if (trimmed.startsWith("[")) { inProject = false; continue; }
      if (!inProject || !trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      // Remove surrounding whitespace
      if (key === "description" || key === "monorepo_tool") {
        result[key] = val;
      } else if (key === "stacks" || key === "frameworks" || key === "deploy") {
        result[key] = val ? val.split(",").map((v) => v.trim()).filter(Boolean) : [];
      } else if (key === "is_monorepo" || key === "with_ralph" || key === "clean_root") {
        result[key] = val.toLowerCase() === "true";
      }
    }
    return result;
  } catch { return {}; }
}

function saveRc(target, info) {
  const lines = [
    "# Generated by claude-primer — wizard answers",
    "# Re-run with --reconfigure to update",
    "",
    "[project]",
  ];
  if (info.description) lines.push(`description = ${info.description}`);
  for (const key of ["stacks", "frameworks", "deploy"]) {
    const vals = info[key] || [];
    if (vals.length) lines.push(`${key} = ${vals.join(", ")}`);
  }
  if (info.is_monorepo) {
    lines.push("is_monorepo = true");
    if (info.monorepo_tool) lines.push(`monorepo_tool = ${info.monorepo_tool}`);
  }
  if (info.with_ralph) lines.push("with_ralph = true");
  if (info.clean_root) lines.push("clean_root = true");
  try {
    fs.writeFileSync(rcPath(target), lines.join("\n") + "\n", "utf-8");
  } catch {}
}

function applyRc(info, rc) {
  for (const key of ["description", "is_monorepo", "monorepo_tool", "with_ralph", "clean_root"]) {
    if (key in rc && rc[key]) info[key] = rc[key];
  }
  for (const key of ["stacks", "frameworks", "deploy"]) {
    if (key in rc && rc[key] && rc[key].length) info[key] = rc[key];
  }
  if (Object.keys(rc).length) {
    if (!info.existing_content) info.existing_content = {};
    if (!info.existing_content.sources) info.existing_content.sources = new Set();
    info.existing_content.sources.add(RC_FILENAME);
    if (info.stacks && info.stacks.length) info.is_empty = false;
  }
  return info;
}

// ─────────────────────────────────────────────
// Post-generation verification
// ─────────────────────────────────────────────

function verifyGenerated(target, actions, cleanRoot = false) {
  const issues = [];
  for (const a of actions) {
    let fp;
    if (cleanRoot && a.filename !== "CLAUDE.md" && a.filename !== "README.md") {
      fp = path.join(target, ".claude", "docs", a.filename);
    } else {
      fp = path.join(target, a.filename);
    }
    if (!existsSync(fp)) {
      issues.push(`${a.filename}: file not written`);
      continue;
    }
    const content = fs.readFileSync(fp, "utf-8");
    if (!content.trim()) {
      issues.push(`${a.filename}: file is empty`);
      continue;
    }
    if (a.filename.endsWith(".md") && !/^#\s+/m.test(content)) {
      issues.push(`${a.filename}: missing markdown heading`);
    }
    if (a.filename === "CLAUDE.md" && !content.startsWith("---")) {
      issues.push("CLAUDE.md: missing YAML frontmatter");
    }
  }
  return issues;
}

// ─────────────────────────────────────────────
// Default files
// ─────────────────────────────────────────────

const DEFAULT_FILES = [
  ["CLAUDE.md", generateClaudeMd],
  ["QUICKSTART.md", generateQuickstartMd],
  ["STANDARDS.md", generateStandardsMd],
  ["ERRORS_AND_LESSONS.md", generateErrorsMd],
];

// ─────────────────────────────────────────────
// Main run function
// ─────────────────────────────────────────────

async function run(target, opts = {}) {
  const {
    dryRun = false, force = false, noGitCheck = false,
    withReadme = false, gitMode = "ask", interactive = true,
    reconfigure = false, forceAll = false, fromDoc = null,
    cleanRoot = false, templateDir = null,
    agents = null, outputFormat = "markdown",
    pluginDir = null,
  } = opts;
  let { withRalph = false } = opts;

  target = path.resolve(target);

  let targetExists = existsSync(target);
  if (!targetExists) {
    if (dryRun) {
      // ok
    } else {
      console.log(`Creating directory: ${target}`);
      fs.mkdirSync(target, { recursive: true });
      targetExists = true;
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  claude-primer v${__version__}`);
  console.log(`  Target: ${target}`);
  let modeLabel = dryRun ? "DRY RUN" : "LIVE";
  if (!interactive) modeLabel += " (non-interactive)";
  console.log(`  Mode:   ${modeLabel}`);
  console.log(`${"=".repeat(60)}\n`);

  // Build file list
  const filesToGenerate = [...DEFAULT_FILES];
  if (withReadme) filesToGenerate.push(["README.md", generateReadmeMd]);

  const filenames = filesToGenerate.map((f) => f[0]);

  // Scan
  let info;
  if (targetExists) {
    info = scanDirectory(target);
  } else {
    info = emptyScanResult(target);
  }

  // Load saved RC
  let rc = (targetExists && !reconfigure) ? loadRc(target) : {};
  if (Object.keys(rc).length && !reconfigure) {
    info = applyRc(info, rc);
    console.log(`  Config: loaded from ${RC_FILENAME}`);
    if (!withRalph && rc.with_ralph) withRalph = true;
  }

  if (withRalph) info.with_ralph = true;

  info.clean_root = cleanRoot;
  if (!cleanRoot && rc.clean_root) {
    info.clean_root = true;
  }
  const effectiveCleanRoot = info.clean_root;

  // Import from document
  if (fromDoc) {
    let docPath = fromDoc;
    if (!path.isAbsolute(docPath)) docPath = path.join(target, docPath);
    const docData = extractFromDocument(docPath);
    let ec = info.existing_content || {};
    if (!ec || !Object.keys(ec).length) {
      ec = { description: "", architecture_notes: "", commands: [], sources: new Set() };
      info.existing_content = ec;
    }
    if (!ec.description && docData.description) ec.description = docData.description;
    if (!ec.architecture_notes && docData.architecture_notes) ec.architecture_notes = docData.architecture_notes;
    if (docData.commands.length) {
      const existingCmds = new Set(ec.commands || []);
      for (const cmd of docData.commands) {
        if (!existingCmds.has(cmd)) {
          if (!ec.commands) ec.commands = [];
          ec.commands.push(cmd);
        }
      }
    }
    if (docData.sources.size) {
      if (!ec.sources) ec.sources = new Set();
      for (const s of docData.sources) ec.sources.add(s);
    }
    if (!info.description && docData.description) info.description = docData.description;
    console.log(`  From-doc: ${path.basename(docPath)}`);
  }

  // Wizard
  const needsWizard = (info.is_empty && !info.stacks.length) || reconfigure;
  if (needsWizard && interactive && !dryRun) {
    info = await runWizard(info);
    if (targetExists && info.stacks.length) {
      saveRc(target, info);
      console.log(`  Config: saved to ${RC_FILENAME}`);
    }
  } else if (needsWizard && !interactive) {
    console.log("  Project: EMPTY (use interactive mode for guided setup)\n");
  }

  // Tier detection
  info.tier = detectProjectTier(info);

  // Load user templates
  const tplDir = templateDir || path.join(target, ".claude-primer", "templates");
  const userTemplates = loadTemplates(tplDir);
  if (Object.keys(userTemplates).length) {
    info._templates = userTemplates;
    info._templateVars = buildTemplateVariables(info);
    console.log(`  Templates: loaded from ${tplDir}`);
  }

  const ec = info.existing_content || {};

  // Write plan
  const writePlan = [];
  const generators = Object.fromEntries(filesToGenerate);
  const contentCache = {};
  for (const [filename, generator] of filesToGenerate) {
    let actualPath;
    if (effectiveCleanRoot && filename !== "CLAUDE.md" && filename !== "README.md") {
      actualPath = path.join(target, ".claude", "docs", filename);
    } else {
      actualPath = path.join(target, filename);
    }
    const exists = targetExists && existsSync(actualPath);
    if (exists && !force && !forceAll) {
      writePlan.push({ filename, exists, mode: "skip", reason: "exists", actualPath });
    } else if (exists && (force || forceAll)) {
      if (force && !forceAll) {
        let newContent = generator(info);
        if (Object.keys(userTemplates).length) {
          newContent = mergeWithTemplates(newContent, userTemplates, info._templateVars || {}, filename);
        }
        contentCache[filename] = newContent;
        const oldContent = fs.readFileSync(actualPath, "utf-8");
        if (newContent === oldContent) {
          writePlan.push({ filename, exists, mode: "skip", reason: "unchanged", actualPath });
        } else {
          writePlan.push({ filename, exists, mode: "overwrite", actualPath });
        }
      } else {
        writePlan.push({ filename, exists, mode: "overwrite", actualPath });
      }
    } else {
      writePlan.push({ filename, exists, mode: "create", actualPath });
    }
  }

  const overwriteTargets = writePlan.filter((pw) => pw.mode === "overwrite").map((pw) => pw.filename);

  // Git safety
  const result = { actions: [], git_action: "" };

  if (!noGitCheck && !dryRun && overwriteTargets.length) {
    const gitAction = await runGitSafety(target, gitMode, overwriteTargets, interactive);
    result.git_action = gitAction;
    if (gitAction === "aborted") return result;
    console.log();
  } else {
    result.git_action = noGitCheck ? "no-git" : "skipped";
  }

  // Report
  if (info.is_empty) {
    console.log("  Project: EMPTY — creating template structure\n");
  } else if (info.file_count === 0 && info.stacks.length) {
    console.log(`  Project: NEW (configured via wizard)`);
    console.log(`  Stacks: ${info.stacks.join(", ")}`);
    if (info.frameworks.length) console.log(`  Frameworks: ${info.frameworks.join(", ")}`);
    const tier = info.tier;
    console.log(`  Suggested tier: T${tier.tier} (${tier.confidence} confidence)`);
    if (info.deploy.length) console.log(`  Deploy: ${info.deploy.join(", ")}`);
    if (info.is_monorepo) console.log(`  Monorepo: ${info.monorepo_tool || "yes"}`);
    console.log();
  } else {
    console.log(`  Project: EXISTING (${info.file_count} files)`);
    console.log(`  Stacks: ${info.stacks.join(", ") || "none"}`);
    console.log(`  Frameworks: ${info.frameworks.join(", ") || "none"}`);
    const tier = info.tier;
    console.log(`  Suggested tier: T${tier.tier} (${tier.confidence} confidence)`);
    if (info.deploy.length) console.log(`  Deploy: ${info.deploy.join(", ")}`);
    if (info.is_monorepo) console.log(`  Monorepo: ${info.monorepo_tool} (${info.workspace_dirs.join(", ") || "no workspace dirs"})`);
    if (info.existing_docs.length) console.log(`  Docs: ${info.existing_docs.join(", ")}`);
    if (info.sub_projects.length) {
      console.log(`  Sub-projects: ${info.sub_projects.slice(0, 10).join(", ")}`);
      if (info.sub_projects.length > 10) console.log(`    ... and ${info.sub_projects.length - 10} more`);
    }
    const sources = ec.sources || new Set();
    if (sources.size) console.log(`  Extracted from: ${[...sources].sort().join(", ")}`);
    console.log();
  }

  // Generate
  if (effectiveCleanRoot && !dryRun) {
    fs.mkdirSync(path.join(target, ".claude", "docs"), { recursive: true });
  }

  for (const pw of writePlan) {
    if (pw.mode === "skip") {
      result.actions.push({ filename: pw.filename, action: "skip", lines: 0, reason: pw.reason });
      continue;
    }

    let content = contentCache[pw.filename] || generators[pw.filename](info);
    if (Object.keys(userTemplates).length) {
      content = mergeWithTemplates(content, userTemplates, info._templateVars || {}, pw.filename);
    }
    const lineCount = content.split("\n").length;
    const writePath = pw.actualPath || path.join(target, pw.filename);
    if (!dryRun) {
      fs.mkdirSync(path.dirname(writePath), { recursive: true });
      fs.writeFileSync(writePath, content, "utf-8");
    }
    result.actions.push({ filename: pw.filename, action: pw.mode, lines: lineCount });
  }

  // Verification
  const createdCount = result.actions.filter((a) => a.action === "create" || a.action === "overwrite").length;
  const skippedCount = result.actions.filter((a) => a.action === "skip").length;

  if (!dryRun && createdCount > 0) {
    const errors = verifyGenerated(target, result.actions.filter((a) => a.action === "create" || a.action === "overwrite"), effectiveCleanRoot);
    if (errors.length) {
      console.log(`\n  Warning: Verification issues:`);
      for (const err of errors) console.log(`    - ${err}`);
    }
  }

  // Ralph
  if (withRalph) {
    const ralphActions = setupRalph(target, info, dryRun, force);
    result.actions.push(...ralphActions);
  }

  // Multi-agent output
  if (agents && agents.length) {
    const agentActions = writeAgentFiles(target, info, agents, outputFormat, dryRun);
    result.actions.push(...agentActions);
  }

  // Plugin extensions
  const pluginDirPath = opts.pluginDir || path.join(target, ".claude-primer", "plugins");
  const plugins = await loadPlugins(pluginDirPath);
  if (plugins.length) {
    console.log(`  Plugins: ${plugins.length} loaded from ${pluginDirPath}`);
    const pluginActions = await runPlugins(target, info, plugins, dryRun);
    result.actions.push(...pluginActions);
  }

  // Memory directory
  const mem = path.join(target, ".claude", "projects");
  if (!dryRun && targetExists && !existsSync(mem)) {
    fs.mkdirSync(mem, { recursive: true });
    result.actions.push({ filename: ".claude/projects/", action: "create" });
  } else if (dryRun && (!targetExists || !existsSync(mem))) {
    result.actions.push({ filename: ".claude/projects/", action: "create" });
  }

  // Output
  const totalCreated = result.actions.filter((a) => a.action === "create" || a.action === "overwrite").length;
  const totalSkipped = result.actions.filter((a) => a.action === "skip").length;

  console.log("\u2500".repeat(50));
  for (const a of result.actions) {
    let label = a.action.toUpperCase();
    if (dryRun && a.action !== "skip") label += " [DRY RUN]";
    const extra = a.lines ? ` (${a.lines} lines)` : "";
    const reason = a.reason ? ` — ${a.reason}` : "";
    console.log(`  ${label.padEnd(20)} ${a.filename}${extra}${reason}`);
  }
  console.log("\u2500".repeat(50));

  console.log(`\n  Created: ${totalCreated}  Skipped: ${totalSkipped}`);

  if (totalSkipped && !force) {
    console.log(`\n  Tip: Use --force to overwrite existing files`);
  }

  if (!filenames.includes("README.md")) {
    console.log(`  Note: README.md not included (use --with-readme to generate)`);
  }

  if (effectiveCleanRoot) {
    console.log(`  Note: .claude/ may be in .gitignore. Ensure .claude/docs/ is tracked if needed.`);
  }

  if (!dryRun && totalCreated > 0) {
    console.log(`\n  Next steps:`);
    console.log(`  1. Review generated files — sections containing 'placeholder' need input`);
    console.log(`  2. Sections containing 'migrated' came from existing files — verify accuracy`);
    console.log(`  3. Sections containing 'inferred' were detected — may need correction`);

    if (withRalph) {
      console.log(`\n  Ralph integration:`);
      console.log(`  4. Edit .ralph/fix_plan.md with your tasks`);
      console.log(`  5. Review .ralphrc tool permissions`);
      console.log(`  6. Start: ralph --monitor`);
    }

    if (info.has_git) {
      const genFiles = result.actions
        .filter((a) => (a.action === "create" || a.action === "overwrite") && !a.filename.includes("/"))
        .map((a) => a.filename);
      if (genFiles.length) {
        console.log(`\n  Git tip:`);
        console.log(`    git add ${genFiles.join(" ")}`);
        console.log(`    git commit -m 'docs: bootstrap Claude Code knowledge architecture'`);
      }
      if (result.git_action === "stash") {
        console.log(`\n  Don't forget: your previous changes are stashed.`);
        console.log(`    git stash pop   # restore stashed changes`);
      }
    }
  }

  console.log();
  return result;
}

// ─────────────────────────────────────────────
// Plugin system
// ─────────────────────────────────────────────

async function loadPlugins(pluginDir) {
  const plugins = [];
  if (!fs.existsSync(pluginDir) || !fs.statSync(pluginDir).isDirectory()) return plugins;
  const files = fs.readdirSync(pluginDir).filter(f => f.endsWith(".mjs")).sort();
  for (const f of files) {
    try {
      const mod = await import(path.resolve(pluginDir, f));
      if (typeof mod.default === "function") {
        plugins.push({ name: f, generate: mod.default });
      }
    } catch (e) {
      console.log(`  Warning: plugin ${f} failed to load: ${e.message}`);
    }
  }
  return plugins;
}

async function runPlugins(target, info, plugins, dryRun = false) {
  const actions = [];
  for (const plugin of plugins) {
    try {
      let result = await plugin.generate(info);
      if (!Array.isArray(result)) result = [result];
      for (const item of result) {
        if (!item.filename || !item.content) continue;
        const filepath = path.join(target, item.filename);
        const exists = fs.existsSync(filepath);
        if (!dryRun) {
          fs.mkdirSync(path.dirname(filepath), { recursive: true });
          fs.writeFileSync(filepath, item.content, "utf-8");
        }
        actions.push({ filename: item.filename, action: exists ? "overwrite" : "create",
                       lines: item.content.split("\n").length });
      }
    } catch (e) {
      console.log(`  Warning: plugin ${plugin.name} failed: ${e.message}`);
    }
  }
  return actions;
}

// ─────────────────────────────────────────────
// Template system
// ─────────────────────────────────────────────

const _TEMPLATE_FILE_MAP = {
  "claude.md": "CLAUDE.md",
  "standards.md": "STANDARDS.md",
  "quickstart.md": "QUICKSTART.md",
  "errors.md": "ERRORS_AND_LESSONS.md",
};

function loadTemplates(templateDir) {
  const templates = {};
  if (!existsSync(templateDir) || !fs.statSync(templateDir).isDirectory()) return templates;
  for (const f of fs.readdirSync(templateDir)) {
    if (!f.endsWith(".md")) continue;
    const outputFile = _TEMPLATE_FILE_MAP[f.toLowerCase()] || f.toUpperCase();
    const content = fs.readFileSync(path.join(templateDir, f), "utf-8");
    const sections = extractMdSections(content);
    if (Object.keys(sections).length) {
      templates[outputFile] = {};
      for (const [k, v] of Object.entries(sections)) templates[outputFile][k.toLowerCase()] = v;
    } else if (content.trim()) {
      templates[outputFile] = { "__full__": content };
    }
  }
  return templates;
}

function buildTemplateVariables(info) {
  const tier = info.tier || {};
  return {
    project_name: info.name || "",
    tech_stack: (info.stacks || []).join(", "),
    frameworks: (info.frameworks || []).join(", "),
    tier: `T${tier.tier || 3}`,
    deploy: (info.deploy || []).join(", "),
    date: new Date().toISOString().slice(0, 10),
    description: info.description || "",
  };
}

function applyTemplateSubstitution(content, variables) {
  for (const [key, val] of Object.entries(variables)) {
    content = content.replaceAll(`{{${key}}}`, val);
  }
  return content;
}

function mergeWithTemplates(generated, templates, variables, outputFile) {
  const fileTemplates = templates[outputFile];
  if (!fileTemplates) return generated;
  if (fileTemplates.__full__) return applyTemplateSubstitution(fileTemplates.__full__, variables);

  const lines = generated.split("\n");
  const result = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      const header = line.slice(3).trim().toLowerCase();
      if (header in fileTemplates) {
        result.push(line);
        i++;
        while (i < lines.length && !lines[i].startsWith("## ") && !(lines[i].trim() === "---" && i + 1 < lines.length && lines[i + 1].startsWith("## "))) {
          i++;
        }
        const templateBody = applyTemplateSubstitution(fileTemplates[header], variables);
        result.push(templateBody.trimEnd());
        result.push("");
        continue;
      }
    }
    result.push(line);
    i++;
  }
  return result.join("\n");
}

// ─────────────────────────────────────────────
// Multi-agent context output
// ─────────────────────────────────────────────

const AGENT_CONVENTIONS = {
  claude: { file: "CLAUDE.md", dir: null },
  cursor: { file: ".cursor/rules/project.mdc", dir: ".cursor/rules" },
  copilot: { file: ".github/copilot-instructions.md", dir: ".github" },
  windsurf: { file: ".windsurfrules", dir: null },
  aider: { file: ".aider/conventions.md", dir: ".aider" },
  codex: { file: "AGENTS.md", dir: null },
};

function agentCoreContext(info) {
  const ec = info.existing_content || {};
  const tier = info.tier || {};
  return {
    project_name: info.name || "",
    description: info.description || ec.description || "",
    stacks: info.stacks || [],
    frameworks: info.frameworks || [],
    deploy: info.deploy || [],
    tier: `T${tier.tier || 3}`,
    commands: ec.commands || [],
    architecture: ec.architecture_notes || "",
    env_notes: ec.env_notes || "",
    formatting_rules: ec.formatting_rules || [],
    test_dirs: info.test_dirs || [],
    sub_projects: info.sub_projects || [],
    is_monorepo: info.is_monorepo || false,
  };
}

function generateCursorRules(info) {
  const ctx = agentCoreContext(info);
  const L = [
    "---", `description: Project context for ${ctx.project_name}`,
    'globs: ["**/*"]', "alwaysApply: true", "---", "",
    `# ${ctx.project_name}`, "",
  ];
  if (ctx.description) L.push(ctx.description, "");
  L.push("## Tech Stack", "", `- **Languages:** ${ctx.stacks.join(", ") || "not detected"}`,
    `- **Frameworks:** ${ctx.frameworks.join(", ") || "none"}`);
  if (ctx.deploy.length) L.push(`- **Deploy:** ${ctx.deploy.join(", ")}`);
  L.push("");
  if (ctx.commands.length) {
    L.push("## Commands", "", "```bash");
    for (const cmd of ctx.commands.slice(0, 15)) L.push(cmd);
    L.push("```", "");
  }
  if (ctx.architecture) L.push("## Architecture", "", ctx.architecture.slice(0, 2000), "");
  if (ctx.formatting_rules.length) {
    L.push("## Code Style", "");
    for (const r of ctx.formatting_rules.slice(0, 10)) L.push(`- ${r}`);
    L.push("");
  }
  return L.join("\n") + "\n";
}

function generateCopilotInstructions(info) {
  const ctx = agentCoreContext(info);
  const L = [`# ${ctx.project_name} — Copilot Instructions`, ""];
  if (ctx.description) L.push(ctx.description, "");
  L.push("## Project Overview", "",
    `- **Stack:** ${ctx.stacks.join(", ") || "not detected"}`,
    `- **Frameworks:** ${ctx.frameworks.join(", ") || "none"}`,
    `- **Tier:** ${ctx.tier}`, "");
  if (ctx.commands.length) {
    L.push("## Common Commands", "", "```bash");
    for (const cmd of ctx.commands.slice(0, 15)) L.push(cmd);
    L.push("```", "");
  }
  if (ctx.architecture) L.push("## Architecture", "", ctx.architecture.slice(0, 2000), "");
  if (ctx.formatting_rules.length) {
    L.push("## Coding Conventions", "");
    for (const r of ctx.formatting_rules.slice(0, 10)) L.push(`- ${r}`);
    L.push("");
  }
  return L.join("\n") + "\n";
}

function generateWindsurfRules(info) {
  const ctx = agentCoreContext(info);
  const L = [`# ${ctx.project_name} Rules`, ""];
  if (ctx.description) L.push(ctx.description, "");
  L.push(`Stack: ${ctx.stacks.join(", ") || "not detected"}`,
    `Frameworks: ${ctx.frameworks.join(", ") || "none"}`, "");
  if (ctx.commands.length) {
    L.push("## Commands", "", "```bash");
    for (const cmd of ctx.commands.slice(0, 15)) L.push(cmd);
    L.push("```", "");
  }
  if (ctx.architecture) L.push("## Architecture", "", ctx.architecture.slice(0, 2000), "");
  if (ctx.formatting_rules.length) {
    L.push("## Style", "");
    for (const r of ctx.formatting_rules.slice(0, 10)) L.push(`- ${r}`);
    L.push("");
  }
  return L.join("\n") + "\n";
}

function generateAiderConventions(info) {
  const ctx = agentCoreContext(info);
  const L = [`# Conventions for ${ctx.project_name}`, "",
    `**Stack:** ${ctx.stacks.join(", ") || "not detected"}`,
    `**Frameworks:** ${ctx.frameworks.join(", ") || "none"}`, ""];
  if (ctx.test_dirs.length) {
    L.push("## Test Directories", "");
    for (const td of ctx.test_dirs.slice(0, 10)) L.push(`- \`${td}/\``);
    L.push("");
  }
  if (ctx.commands.length) {
    L.push("## Key Commands", "", "```bash");
    for (const cmd of ctx.commands.slice(0, 15)) L.push(cmd);
    L.push("```", "");
  }
  if (ctx.formatting_rules.length) {
    L.push("## Formatting", "");
    for (const r of ctx.formatting_rules.slice(0, 10)) L.push(`- ${r}`);
    L.push("");
  }
  if (ctx.architecture) L.push("## Architecture Notes", "", ctx.architecture.slice(0, 2000), "");
  return L.join("\n") + "\n";
}

function generateCodexAgents(info) {
  const ctx = agentCoreContext(info);
  const L = ["# AGENTS.md", "", `## ${ctx.project_name}`, ""];
  if (ctx.description) L.push(ctx.description, "");
  L.push("## Workspace", "",
    `- **Languages:** ${ctx.stacks.join(", ") || "not detected"}`,
    `- **Frameworks:** ${ctx.frameworks.join(", ") || "none"}`);
  if (ctx.is_monorepo) {
    L.push("- **Monorepo:** yes");
    if (ctx.sub_projects.length) L.push(`- **Sub-projects:** ${ctx.sub_projects.slice(0, 10).join(", ")}`);
  }
  L.push("");
  if (ctx.commands.length) {
    L.push("## Setup & Commands", "", "```bash");
    for (const cmd of ctx.commands.slice(0, 15)) L.push(cmd);
    L.push("```", "");
  }
  if (ctx.architecture) L.push("## Architecture", "", ctx.architecture.slice(0, 2000), "");
  return L.join("\n") + "\n";
}

const AGENT_GENERATORS = {
  cursor: generateCursorRules,
  copilot: generateCopilotInstructions,
  windsurf: generateWindsurfRules,
  aider: generateAiderConventions,
  codex: generateCodexAgents,
};

function writeAgentFiles(target, info, agents, fmt = "markdown", dryRun = false) {
  const actions = [];
  const ctx = agentCoreContext(info);
  for (const agent of agents) {
    if (agent === "claude") continue;
    const conv = AGENT_CONVENTIONS[agent];
    if (!conv) continue;
    const generator = AGENT_GENERATORS[agent];
    if (!generator) continue;

    let content, filepath;
    if (fmt === "markdown") {
      content = generator(info);
      filepath = path.join(target, conv.file);
    } else if (fmt === "json") {
      content = JSON.stringify(ctx, null, 2) + "\n";
      filepath = path.join(target, `.claude-primer-${agent}.json`);
    } else if (fmt === "yaml") {
      const yamlLines = [];
      for (const [k, v] of Object.entries(ctx)) {
        if (Array.isArray(v)) {
          if (!v.length) { yamlLines.push(`${k}: []`); continue; }
          yamlLines.push(`${k}:`);
          for (const item of v) yamlLines.push(`  - ${item}`);
        } else if (typeof v === "boolean") {
          yamlLines.push(`${k}: ${v}`);
        } else {
          yamlLines.push(`${k}: ${v}`);
        }
      }
      content = yamlLines.join("\n") + "\n";
      filepath = path.join(target, `.claude-primer-${agent}.yaml`);
    } else continue;

    const exists = existsSync(filepath);
    if (!dryRun) {
      fs.mkdirSync(path.dirname(filepath), { recursive: true });
      fs.writeFileSync(filepath, content, "utf-8");
    }
    actions.push({ filename: path.relative(target, filepath), action: exists ? "overwrite" : "create", lines: content.split("\n").length });
  }
  return actions;
}

// ─────────────────────────────────────────────
// Watch mode
// ─────────────────────────────────────────────

const _WATCH_FILES = [
  "package.json", "pyproject.toml", "Cargo.toml", "go.mod", "mix.exs",
  "pubspec.yaml", "composer.json", "build.gradle", "pom.xml", "build.sbt",
  "Makefile", "Dockerfile", "docker-compose.yml", "docker-compose.yaml",
  "README.md", "CLAUDE.md", "STANDARDS.md", ".env", ".env.example",
  "requirements.txt", "Pipfile", "setup.py", "setup.cfg",
];

function getWatchTargets(root) {
  const mtimes = {};
  for (const f of _WATCH_FILES) {
    const fp = path.join(root, f);
    try { if (existsSync(fp)) mtimes[f] = fs.statSync(fp).mtimeMs; } catch {}
  }
  const wfDir = path.join(root, ".github", "workflows");
  if (existsSync(wfDir) && fs.statSync(wfDir).isDirectory()) {
    try {
      for (const item of fs.readdirSync(wfDir)) {
        if (item.endsWith(".yml") || item.endsWith(".yaml")) {
          const rel = `.github/workflows/${item}`;
          mtimes[rel] = fs.statSync(path.join(wfDir, item)).mtimeMs;
        }
      }
    } catch {}
  }
  return mtimes;
}

function diffScanResults(oldInfo, newInfo) {
  const diffs = [];
  const oldStacks = new Set(oldInfo.stacks || []);
  const newStacks = new Set(newInfo.stacks || []);
  for (const s of newStacks) if (!oldStacks.has(s)) diffs.push(`Stack added: ${s}`);
  for (const s of oldStacks) if (!newStacks.has(s)) diffs.push(`Stack removed: ${s}`);
  const oldFws = new Set(oldInfo.frameworks || []);
  const newFws = new Set(newInfo.frameworks || []);
  for (const f of newFws) if (!oldFws.has(f)) diffs.push(`Framework added: ${f}`);
  for (const f of oldFws) if (!newFws.has(f)) diffs.push(`Framework removed: ${f}`);
  const oldSubs = new Set(oldInfo.sub_projects || []);
  const newSubs = new Set(newInfo.sub_projects || []);
  for (const s of newSubs) if (!oldSubs.has(s)) diffs.push(`Sub-project added: ${s}`);
  if (Math.abs((newInfo.file_count || 0) - (oldInfo.file_count || 0)) > 5)
    diffs.push(`File count: ${oldInfo.file_count || 0} -> ${newInfo.file_count || 0}`);
  return diffs;
}

async function runWatch(target, interval = 5, auto = false, runKwargs = {}) {
  target = path.resolve(target);
  console.log(`\n  Watching ${target} (interval: ${interval}s, auto-update: ${auto})`);
  console.log(`  Press Ctrl+C to stop.\n`);

  let mtimes = getWatchTargets(target);
  let lastScan = scanDirectory(target);

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  process.on("SIGINT", () => { console.log("\n  Watch stopped."); process.exit(0); });

  while (true) {
    await sleep(interval * 1000);
    let newMtimes = getWatchTargets(target);
    const changed = Object.keys(newMtimes).filter(k => newMtimes[k] !== mtimes[k]);
    const newFiles = Object.keys(newMtimes).filter(k => !(k in mtimes));
    const removedFiles = Object.keys(mtimes).filter(k => !(k in newMtimes));

    if (changed.length || newFiles.length || removedFiles.length) {
      const ts = new Date().toLocaleTimeString("en-GB", { hour12: false });
      console.log(`  [${ts}] Changes detected:`);
      for (const f of changed.sort()) console.log(`    Modified: ${f}`);
      for (const f of newFiles.sort()) console.log(`    Added: ${f}`);
      for (const f of removedFiles.sort()) console.log(`    Removed: ${f}`);

      let newScan = scanDirectory(target);
      const diffs = diffScanResults(lastScan, newScan);
      if (diffs.length) {
        console.log("  Impact:");
        for (const d of diffs) console.log(`    ${d}`);
      }

      if (auto) {
        console.log("  Auto-regenerating...");
        await run(target, runKwargs);
        // Re-snapshot after run() so our own writes don't re-trigger
        newMtimes = getWatchTargets(target);
        newScan = scanDirectory(target);
      } else {
        console.log("  Run 'claude-primer --force' to regenerate.\n");
      }

      mtimes = newMtimes;
      lastScan = newScan;
    }
  }
}

// ─────────────────────────────────────────────
// plan-json
// ─────────────────────────────────────────────

function planJson(target, withReadme = false) {
  target = path.resolve(target);

  const filesToGenerate = [...DEFAULT_FILES];
  if (withReadme) filesToGenerate.push(["README.md", generateReadmeMd]);

  let info;
  if (existsSync(target)) {
    info = scanDirectory(target);
  } else {
    info = emptyScanResult(target);
  }

  info.tier = detectProjectTier(info);

  const writePlan = [];
  for (const [filename] of filesToGenerate) {
    const exists = existsSync(target) && existsSync(path.join(target, filename));
    writePlan.push({ filename, exists, mode: exists ? "skip" : "create" });
  }

  const gitInfo = existsSync(target) ? gitCheck(target) : { is_git: false, dirty: false, branch: "" };
  let gitRecommendation = "skip";
  if (gitInfo.is_git) {
    const anyOverwrite = writePlan.some((wp) => wp.exists);
    if (gitInfo.dirty && anyOverwrite) gitRecommendation = "stash";
    else if (anyOverwrite) gitRecommendation = "safe";
    else gitRecommendation = "skip";
  }

  const ec = info.existing_content || {};
  const sources = [...(ec.sources || [])];

  return {
    target,
    name: info.name,
    stacks: info.stacks,
    frameworks: info.frameworks,
    deploy: info.deploy || [],
    is_monorepo: info.is_monorepo || false,
    monorepo_tool: info.monorepo_tool || "",
    workspace_dirs: info.workspace_dirs || [],
    tier: info.tier,
    file_count: info.file_count || 0,
    has_git: info.has_git || false,
    existing_docs: info.existing_docs || [],
    sub_projects: info.sub_projects || [],
    sub_project_details: info.sub_project_details || [],
    extracted_from: sources,
    write_plan: writePlan,
    confidence_scores: info.confidence_scores || {},
    git: {
      is_git: gitInfo.is_git || false,
      dirty: gitInfo.dirty || false,
      branch: gitInfo.branch || "",
      recommendation: gitRecommendation,
    },
  };
}

// ─────────────────────────────────────────────
// Argument parsing
// ─────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    target: ".",
    dryRun: false,
    force: false,
    forceAll: false,
    yes: false,
    withReadme: false,
    withRalph: false,
    noGitCheck: false,
    planJsonFlag: false,
    reconfigure: false,
    cleanRoot: false,
    fromDoc: null,
    gitMode: "ask",
    templateDir: null,
    watch: false,
    watchInterval: 5,
    watchAuto: false,
    agent: null,
    format: "markdown",
  };

  const positional = [];
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    switch (arg) {
      case "--dry-run": args.dryRun = true; break;
      case "--force": args.force = true; break;
      case "--force-all": args.forceAll = true; break;
      case "--yes": case "-y": args.yes = true; break;
      case "--with-readme": args.withReadme = true; break;
      case "--with-ralph": args.withRalph = true; break;
      case "--no-git-check": args.noGitCheck = true; break;
      case "--plan-json": args.planJsonFlag = true; break;
      case "--reconfigure": args.reconfigure = true; break;
      case "--clean-root": args.cleanRoot = true; break;
      case "--from-doc":
        i++;
        args.fromDoc = argv[i] || null;
        break;
      case "--git-mode":
        i++;
        if (argv[i] && ["ask", "stash", "skip"].includes(argv[i])) {
          args.gitMode = argv[i];
        }
        break;
      case "--template-dir":
        i++;
        args.templateDir = argv[i] || null;
        break;
      case "--watch": args.watch = true; break;
      case "--watch-interval":
        i++;
        args.watchInterval = parseInt(argv[i], 10) || 5;
        break;
      case "--watch-auto": args.watchAuto = true; break;
      case "--agent":
        i++;
        args.agent = argv[i] || null;
        break;
      case "--format":
        i++;
        if (argv[i] && ["markdown", "yaml", "json"].includes(argv[i])) {
          args.format = argv[i];
        }
        break;
      case "--plugin-dir":
        i++;
        args.pluginDir = argv[i] || null;
        break;
      case "--telemetry-off": args.telemetryOff = true; break;
      case "--help": case "-h":
        console.log(`claude-primer — Claude Code Knowledge Architecture Bootstrap

Usage:
  claude-primer                            # current directory, interactive
  claude-primer /path/to/repo              # specific directory
  claude-primer --dry-run                  # preview without writing
  claude-primer --force                    # overwrite changed files (skip unchanged)
  claude-primer --force-all                # overwrite all files unconditionally
  claude-primer --yes                      # accept all defaults (no prompts)
  claude-primer --with-readme              # also generate README.md
  claude-primer --with-ralph               # generate Ralph integration files
  claude-primer --no-git-check             # skip git safety entirely
  claude-primer --plan-json                # output project analysis as JSON
  claude-primer --reconfigure              # re-run wizard (ignores saved .claude-setup.rc)
  claude-primer --clean-root               # move aux docs to .claude/docs/
  claude-primer --from-doc <file>          # bootstrap from an existing document
  claude-primer --git-mode ask|stash|skip  # git safety mode
  claude-primer --template-dir <dir>       # template overrides directory
  claude-primer --watch                    # watch for changes (poll-based)
  claude-primer --watch-interval <secs>    # polling interval (default: 5)
  claude-primer --watch-auto               # auto-regenerate on change
  claude-primer --agent <agents>           # target: claude,cursor,copilot,windsurf,aider,codex,all
  claude-primer --format markdown|yaml|json # output format for agent files
  claude-primer --plugin-dir <dir>         # plugin generators directory
  claude-primer --telemetry-off            # disable telemetry`);
        process.exit(0);
        break;
      default:
        if (!arg.startsWith("-")) positional.push(arg);
        break;
    }
    i++;
  }

  if (positional.length) args.target = positional[0];
  return args;
}

// ─────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────

function collectTelemetry(args, info, durationMs) {
  const flags = [];
  if (args.dryRun) flags.push("dry-run");
  if (args.force) flags.push("force");
  if (args.forceAll) flags.push("force-all");
  if (args.withReadme) flags.push("with-readme");
  if (args.withRalph) flags.push("with-ralph");
  if (args.noGitCheck) flags.push("no-git-check");
  if (args.planJsonFlag) flags.push("plan-json");
  if (args.reconfigure) flags.push("reconfigure");
  if (args.cleanRoot) flags.push("clean-root");
  if (args.watch) flags.push("watch");
  if (args.watchAuto) flags.push("watch-auto");
  if (args.agent) flags.push(`agent=${args.agent}`);
  if (args.format !== "markdown") flags.push(`format=${args.format}`);
  if (args.templateDir) flags.push("template-dir");
  if (args.pluginDir) flags.push("plugin-dir");

  return {
    v: 1,
    tool_version: __version__,
    command: args.planJsonFlag ? "plan-json" : (args.watch ? "watch" : "run"),
    flags,
    stacks: info.stacks || [],
    frameworks: info.frameworks || [],
    tier: info.tier?.tier ?? null,
    is_monorepo: info.is_monorepo || false,
    file_count: info.file_count || 0,
    duration_s: Math.round(durationMs / 1000 * 100) / 100,
    platform: process.platform,
  };
}

function sendTelemetryIfEnabled(args, info, durationMs) {
  if (process.env.CLAUDE_PRIMER_TELEMETRY !== "1") return;
  if (args.telemetryOff) return;

  const url = process.env.CLAUDE_PRIMER_TELEMETRY_URL ||
              "https://telemetry.claude-primer.dev/v1/events";
  const payload = collectTelemetry(args, info, durationMs);

  try {
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {}); // best-effort
  } catch { /* ignore */ }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const _t0 = Date.now();

  if (args.planJsonFlag) {
    const result = planJson(args.target, args.withReadme);
    console.log(JSON.stringify(result, null, 2));
    sendTelemetryIfEnabled(args, result, Date.now() - _t0);
    return;
  }

  // Parse agent list
  let agents = null;
  if (args.agent) {
    if (args.agent === "all") {
      agents = Object.keys(AGENT_CONVENTIONS);
    } else {
      agents = args.agent.split(",").map(a => a.trim());
      for (const a of agents) {
        if (!(a in AGENT_CONVENTIONS)) {
          console.error(`Unknown agent: ${a}. Valid: ${Object.keys(AGENT_CONVENTIONS).join(", ")}, all`);
          process.exit(2);
        }
      }
    }
  }

  // Watch mode
  if (args.watch) {
    await runWatch(args.target, args.watchInterval, args.watchAuto, {
      dryRun: args.dryRun,
      force: true,
      noGitCheck: true,
      withReadme: args.withReadme,
      withRalph: args.withRalph,
      gitMode: "skip",
      interactive: false,
      forceAll: args.forceAll,
      cleanRoot: args.cleanRoot,
      templateDir: args.templateDir,
      agents,
      outputFormat: args.format,
      pluginDir: args.pluginDir,
    });
    return;
  }

  const interactive = !args.yes;
  let gitMode = args.gitMode;
  if (args.noGitCheck) {
    gitMode = "skip";
  } else if (args.yes && gitMode === "ask") {
    gitMode = "stash";
  }

  const force = args.force || args.forceAll;

  await run(args.target, {
    dryRun: args.dryRun,
    force,
    noGitCheck: args.noGitCheck,
    withReadme: args.withReadme,
    withRalph: args.withRalph,
    gitMode,
    interactive,
    reconfigure: args.reconfigure,
    forceAll: args.forceAll,
    fromDoc: args.fromDoc,
    cleanRoot: args.cleanRoot,
    templateDir: args.templateDir,
    agents,
    outputFormat: args.format,
    pluginDir: args.pluginDir,
  });

  const _telemetryInfo = fs.existsSync(path.resolve(args.target)) ? scanDirectory(path.resolve(args.target)) : {};
  sendTelemetryIfEnabled(args, _telemetryInfo, Date.now() - _t0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
