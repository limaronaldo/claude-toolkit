#!/usr/bin/env python3
"""
claude-primer — Claude Code Knowledge Architecture Bootstrap (v4)

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

Git safety modes (--git-mode):
    ask          prompt before acting (default in interactive)
    stash        auto-stash dirty changes, no prompt
    skip         do nothing with git
"""

import os
import re
import sys
import json
import argparse
import datetime
import subprocess
import configparser
from pathlib import Path
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Optional

__version__ = "1.5.0"

# ─────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────

IGNORE_DIRS = {
    ".git", ".claude", "node_modules", "__pycache__", ".venv", "venv",
    "env", ".env", "dist", "build", "out", ".next", ".nuxt", "target",
    ".idea", ".vscode", ".mypy_cache", ".pytest_cache", "coverage",
    ".tox", "egg-info", ".eggs", "htmlcov",
}

STACK_SIGNALS = {
    "python": {
        "files": ["requirements.txt", "pyproject.toml", "setup.py", "setup.cfg", "Pipfile", "poetry.lock"],
        "extensions": [".py"],
    },
    "node": {
        "files": ["package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb"],
        "extensions": [".js", ".ts", ".jsx", ".tsx", ".mjs"],
    },
    "rust": {
        "files": ["Cargo.toml", "Cargo.lock"],
        "extensions": [".rs"],
    },
    "go": {
        "files": ["go.mod", "go.sum"],
        "extensions": [".go"],
    },
    "ruby": {
        "files": ["Gemfile", "Gemfile.lock", "Rakefile"],
        "extensions": [".rb"],
    },
    "java": {
        "files": ["pom.xml", "build.gradle", "build.gradle.kts"],
        "extensions": [".java", ".kt"],
    },
    "php": {
        "files": ["composer.json", "composer.lock"],
        "extensions": [".php"],
    },
    "dotnet": {
        "files": [],
        "extensions": [".cs", ".csproj", ".sln", ".fsproj"],
    },
    "elixir": {
        "files": ["mix.exs", "mix.lock"],
        "extensions": [".ex", ".exs"],
    },
    "swift": {
        "files": ["Package.swift", "Package.resolved"],
        "extensions": [".swift"],
    },
    "dart": {
        "files": ["pubspec.yaml", "pubspec.lock"],
        "extensions": [".dart"],
    },
    "zig": {
        "files": ["build.zig", "build.zig.zon"],
        "extensions": [".zig"],
    },
    "scala": {
        "files": ["build.sbt"],
        "extensions": [".scala", ".sc"],
    },
}

FRAMEWORK_SIGNALS = {
    # Python
    "django": ["manage.py", "django"],
    "flask": ["flask"],
    "fastapi": ["fastapi"],
    "streamlit": ["streamlit"],
    # Node/JS
    "nextjs": ["next.config.js", "next.config.mjs", "next.config.ts"],
    "react": ["react"],
    "vue": ["vue", "nuxt.config"],
    "svelte": ["svelte", "@sveltejs"],
    "sveltekit": ["@sveltejs/kit"],
    "solidjs": ["solid-js", "vite-plugin-solid"],
    "remix": ["@remix-run"],
    "astro": ["astro"],
    "express": ["express"],
    "nestjs": ["@nestjs"],
    "hono": ["hono"],
    # Rust
    "axum": ["axum"],
    "actix": ["actix-web"],
    "rocket": ["rocket"],
    # Go
    "gin": ["github.com/gin-gonic/gin"],
    "fiber": ["github.com/gofiber/fiber"],
    "echo": ["github.com/labstack/echo"],
    # Elixir
    "phoenix": ["phoenix", "phoenix_html"],
    # Java/Kotlin
    "spring": ["org.springframework", "spring-boot"],
    # PHP
    "laravel": ["laravel/framework"],
    # Dart
    "flutter": ["flutter"],
}

DEPLOY_SIGNALS = {
    "docker": ["Dockerfile", "docker-compose.yml", "docker-compose.yaml", ".dockerignore"],
    "vercel": ["vercel.json", ".vercel"],
    "render": ["render.yaml"],
    "fly.io": ["fly.toml"],
    "github_actions": [".github/workflows"],
    "gitlab_ci": [".gitlab-ci.yml"],
}

# Ralph tool permissions by stack (used for .ralphrc ALLOWED_TOOLS)
RALPH_TOOLS_BY_STACK = {
    "python": "Bash(pip *),Bash(python *),Bash(pytest)",
    "node": "Bash(npm *),Bash(npx *),Bash(node *)",
    "rust": "Bash(cargo *)",
    "go": "Bash(go *)",
    "elixir": "Bash(mix *),Bash(iex *)",
    "java": "Bash(mvn *),Bash(gradle *),Bash(java *)",
    "php": "Bash(php *),Bash(composer *)",
    "dart": "Bash(dart *),Bash(flutter *)",
    "ruby": "Bash(bundle *),Bash(ruby *),Bash(rails *)",
    "dotnet": "Bash(dotnet *)",
    "swift": "Bash(swift *),Bash(xcodebuild *)",
    "zig": "Bash(zig *)",
    "scala": "Bash(sbt *),Bash(scala *)",
}

# Monorepo workspace markers
MONOREPO_SIGNALS = {
    "pnpm": ["pnpm-workspace.yaml"],
    "turborepo": ["turbo.json"],
    "nx": ["nx.json"],
    "lerna": ["lerna.json"],
    "yarn_workspaces": [],  # detected via package.json "workspaces" field
}

# Conventional monorepo directory names (scanned up to 2 levels)
MONOREPO_DIRS = {"apps", "packages", "services", "libs", "modules", "plugins", "tools"}

CMD_PREFIXES = (
    "pip", "npm", "npx", "node", "python", "python3", "pytest", "cargo",
    "cd ", "git ", "docker", "make", "go ", "ruby", "bundle", "rails",
    "brew", "apt", "yum", "curl", "wget", "ssh", "scp", "rsync",
    "mkdir", "cp ", "mv ", "rm ", "ls ", "cat ", "echo ", "grep",
    "playwright", "flask", "django", "uvicorn", "gunicorn", "next",
    "tsc", "eslint", "prettier", "vitest", "jest", "mocha", "pnpm",
    "turbo", "nx ", "lerna",
    # Elixir
    "mix ", "iex", "elixir",
    # Swift
    "swift ", "swiftc", "xcodebuild",
    # Dart/Flutter
    "dart ", "flutter ", "pub ",
    # Zig
    "zig ",
    # Scala
    "sbt ", "scala ",
    # Go extras
    "go build", "go test", "go run", "go mod",
    # Java
    "mvn ", "gradle", "java ", "javac",
    # PHP
    "php ", "composer ", "artisan",
    # dotnet
    "dotnet ",
)

TREE_CHARS = {"├", "│", "└", "─"}


# ─────────────────────────────────────────────
# Result tracking (replaces string-based counters)
# ─────────────────────────────────────────────

# ─────────────────────────────────────────────
# Confidence scoring
# ─────────────────────────────────────────────

CONFIDENCE_HIGH = "high"
CONFIDENCE_MEDIUM = "medium"
CONFIDENCE_LOW = "low"


@dataclass
class ScoredValue:
    """A value tagged with its source and confidence level."""
    value: str
    source: str       # e.g. "package.json", "README.md", "stack-inference", "placeholder"
    confidence: str   # "high", "medium", "low"

    def __str__(self):
        return self.value

    def as_dict(self) -> dict:
        return {"value": self.value, "source": self.source, "confidence": self.confidence}


@dataclass
class PlannedWrite:
    """Pre-computed write decision for a single file."""
    filename: str
    exists: bool
    mode: str  # "create", "overwrite", "skip"
    reason: str = ""
    actual_path: Optional[Path] = None


@dataclass
class FileAction:
    filename: str
    action: str  # "create", "overwrite", "skip"
    lines: int = 0
    reason: str = ""
    actual_path: Optional[Path] = None


@dataclass
class RunResult:
    actions: list = field(default_factory=list)
    git_action: str = ""  # "stash", "committed", "skipped", "no-git", "aborted"

    @property
    def created_count(self) -> int:
        return sum(1 for a in self.actions if a.action in ("create", "overwrite"))

    @property
    def skipped_count(self) -> int:
        return sum(1 for a in self.actions if a.action == "skip")


# ─────────────────────────────────────────────
# Git safety
# ─────────────────────────────────────────────

def _git(target: Path, *args, timeout: int = 10) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git"] + list(args),
        capture_output=True, text=True, cwd=target, timeout=timeout,
    )


def git_check(target: Path) -> dict:
    result = {
        "is_git": False, "has_remote": False, "branch": "",
        "dirty": False, "status_summary": "",
        "modified_files": [], "untracked_files": [],
    }

    try:
        inside = _git(target, "rev-parse", "--is-inside-work-tree")
        if inside.returncode != 0 or inside.stdout.strip() != "true":
            return result

        result["is_git"] = True

        branch = _git(target, "rev-parse", "--abbrev-ref", "HEAD").stdout.strip()
        if branch == "HEAD":  # detached HEAD
            branch = _git(target, "rev-parse", "--short", "HEAD").stdout.strip()
        result["branch"] = branch

        result["has_remote"] = bool(_git(target, "remote").stdout.strip())

        status = _git(target, "status", "--porcelain")
        lines = [l for l in status.stdout.splitlines() if l.strip()]

        for line in lines:
            if line.startswith("??"):
                result["untracked_files"].append(line[3:].strip())
            else:
                result["modified_files"].append(line[3:].strip())

        result["dirty"] = bool(lines)

        parts = []
        if result["modified_files"]:
            parts.append(f"{len(result['modified_files'])} modified/staged")
        if result["untracked_files"]:
            parts.append(f"{len(result['untracked_files'])} untracked")
        result["status_summary"] = ", ".join(parts) if parts else "clean"

    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass

    return result


def _safe_input(prompt: str, default: str = "") -> str:
    """input() wrapper that handles EOFError in non-TTY environments."""
    try:
        return input(prompt)
    except (EOFError, KeyboardInterrupt):
        if default:
            print(f" (using default: {default})")
        return default


def git_stash(target: Path) -> Optional[str]:
    """Stash dirty changes. Returns stash ref or None on failure."""
    try:
        ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
        msg = f"claude-primer safety stash ({ts})"

        # Include untracked files in stash
        r = _git(target, "stash", "push", "-u", "-m", msg, timeout=15)
        if r.returncode == 0 and "No local changes" not in r.stdout:
            # Get the stash ref
            ref = _git(target, "stash", "list", "--max-count=1").stdout.strip()
            return ref or "stash@{0}"
        return None
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return None


def git_selective_commit(target: Path, files: list[str]) -> bool:
    """Commit only specific files, without pulling in unrelated staged changes.

    Uses `git add` to ensure files are tracked, then `git commit --only`
    to create a commit containing exclusively these files. The --only flag
    makes git ignore the current index state, so the user's staged work
    is not captured in this backup commit.
    """
    try:
        ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
        msg = f"chore: backup before claude-primer ({ts})"

        existing = [f for f in files if (target / f).exists()]
        if not existing:
            return True  # nothing to back up

        add = _git(target, "add", "--", *existing, timeout=10)
        if add.returncode != 0:
            return False

        r = _git(target, "commit", "-m", msg, "--only", "--", *existing, timeout=15)
        return r.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False


def run_git_safety(target: Path, git_mode: str, files_to_write: list[str], interactive: bool) -> str:
    """
    Handle git safety before writing files.
    Returns: "stash", "committed", "skipped", "no-git", "aborted"
    """
    git = git_check(target)

    if not git["is_git"]:
        return "no-git"

    if not git["dirty"]:
        print(f"  Git: {git['branch']} — clean")
        return "skipped"

    print(f"  Git: {git['branch']} — {git['status_summary']}")

    if git_mode == "skip":
        print("  Git safety: skipped (--git-mode skip)")
        return "skipped"

    if git_mode == "stash":
        ref = git_stash(target)
        if ref:
            print(f"  Git safety: stashed → {ref}")
            print(f"  To restore: git stash pop")
            return "stash"
        else:
            print("  Git safety: stash failed, continuing anyway")
            return "skipped"

    # git_mode == "ask" — interactive
    if not interactive:
        # Non-interactive with --yes: default to stash
        ref = git_stash(target)
        if ref:
            print(f"  Git safety: auto-stashed → {ref}")
            return "stash"
        return "skipped"

    # Interactive prompt
    print()
    print("  Options:")
    print("    [s] Stash changes (recommended — easy to restore with git stash pop)")
    print("    [c] Commit only files that will be overwritten")
    print("    [n] Skip — continue without safety net")
    print("    [a] Abort — stop, change nothing")
    print()

    answer = _safe_input("  Choice [S/c/n/a]: ", default="s").strip().lower()

    if answer in ("a", "abort"):
        print("\n  Aborted. No files modified.")
        return "aborted"

    if answer in ("c", "commit"):
        ok = git_selective_commit(target, files_to_write)
        if ok:
            print("  Committed backup of files that will be overwritten.")
            return "committed"
        else:
            print("  Commit failed.")
            retry = _safe_input("  Continue anyway? [y/N]: ", default="n").strip().lower()
            return "skipped" if retry in ("y", "yes", "s", "sim") else "aborted"

    if answer in ("n", "skip"):
        print("  Skipping git safety.")
        return "skipped"

    # Default: stash
    ref = git_stash(target)
    if ref:
        print(f"  Stashed → {ref}")
        print(f"  To restore: git stash pop")
        return "stash"
    else:
        print("  Stash failed, continuing anyway.")
        return "skipped"


# ─────────────────────────────────────────────
# Deep content reader
# ─────────────────────────────────────────────

def safe_read(filepath: Path, max_chars: int = 50000) -> str:
    """Read file safely with size limit. Tries to cut at last heading boundary."""
    try:
        if not filepath.exists() or not filepath.is_file():
            return ""
        content = filepath.read_text(encoding="utf-8", errors="ignore")
        if len(content) <= max_chars:
            return content
        # Cut at last ## heading before limit to avoid mid-section truncation
        truncated = content[:max_chars]
        last_heading = truncated.rfind("\n## ")
        if last_heading > max_chars * 0.6:  # only if we keep >60%
            return truncated[:last_heading]
        return truncated
    except (PermissionError, OSError):
        return ""


def extract_md_sections(content: str) -> dict:
    """
    Extract markdown sections as {heading: body} ordered dict.
    Uses hierarchical keys to prevent duplicate headings from clobbering each other.

    Heading hierarchy is tracked via a stack. A `### Features` under `## Module A`
    produces the key "Module A > Features", while `### Features` under `## Module B`
    produces "Module B > Features".

    For top-level consumers that search by substring (like read_existing_content),
    this means they'll still match on the leaf heading name.

    Limitations (documented):
    - Content before first heading: stored under key ""
    - # inside code blocks may be misread as headings
    - Heading text is not deduplicated if identical at same level under same parent
    """
    sections = {}
    # Stack: list of (level, heading_text) tuples
    heading_stack = []
    current_key = ""
    current_lines = []
    in_code_block = False

    def _save():
        body = "\n".join(current_lines).strip()
        if body or current_key:
            sections[current_key] = body

    for line in content.split("\n"):
        # Track code blocks to avoid treating # inside them as headings
        stripped = line.strip()
        if stripped.startswith("```"):
            in_code_block = not in_code_block
            current_lines.append(line)
            continue

        if in_code_block:
            current_lines.append(line)
            continue

        match = re.match(r"^(#{1,4})\s+(.+)", line)
        if match:
            # Save previous section
            _save()

            level = len(match.group(1))
            heading = match.group(2).strip()

            # Pop stack to find parent: remove headings at same or deeper level
            while heading_stack and heading_stack[-1][0] >= level:
                heading_stack.pop()

            heading_stack.append((level, heading))

            # Build hierarchical key
            if len(heading_stack) == 1:
                current_key = heading
            else:
                current_key = " > ".join(h[1] for h in heading_stack)

            current_lines = []
        else:
            current_lines.append(line)

    _save()

    # Remove empty preamble
    if "" in sections and not sections[""]:
        del sections[""]

    return sections


def dedup_and_rank_commands(commands: list[str]) -> list[str]:
    """Remove duplicates, path-specific commands, and rank by category priority.

    Pure function that:
    - Removes exact duplicates (preserving first occurrence)
    - Removes commands containing absolute paths (/Users/, /home/, C:\\, /var/, /opt/, /tmp/)
    - Removes bare `cd` commands to specific directories
    - Removes commands with git commit hashes (40-char hex strings)
    - Ranks remaining commands by category priority (install=0 ... deploy=6, other=99)
    """
    if not commands:
        return []

    # Absolute path prefixes to filter out
    _ABS_PATH_MARKERS = ("/Users/", "/home/", "C:\\", "/var/", "/opt/", "/tmp/")

    # 40-char hex pattern for git commit hashes
    _COMMIT_HASH_RE = re.compile(r'\b[0-9a-f]{40}\b')

    # Bare cd to a specific directory (cd /some/path or cd some/path, but not just "cd")
    _BARE_CD_RE = re.compile(r'^cd\s+\S')

    # Category patterns: (priority, list of substrings to match)
    _CATEGORIES = [
        (0, ["pip install", "npm install", "cargo build", "go mod", "mix deps",
             "bundle install", "composer install", "dotnet restore",
             "flutter pub", "dart pub"]),
        (1, ["npm run dev", "python manage.py runserver", "flask run",
             "cargo run", "go run", "mix phx.server", "uvicorn"]),
        (2, ["pytest", "npm test", "cargo test", "go test", "mix test",
             "flutter test", "dotnet test"]),
        (3, ["eslint", "prettier", "black", "ruff", "cargo fmt", "cargo clippy"]),
        (4, ["npm run build", "cargo build --release", "go build", "dotnet build"]),
        (5, ["migrate", "ecto"]),
        (6, ["deploy", "docker"]),
    ]

    # Step 1: deduplicate preserving order
    seen = set()
    unique = []
    for cmd in commands:
        if cmd not in seen:
            seen.add(cmd)
            unique.append(cmd)

    # Step 2: filter out path-specific, bare cd, and commit-hash commands
    filtered = []
    for cmd in unique:
        if any(marker in cmd for marker in _ABS_PATH_MARKERS):
            continue
        if _BARE_CD_RE.match(cmd):
            continue
        if _COMMIT_HASH_RE.search(cmd):
            continue
        filtered.append(cmd)

    # Step 3: rank by category
    def _priority(cmd: str) -> int:
        cmd_lower = cmd.lower()
        for prio, patterns in _CATEGORIES:
            if any(p in cmd_lower for p in patterns):
                return prio
        return 99

    filtered.sort(key=_priority)

    return filtered


def read_existing_content(root: Path) -> dict:
    """
    Mine existing project files for reusable content.
    Each extracted field is tagged with its source for provenance tracking.
    """
    ec = {
        "readme_sections": {},
        "claude_sections": {},
        "standards_sections": {},
        "errors_entries": [],
        "description": "",
        "architecture_notes": "",
        "commands": [],
        "env_notes": "",
        "formatting_rules": [],
        "deploy_notes": "",
        "checklist_items": [],
        "stakeholder_notes": "",
        "data_sources": "",
        "sub_project_table": "",
        # Provenance: which sources contributed
        "sources": set(),
    }

    # ── README.md ──
    readme = safe_read(root / "README.md")
    if readme:
        ec["readme_sections"] = extract_md_sections(readme)
        for line in readme.split("\n"):
            line = line.strip()
            if line and not line.startswith(("#", "[", "!", ">", "|", "```", "---", "*")):
                ec["description"] = line[:300]
                ec["sources"].add("README.md")
                break

    # ── CLAUDE.md ──
    claude = safe_read(root / "CLAUDE.md")
    if claude:
        sections = extract_md_sections(claude)
        ec["claude_sections"] = sections

        # Detect if this file was generated by us — skip re-extracting our own boilerplate
        is_self_generated = "generated_by:" in claude[:500] and any(
            marker in claude[:500] for marker in ("claude-primer", "super-claude")
        )

        # Sections we generate ourselves — skip these to prevent accumulation on --force
        _SELF_SECTIONS = {
            "routing rules", "invariants", "decision heuristics",
            "verification standard", "red flags", "stuck protocol",
            "pre-task protocol", "post-task", "key decisions",
            "active risks", "parallel development", "provenance",
            "repository overview", "document information",
            "environment", "common commands", "code architecture",
            "formatting standards",
        }

        # Global command extraction from all bash blocks
        all_bash = re.findall(r"```(?:bash|sh|cmd)?\n(.*?)```", claude, re.DOTALL)
        for block in all_bash:
            for line in block.strip().split("\n"):
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if any(c in line for c in TREE_CHARS):
                    continue
                if any(line.lower().startswith(p) for p in CMD_PREFIXES):
                    ec["commands"].append(line)
        ec["commands"] = dedup_and_rank_commands(ec["commands"])
        if ec["commands"]:
            ec["sources"].add("CLAUDE.md:commands")

        for key, body in sections.items():
            kl = key.lower()

            # Skip sections we generated ourselves to prevent re-extraction accumulation
            if is_self_generated and any(s in kl for s in _SELF_SECTIONS):
                continue
            # Skip sections that contain only our provenance markers and no user content
            if "<!-- [placeholder] -->" in body and body.strip().startswith("<!-- ["):
                continue

            if any(w in kl for w in ["architect", "code architect", "data flow", "pattern"]):
                # Accumulate: multiple architecture sections get joined
                if ec["architecture_notes"]:
                    ec["architecture_notes"] += f"\n\n**{key}:**\n{body[:2000]}"
                else:
                    ec["architecture_notes"] = body[:3000]
                ec["sources"].add("CLAUDE.md:architecture")

            if any(w in kl for w in ["environment", "env"]) and not any(w in kl for w in ["virtual", "venv"]):
                if not ec["env_notes"]:  # take first match (usually the main one)
                    ec["env_notes"] = body[:1000]
                    ec["sources"].add("CLAUDE.md:environment")

            if "format" in kl:
                for line in body.split("\n"):
                    line = line.strip()
                    if line.startswith(("- ", "* ")):
                        ec["formatting_rules"].append(line[2:].strip())
                if ec["formatting_rules"]:
                    ec["sources"].add("CLAUDE.md:formatting")

            if any(w in kl for w in ["deploy", "application"]):
                ec["deploy_notes"] = body[:1500]
                ec["sources"].add("CLAUDE.md:deploy")

            if any(w in kl for w in ["checklist", "pre-"]):
                for line in body.split("\n"):
                    line = line.strip()
                    if line.startswith("- ["):
                        ec["checklist_items"].append(line)
                if ec["checklist_items"]:
                    ec["sources"].add("CLAUDE.md:checklist")

            if any(w in kl for w in ["stakeholder", "working with"]):
                ec["stakeholder_notes"] = body[:1000]
                ec["sources"].add("CLAUDE.md:stakeholders")

            if "data source" in kl or ("data" in kl and "column" in body.lower()):
                ec["data_sources"] = body[:2000]
                ec["sources"].add("CLAUDE.md:data-sources")

            if any(w in kl for w in ["subdirectory", "sub-project", "routing"]):
                ec["sub_project_table"] = body[:2000]
                ec["sources"].add("CLAUDE.md:routing")

    # ── STANDARDS.md ──
    standards = safe_read(root / "STANDARDS.md")
    if standards:
        is_self_standards = any(marker in standards[:300] for marker in ("claude-primer", "super-claude"))
        if not is_self_standards:
            ec["standards_sections"] = extract_md_sections(standards)
            if len(ec["standards_sections"]) >= 4:
                ec["sources"].add("STANDARDS.md")

    # ── Error catalog ──
    for err_file in ["ERRORS_AND_LESSONS.md", "ERROS_E_ACERTOS.md", "analysis/ERROS_E_ACERTOS.md"]:
        err = safe_read(root / err_file)
        if err:
            # Skip self-generated error catalogs (contain our template marker)
            if "replace with real entries" in err.lower() or "(template)" in err:
                break
            err_clean = re.sub(r"```.*?```", "", err, flags=re.DOTALL)
            entries = re.findall(r"###\s+(.+?)(?=\n###|\Z)", err_clean, re.DOTALL)
            for e in entries:
                e = e.strip()
                if not e or len(e) < 20:
                    continue
                if "short description" in e.split("\n")[0].lower():
                    continue
                ec["errors_entries"].append(e[:500])
            if ec["errors_entries"]:
                ec["sources"].add(err_file)
            break

    return ec


def extract_from_document(filepath: Path) -> dict:
    """
    Extract project knowledge from an external document (PRD, spec, RFC, etc.).

    Reads a markdown/text file and extracts:
    - description: first non-heading paragraph
    - architecture_notes: from sections with architecture/design/system in heading
    - commands: from bash/sh code blocks
    - sources: provenance tracking set

    Returns a dict with keys matching existing_content format.
    """
    result = {
        "description": "",
        "architecture_notes": "",
        "commands": [],
        "sources": set(),
    }

    content = safe_read(filepath)
    if not content:
        return result

    result["sources"].add("from-doc")

    # Extract description: first non-heading, non-empty paragraph
    for line in content.split("\n"):
        line = line.strip()
        if not line:
            continue
        if line.startswith(("#", "[", "!", ">", "|", "```", "---", "*")):
            continue
        result["description"] = line[:300]
        break

    # Extract sections and look for architecture/design/system notes
    sections = extract_md_sections(content)
    arch_parts = []
    for key, body in sections.items():
        kl = key.lower()
        if any(w in kl for w in ["architect", "design", "system"]):
            if arch_parts:
                arch_parts.append(f"\n\n**{key}:**\n{body[:2000]}")
            else:
                arch_parts.append(body[:3000])
    if arch_parts:
        result["architecture_notes"] = "".join(arch_parts)

    # Extract commands from bash/sh code blocks
    all_bash = re.findall(r"```(?:bash|sh|cmd)?\n(.*?)```", content, re.DOTALL)
    for block in all_bash:
        for line in block.strip().split("\n"):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if any(c in line for c in TREE_CHARS):
                continue
            if any(line.lower().startswith(p) for p in CMD_PREFIXES):
                result["commands"].append(line)

    return result


# ─────────────────────────────────────────────
# Directory scanner
# ─────────────────────────────────────────────

def scan_directory(root: Path) -> dict:
    result = {
        "root": str(root.resolve()),
        "name": root.resolve().name,
        "is_empty": True,
        "stacks": [],
        "frameworks": [],
        "deploy": [],
        "has_git": False,
        "existing_docs": [],
        "sub_projects": [],
        "directories": [],
        "file_count": 0,
        "extension_counts": defaultdict(int),
        "config_files": [],
        "test_dirs": [],
        "env_files": [],
        "scripts": {},
        "description": "",
        "existing_content": {},
        "is_monorepo": False,
        "monorepo_tool": "",
        "workspace_dirs": [],
        "confidence_scores": {},  # field -> ScoredValue
    }

    all_files = []
    all_dirs = []
    root_files = set()

    try:
        for item in root.iterdir():
            try:
                if item.name == ".git":
                    result["has_git"] = True
                    continue
                if item.is_symlink() and not item.resolve().exists():
                    continue  # skip broken symlinks
                if item.name.startswith(".") and item.name not in (".env", ".env.example", ".github", ".gitlab-ci.yml"):
                    continue
                if item.is_file():
                    root_files.add(item.name)
                elif item.is_dir() and item.name in (".github",):
                    root_files.add(item.name)
            except (PermissionError, OSError):
                continue
    except (PermissionError, OSError) as e:
        print(f"  Warning: cannot read directory {root}: {e}")
        return result

    # Also detect git via rev-parse (works from subdirectories inside a repo)
    if not result["has_git"]:
        try:
            r = _git(root, "rev-parse", "--is-inside-work-tree")
            if r.returncode == 0 and r.stdout.strip() == "true":
                result["has_git"] = True
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass

    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS and not d.startswith(".")]
        rel = Path(dirpath).relative_to(root)
        if rel != Path("."):
            all_dirs.append(str(rel))
        for f in filenames:
            fp = Path(dirpath) / f
            all_files.append(str(fp.relative_to(root)))
            ext = fp.suffix.lower()
            if ext:
                result["extension_counts"][ext] += 1
            result["file_count"] += 1

    result["is_empty"] = result["file_count"] == 0
    result["directories"] = sorted(all_dirs)[:100]

    # ── Stacks ──
    for stack, signals in STACK_SIGNALS.items():
        found_file = any(f in root_files for f in signals["files"])
        found_ext = any(result["extension_counts"].get(ext, 0) > 0 for ext in signals["extensions"])
        if not found_file:
            found_file = any(
                f in all_files or any(af.endswith("/" + f) for af in all_files)
                for f in signals["files"]
            )
        if found_file or found_ext:
            result["stacks"].append(stack)

    # ── Frameworks (order-preserving dedup) ──
    frameworks_seen = []
    for framework, keywords in FRAMEWORK_SIGNALS.items():
        for kw in keywords:
            if kw in root_files:
                frameworks_seen.append(framework)
                break
            for dep_file in ["package.json", "requirements.txt", "Pipfile", "Cargo.toml",
                             "pyproject.toml", "go.mod", "mix.exs", "build.sbt",
                             "pubspec.yaml", "composer.json"]:
                dep_path = root / dep_file
                if dep_path.exists():
                    try:
                        content = dep_path.read_text(encoding="utf-8", errors="ignore")[:10000]
                        if kw.lower() in content.lower():
                            frameworks_seen.append(framework)
                            break
                    except (PermissionError, OSError):
                        pass
            else:
                continue
            break
    result["frameworks"] = list(dict.fromkeys(frameworks_seen))  # order-preserving dedup

    # ── Deploy ──
    for platform, signals in DEPLOY_SIGNALS.items():
        for s in signals:
            if (root / s).exists() or s in root_files or s in all_files:
                result["deploy"].append(platform)
                break

    # ── Existing docs ──
    for df in ["CLAUDE.md", "README.md", "STANDARDS.md", "QUICKSTART.md",
               "ERRORS_AND_LESSONS.md", "ERROS_E_ACERTOS.md", "CONTRIBUTING.md",
               "PLAN.md", "CHANGELOG.md"]:
        if (root / df).exists():
            result["existing_docs"].append(df)

    # ── Monorepo detection ──
    for tool, markers in MONOREPO_SIGNALS.items():
        for m in markers:
            if (root / m).exists():
                result["is_monorepo"] = True
                result["monorepo_tool"] = tool
                break

    # Check package.json for workspaces field
    pkg_json = root / "package.json"
    if pkg_json.exists():
        try:
            pkg = json.loads(pkg_json.read_text(encoding="utf-8", errors="ignore"))
            result["scripts"] = pkg.get("scripts", {})
            result["description"] = pkg.get("description", "")
            if "workspaces" in pkg:
                result["is_monorepo"] = True
                result["monorepo_tool"] = result["monorepo_tool"] or "yarn_workspaces"
        except (json.JSONDecodeError, PermissionError, OSError):
            pass

    # ── Sub-projects (deep: conventional monorepo dirs + first-level) ──
    sub_projects_seen = set()

    for d in all_dirs:
        dp = root / d
        parts = Path(d).parts
        depth = len(parts)

        # Monorepo conventional: apps/X, packages/X, services/X, libs/X (depth 2)
        # Check this FIRST so we can skip their parents below
        if depth == 2 and parts[0] in MONOREPO_DIRS:
            if any((dp / f).exists() for f in ["package.json", "requirements.txt", "Cargo.toml", "pyproject.toml", "CLAUDE.md"]):
                sub_projects_seen.add(d)
                result["is_monorepo"] = True

        # First level: any dir with own CLAUDE.md or deps
        # SKIP workspace container dirs (apps/, packages/, etc.) — their children are the real projects
        if depth == 1 and d not in MONOREPO_DIRS:
            if any((dp / f).exists() for f in ["CLAUDE.md", "package.json", "requirements.txt", "Cargo.toml"]):
                sub_projects_seen.add(d)

    result["sub_projects"] = sorted(sub_projects_seen)

    # ── Sub-project details (enhanced monorepo intelligence) ──
    result["sub_project_details"] = []

    for sp in result["sub_projects"]:
        sp_path = root / sp
        detail = {"path": sp, "stacks": [], "frameworks": [], "has_claude_md": False}
        detail["has_claude_md"] = (sp_path / "CLAUDE.md").exists()

        # Detect stack from files in sub-project root
        sp_files = set()
        try:
            for item in sp_path.iterdir():
                if item.is_file():
                    sp_files.add(item.name)
        except (PermissionError, OSError):
            pass

        for stack, signals in STACK_SIGNALS.items():
            if any(f in sp_files for f in signals["files"]):
                detail["stacks"].append(stack)

        # Detect framework from dependency files
        for framework, keywords in FRAMEWORK_SIGNALS.items():
            for kw in keywords:
                if kw in sp_files:
                    detail["frameworks"].append(framework)
                    break
                for dep_file in ["package.json", "requirements.txt", "Cargo.toml", "pyproject.toml"]:
                    dep = sp_path / dep_file
                    if dep.exists():
                        try:
                            content_txt = dep.read_text(encoding="utf-8", errors="ignore")[:5000]
                            if kw.lower() in content_txt.lower():
                                detail["frameworks"].append(framework)
                                break
                        except (PermissionError, OSError):
                            pass
                else:
                    continue
                break

        result["sub_project_details"].append(detail)

    # ── Workspace dirs (monorepo top-level) ──
    for d in MONOREPO_DIRS:
        if (root / d).is_dir():
            result["workspace_dirs"].append(d)

    # ── Test dirs ──
    for d in all_dirs:
        if Path(d).name.lower() in ("test", "tests", "__tests__", "spec", "specs", "e2e", "integration"):
            result["test_dirs"].append(d)

    # ── Config/env ──
    for f in root_files:
        if f.startswith(".env"):
            result["env_files"].append(f)
        if f.endswith((".yaml", ".yml", ".toml", ".ini", ".cfg")) and not f.startswith("."):
            result["config_files"].append(f)

    # ── Deep read ──
    if not result["is_empty"]:
        result["existing_content"] = read_existing_content(Path(result["root"]))
        if not result["description"] and result["existing_content"].get("description"):
            result["description"] = result["existing_content"]["description"]

    # ── Confidence scoring ──
    scores = {}

    # Stack confidence
    stack_scores = []
    for stack in result["stacks"]:
        signals = STACK_SIGNALS.get(stack, {})
        found_file = any(f in root_files for f in signals.get("files", []))
        if found_file:
            stack_scores.append(ScoredValue(stack, "root config file", CONFIDENCE_HIGH))
        else:
            stack_scores.append(ScoredValue(stack, "file extensions", CONFIDENCE_MEDIUM))
    scores["stacks"] = stack_scores

    # Framework confidence
    fw_scores = []
    for fw in result["frameworks"]:
        keywords = FRAMEWORK_SIGNALS.get(fw, [])
        if any(kw in root_files for kw in keywords):
            fw_scores.append(ScoredValue(fw, "root file", CONFIDENCE_HIGH))
        else:
            fw_scores.append(ScoredValue(fw, "dependency file keyword", CONFIDENCE_MEDIUM))
    scores["frameworks"] = fw_scores

    # Description confidence
    if result["description"]:
        ec = result.get("existing_content", {})
        ec_sources = ec.get("sources", set())
        if "README.md" in ec_sources:
            scores["description"] = ScoredValue(result["description"], "README.md", CONFIDENCE_MEDIUM)
        elif result.get("scripts"):  # came from package.json
            scores["description"] = ScoredValue(result["description"], "package.json", CONFIDENCE_HIGH)
        else:
            scores["description"] = ScoredValue(result["description"], "inferred", CONFIDENCE_LOW)

    # Command confidence
    ec = result.get("existing_content", {})
    cmd_scores = []
    for cmd in ec.get("commands", []):
        cmd_scores.append(ScoredValue(cmd, "extracted from docs", CONFIDENCE_MEDIUM))
    scores["commands"] = cmd_scores

    result["confidence_scores"] = scores

    return result


# ─────────────────────────────────────────────
# Project tier detection
# ─────────────────────────────────────────────

EXTERNAL_FRAMEWORKS = {
    "django", "flask", "fastapi", "nextjs", "nestjs", "hono", "express",
    "phoenix", "spring", "laravel", "gin", "fiber", "echo", "remix",
    "astro", "rocket", "axum", "actix", "sveltekit",
}


def detect_project_tier(info: dict) -> dict:
    """Suggest a project tier based on detected signals.

    Returns {"tier": int, "confidence": str, "reasons": list[str]}.
    Confidence: "high" (strong signals), "medium" (some signals), "low" (guessing).
    """
    reasons = []
    frameworks = set(info.get("frameworks", []))
    has_deploy = bool(info.get("deploy"))
    has_external = bool(frameworks & EXTERNAL_FRAMEWORKS)
    is_monorepo = info.get("is_monorepo", False)
    is_empty = info.get("is_empty", False)
    has_code = bool(info.get("stacks"))

    # T1: multi-phase, writes to external systems
    if has_deploy and has_external and is_monorepo:
        reasons.append("deploy platform detected")
        reasons.append("external-facing framework")
        reasons.append("monorepo structure")
        return {"tier": 1, "confidence": "high", "reasons": reasons}

    if has_deploy and has_external:
        reasons.append("deploy platform detected")
        reasons.append("external-facing framework")
        return {"tier": 1, "confidence": "medium", "reasons": reasons}

    # T2: single-phase, external reads/writes
    if has_external:
        reasons.append("external-facing framework detected")
        if has_deploy:
            reasons.append("deploy platform detected")
        return {"tier": 2, "confidence": "high" if has_deploy else "medium", "reasons": reasons}

    # T3: local only — scripts, data processing
    if has_code:
        reasons.append("code detected but no external-facing framework")
        return {"tier": 3, "confidence": "medium", "reasons": reasons}

    # T4: docs/reference only
    if is_empty or not has_code:
        reasons.append("no code detected")
        return {"tier": 4, "confidence": "low", "reasons": reasons}

    return {"tier": 3, "confidence": "low", "reasons": ["unable to determine"]}


# ─────────────────────────────────────────────
# Provenance markers
# ─────────────────────────────────────────────

def _mark(tag: str) -> str:
    """Inline HTML comment for provenance. Invisible in rendered markdown."""
    return f"<!-- [{tag}] -->"


def _confidence_comment(confidence: str) -> str:
    """Inline HTML comment for confidence level. Invisible in rendered markdown."""
    return f"<!-- confidence: {confidence} -->"


def _prov(tag: str) -> str:
    """Combined provenance + confidence marker. Maps provenance tags to confidence."""
    conf = {"migrated": "high", "inferred": "medium", "placeholder": "low"}.get(tag, "low")
    return f"<!-- [{tag}] confidence: {conf} -->"


# ─────────────────────────────────────────────
# Template system
# ─────────────────────────────────────────────

# Map template filenames to output filenames
_TEMPLATE_FILE_MAP = {
    "claude.md": "CLAUDE.md",
    "standards.md": "STANDARDS.md",
    "quickstart.md": "QUICKSTART.md",
    "errors.md": "ERRORS_AND_LESSONS.md",
}


def load_plugins(plugin_dir: Path) -> list:
    """Load plugin generators from a directory.

    Each .py file must define a generate(info) function returning
    {"filename": str, "content": str} or a list thereof.
    """
    plugins = []
    if not plugin_dir.is_dir():
        return plugins
    import importlib.util
    for f in sorted(plugin_dir.iterdir()):
        if f.suffix == ".py" and f.is_file():
            spec = importlib.util.spec_from_file_location(f.stem, str(f))
            mod = importlib.util.module_from_spec(spec)
            try:
                spec.loader.exec_module(mod)
                if hasattr(mod, "generate"):
                    plugins.append({"name": f.name, "generate": mod.generate})
            except Exception as e:
                print(f"  Warning: plugin {f.name} failed to load: {e}")
    return plugins


def run_plugins(target: Path, info: dict, plugins: list, dry_run: bool = False) -> list:
    """Execute plugins and write their output files."""
    actions = []
    for plugin in plugins:
        try:
            result = plugin["generate"](info)
            if isinstance(result, dict):
                result = [result]
            for item in result:
                fn = item.get("filename", "")
                content = item.get("content", "")
                if not fn or not content:
                    continue
                filepath = target / fn
                exists = filepath.exists()
                if not dry_run:
                    filepath.parent.mkdir(parents=True, exist_ok=True)
                    filepath.write_text(content, encoding="utf-8")
                actions.append(FileAction(fn, "overwrite" if exists else "create",
                                        lines=content.count("\n")))
        except Exception as e:
            print(f"  Warning: plugin {plugin['name']} failed: {e}")
    return actions


def load_templates(template_dir: Path) -> dict:
    """Load user template overrides from a directory.

    Returns {output_filename: {section_name_lower: section_body}} for section-level overrides.
    """
    templates = {}
    if not template_dir.is_dir():
        return templates

    for tf in template_dir.iterdir():
        if not tf.is_file() or not tf.name.endswith(".md"):
            continue
        output_file = _TEMPLATE_FILE_MAP.get(tf.name.lower(), tf.name.upper())
        content = tf.read_text(encoding="utf-8", errors="ignore")
        sections = extract_md_sections(content)
        if sections:
            templates[output_file] = {k.lower(): v for k, v in sections.items()}
        elif content.strip():
            # No headings — use entire content as a "full" override
            templates[output_file] = {"__full__": content}
    return templates


def _build_template_variables(info: dict) -> dict:
    """Build the variable substitution map for templates."""
    tier = info.get("tier", {})
    return {
        "project_name": info.get("name", ""),
        "tech_stack": ", ".join(info.get("stacks", [])),
        "frameworks": ", ".join(info.get("frameworks", [])),
        "tier": f"T{tier.get('tier', 3)}",
        "deploy": ", ".join(info.get("deploy", [])),
        "date": datetime.date.today().isoformat(),
        "description": info.get("description", ""),
    }


def apply_template_substitution(content: str, variables: dict) -> str:
    """Replace {{variable}} placeholders with values."""
    for key, val in variables.items():
        content = content.replace("{{" + key + "}}", val)
    return content


def merge_with_templates(generated: str, templates: dict, variables: dict, output_file: str) -> str:
    """Merge generated content with user template overrides.

    For each ## section in the template, replace the corresponding section in generated output.
    """
    file_templates = templates.get(output_file, {})
    if not file_templates:
        return generated

    # Full override
    if "__full__" in file_templates:
        return apply_template_substitution(file_templates["__full__"], variables)

    lines = generated.split("\n")
    result = []
    i = 0
    while i < len(lines):
        line = lines[i]
        # Check if this is a ## header that matches a template section
        if line.startswith("## "):
            header = line[3:].strip().lower()
            if header in file_templates:
                # Add the header line
                result.append(line)
                # Skip the original section body (until next ## or ---)
                i += 1
                while i < len(lines) and not lines[i].startswith("## ") and not (lines[i].strip() == "---" and i + 1 < len(lines) and lines[i + 1].startswith("## ")):
                    i += 1
                # Insert template content
                template_body = apply_template_substitution(file_templates[header], variables)
                result.append(template_body.rstrip())
                result.append("")
                continue
        result.append(line)
        i += 1

    return "\n".join(result)


def _root_doc_refs(clean_root: bool) -> dict[str, str]:
    """Return root-level markdown references for generated knowledge docs."""
    if clean_root:
        return {
            "claude": "CLAUDE.md",
            "quickstart": ".claude/docs/QUICKSTART.md",
            "standards": ".claude/docs/STANDARDS.md",
            "errors": ".claude/docs/ERRORS_AND_LESSONS.md",
        }
    return {
        "claude": "CLAUDE.md",
        "quickstart": "QUICKSTART.md",
        "standards": "STANDARDS.md",
        "errors": "ERRORS_AND_LESSONS.md",
    }


def _ralph_doc_refs(clean_root: bool) -> dict[str, str]:
    """Return Ralph-relative references for generated knowledge docs."""
    if clean_root:
        return {
            "claude": "../CLAUDE.md",
            "quickstart": "../.claude/docs/QUICKSTART.md",
            "standards": "../.claude/docs/STANDARDS.md",
            "errors": "../.claude/docs/ERRORS_AND_LESSONS.md",
        }
    return {
        "claude": "../CLAUDE.md",
        "quickstart": "../QUICKSTART.md",
        "standards": "../STANDARDS.md",
        "errors": "../ERRORS_AND_LESSONS.md",
    }


# ─────────────────────────────────────────────
# Generators — context-aware with provenance
# ─────────────────────────────────────────────

def generate_claude_md(info: dict) -> str:
    name = info["name"]
    ec = info.get("existing_content", {})
    desc = info["description"] or ec.get("description") or f"{name} project"
    stacks = ", ".join(info["stacks"]) if info["stacks"] else "not detected"
    frameworks = ", ".join(info["frameworks"]) if info["frameworks"] else "none detected"
    today = datetime.date.today().isoformat()
    sources = ec.get("sources", set())

    # Extract tier info early (used in frontmatter and overview)
    tier = info.get("tier", {})
    tier_num = tier.get("tier", 3)
    tier_conf = tier.get("confidence", "low")
    tier_reasons = tier.get("reasons", [])

    # YAML frontmatter for machine-readable metadata
    L = [
        "---",
        f"project: {name}",
        f"stack: {stacks}",
        f"framework: {frameworks}",
        f"tier: T{tier_num}",
        f"generated_by: claude-primer v{__version__}",
        f"last_updated: {today}",
        "---", "",
        "# CLAUDE.md", "",
        "<!-- Target: keep this file under 300 lines. Split detail into STANDARDS.md or local CLAUDE.md files. -->",
        "",
        "This file provides guidance to Claude Code when working in this repository.", "",
    ]

    # Adjust reference links for clean_root
    if info.get("clean_root"):
        L.extend([
            "**Quick reference:** [QUICKSTART.md](.claude/docs/QUICKSTART.md)",
            "**Standards:** [STANDARDS.md](.claude/docs/STANDARDS.md)",
            "**Mistakes:** [ERRORS_AND_LESSONS.md](.claude/docs/ERRORS_AND_LESSONS.md)",
        ])
    else:
        L.extend([
            "**Quick reference:** [QUICKSTART.md](QUICKSTART.md)",
            "**Standards:** [STANDARDS.md](STANDARDS.md)",
            "**Mistakes:** [ERRORS_AND_LESSONS.md](ERRORS_AND_LESSONS.md)",
        ])

    L += [
        "", "---", "",
        "## Routing Rules", "",
        "If the task is inside a subdirectory that has its own CLAUDE.md:",
        "1. **Read the local CLAUDE.md first** — it is the primary source for that scope.",
        "2. Use this root file only as general context.",
        "3. If the local file conflicts with this file, **the local file wins**.",
        "",
    ]

    # Sub-projects
    if ec.get("sub_project_table") and len(ec["sub_project_table"]) > 100:
        L.extend([_mark("migrated"), ec["sub_project_table"], ""])
    elif info.get("is_monorepo") and info.get("sub_project_details"):
        L.extend([
            "### Sub-Projects", "",
            "> This is a monorepo root. Each sub-project may have its own CLAUDE.md.",
            "> Run `claude-primer <sub-project-path>` to generate sub-project docs.", "",
            _mark("inferred"),
            "| Directory | Stack | Framework | Local CLAUDE.md |",
            "|-----------|-------|-----------|-----------------|",
        ])
        for sp_detail in info["sub_project_details"]:
            sp_stacks = ", ".join(sp_detail["stacks"]) if sp_detail["stacks"] else "-"
            sp_fws = ", ".join(sp_detail["frameworks"]) if sp_detail["frameworks"] else "-"
            sp_claude = "Yes" if sp_detail["has_claude_md"] else "No"
            L.append(f"| `{sp_detail['path']}/` | {sp_stacks} | {sp_fws} | {sp_claude} |")
        L.append("")
    elif info["sub_projects"]:
        L.extend([_mark("inferred"), "| Directory | Notes |", "|-----------|-------|"])
        for sp in info["sub_projects"]:
            has_c = (Path(info["root"]) / sp / "CLAUDE.md").exists()
            L.append(f"| `{sp}/` | {'Has CLAUDE.md' if has_c else 'Has own deps'} |")
        L.append("")

    # Overview
    L.extend(["---", "", "## Repository Overview", "", desc, ""])
    L.append(f"**Tech stack:** {stacks}")
    L.append(f"**Frameworks:** {frameworks}")
    L.append(f"**Suggested tier:** T{tier_num} ({tier_conf} confidence) — review required")
    if tier_reasons:
        L.append(f"**Tier rationale:** {'; '.join(tier_reasons)}")
    if info["deploy"]:
        L.append(f"**Deploy:** {', '.join(info['deploy'])}")
    if info["is_monorepo"]:
        L.append(f"**Monorepo:** {info['monorepo_tool'] or 'detected'}")
        if info["workspace_dirs"]:
            L.append(f"**Workspace dirs:** {', '.join(info['workspace_dirs'])}")
    L.append("")

    # Directory tree
    L.extend(["### Directory Structure", "", "```", f"{name}/"])
    for d in [d for d in info["directories"] if "/" not in d][:15]:
        L.append(f"├── {d}/")
    for doc in info["existing_docs"]:
        L.append(f"├── {doc}")
    L.extend(["```", ""])

    # Deploy notes
    if ec.get("deploy_notes"):
        L.extend([_mark("migrated"), "### Deployed Applications", "", ec["deploy_notes"], ""])

    # Environment
    L.extend(["---", "", "## Environment", ""])
    if ec.get("env_notes"):
        L.extend([_mark("migrated"), ec["env_notes"], ""])
    else:
        L.append(_mark("inferred"))
        if "python" in info["stacks"]: L.append("- **Python:** 3.11+ recommended")
        if "node" in info["stacks"]: L.append("- **Node.js:** 18+ recommended")
        if "rust" in info["stacks"]: L.append("- **Rust:** stable toolchain")
        if "go" in info["stacks"]: L.append("- **Go:** 1.21+")
        if "elixir" in info["stacks"]: L.append("- **Elixir:** 1.16+ / OTP 26+")
        if "swift" in info["stacks"]: L.append("- **Swift:** 5.9+")
        if "dart" in info["stacks"]: L.append("- **Dart:** 3.0+ / Flutter 3.16+")
        if "java" in info["stacks"]: L.append("- **Java:** 17+ (LTS)")
        if "dotnet" in info["stacks"]: L.append("- **dotnet:** 8.0+")
        if not info["stacks"]:
            L.extend([
                "- **Language:** (specify language and version)",
                "- **Package manager:** (pip, npm, cargo, etc.)",
                "- **Runtime:** (Node, Python, etc.)",
            ])
        L.append("")

    # Commands
    L.extend(["---", "", "## Common Commands", ""])
    if ec.get("commands") and len(ec["commands"]) >= 3:
        ranked_cmds = dedup_and_rank_commands(ec["commands"])
        L.extend([_mark("migrated"), "```bash"])
        for cmd in ranked_cmds[:20]:
            L.append(cmd)
        L.extend(["```", ""])
    else:
        L.append(_mark("inferred"))
        if "python" in info["stacks"]:
            L.append("```bash")
            if (Path(info["root"]) / "requirements.txt").exists():
                L.append("pip install -r requirements.txt")
            elif (Path(info["root"]) / "pyproject.toml").exists():
                L.append("pip install -e .")
            else:
                L.append("pip install -r requirements.txt  # or: pip install -e .")
            L.extend(["```", ""])
        if "node" in info["stacks"]:
            L.append("```bash")
            L.append("npm install")
            for sn, sc in list(info["scripts"].items())[:10]:
                L.append(f"npm run {sn:<20s} # {sc[:60]}")
            L.extend(["```", ""])
        if "rust" in info["stacks"]:
            L.extend(["```bash", "cargo build", "cargo test", "cargo run", "```", ""])
        if "go" in info["stacks"]:
            L.extend(["```bash", "go mod download", "go build ./...", "go test ./...", "```", ""])
        if "elixir" in info["stacks"]:
            L.extend(["```bash", "mix deps.get", "mix compile", "mix test", "```", ""])
        if "dart" in info["stacks"]:
            if "flutter" in info["frameworks"]:
                L.extend(["```bash", "flutter pub get", "flutter run", "flutter test", "```", ""])
            else:
                L.extend(["```bash", "dart pub get", "dart run", "dart test", "```", ""])
        if "java" in info["stacks"]:
            root = Path(info["root"])
            if (root / "pom.xml").exists():
                L.extend(["```bash", "mvn install", "mvn test", "```", ""])
            elif (root / "build.gradle").exists() or (root / "build.gradle.kts").exists():
                L.extend(["```bash", "gradle build", "gradle test", "```", ""])
            else:
                L.extend(["```bash", "mvn install  # or: gradle build", "```", ""])
        if "dotnet" in info["stacks"]:
            L.extend(["```bash", "dotnet restore", "dotnet build", "dotnet test", "```", ""])
        if not info["stacks"]:
            L.extend([
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
            ])

        # Framework-specific commands
        fw = set(info.get("frameworks", []))
        fw_cmds = []
        if "django" in fw:
            fw_cmds.extend(["python manage.py migrate", "python manage.py runserver",
                            "python manage.py createsuperuser"])
        if "flask" in fw:
            fw_cmds.extend(["flask run", "flask db upgrade"])
        if "fastapi" in fw:
            fw_cmds.append("uvicorn main:app --reload")
        if "nextjs" in fw:
            fw_cmds.extend(["npm run dev", "npm run build", "npm run start"])
        if "phoenix" in fw:
            fw_cmds.extend(["mix phx.server", "mix ecto.setup", "mix ecto.migrate"])
        if "spring" in fw:
            fw_cmds.append("mvn spring-boot:run")
        if "laravel" in fw:
            fw_cmds.extend(["php artisan serve", "php artisan migrate"])
        if fw_cmds:
            L.extend([_mark("inferred"), "### Framework Commands", "", "```bash"])
            for cmd in fw_cmds:
                L.append(cmd)
            L.extend(["```", ""])

    # Testing
    if info["test_dirs"]:
        L.extend(["---", "", "## Testing", "", f"Test directories: {', '.join(info['test_dirs'])}", "", "```bash"])
        if "python" in info["stacks"]: L.append("pytest")
        if "node" in info["stacks"]: L.append("npm test")
        if "rust" in info["stacks"]: L.append("cargo test")
        if "go" in info["stacks"]: L.append("go test ./...")
        if "elixir" in info["stacks"]: L.append("mix test")
        if "dart" in info["stacks"]: L.append("flutter test" if "flutter" in info["frameworks"] else "dart test")
        if "java" in info["stacks"]: L.append("mvn test" if (Path(info["root"]) / "pom.xml").exists() else "gradle test")
        if "dotnet" in info["stacks"]: L.append("dotnet test")
        L.extend(["```", ""])

    # Architecture
    L.extend(["---", "", "## Code Architecture", ""])
    if ec.get("architecture_notes"):
        L.extend([_mark("migrated"), ec["architecture_notes"], ""])
    else:
        L.extend([
            _mark("placeholder"), "",
            "### Patterns",
            "<!-- Ex: MVC, Clean Architecture, Event-driven, Layered, etc. -->", "",
            "### Key Modules",
            "<!-- List the main modules/packages and their responsibilities -->", "",
            "### Data Flow",
            "<!-- Describe the primary data flow of the application -->", "",
        ])

    # Data sources
    if ec.get("data_sources"):
        L.extend(["---", "", "## Data Sources", "", _mark("migrated"), ec["data_sources"], ""])

    # Invariants (with Iron Laws)
    L.extend([
        "---", "", "## Invariants", "",
        "> **Iron Law:** Read before writing. Understand existing code before changing it.",
        "",
        "- Validate external input at system boundaries",
        "- Never silently swallow errors — log or propagate with context",
        "- Prefer dry-run for operations with external side effects",
        "- Document decisions that affect future tasks",
        "- Read local CLAUDE.md before modifying scoped code",
        "",
    ])

    # Decision Heuristics
    L.extend([
        "---", "", "## Decision Heuristics", "",
        "When in doubt, apply these in order:", "",
        "1. **Reversible over perfect** — prefer actions you can undo over waiting for certainty",
        "2. **Smallest viable change** — solve the immediate problem, nothing more",
        "3. **Existing patterns over new abstractions** — follow what the codebase already does",
        "4. **Explicit failure over silent success** — if unsure something worked, make it loud",
        "5. **Data over debate** — run the test, check the log, read the error",
        "6. **Ask over assume** — when a decision has consequences you cannot reverse, ask the user",
        "",
    ])

    # Verification Standard
    L.extend([
        "---", "", "## Verification Standard", "",
        "> **Iron Law:** Evidence before claims, always.",
        "",
        "- Run the actual command — don't assume success",
        "- Fresh verification after every change — stale results are lies",
        "- Independent verification — don't trust agent output without checking",
        "- Verify at every layer the data passes through (defense-in-depth)",
        "",
    ])

    # Red Flags
    L.extend([
        "---", "", "## Red Flags", "",
        "If you catch yourself thinking any of these, **STOP and follow the process:**", "",
        "- \"This is just a quick fix\" → Follow the full process anyway",
        "- \"I don't need to test this\" → You definitely need to test this",
        "- \"It should work now\" → RUN the verification",
        "- \"One more attempt should fix it\" → 3+ failures = architectural problem, step back",
        "- \"Too simple to need a plan\" → Simple changes break complex systems",
        "- \"I'll clean it up later\" → Later never comes. Do it right now",
        "",
    ])

    # Stuck Protocol
    L.extend([
        "---", "", "## Stuck Protocol", "",
        "If you have tried **3+ approaches** to the same problem without progress:", "",
        "1. **Stop** — do not attempt another fix",
        "2. **Document** the blocker: what you tried, what failed, what you suspect",
        "3. **List** remaining untried approaches (if any)",
        "4. **Skip** — move to the next task or ask the user for guidance", "",
        "Spinning without progress is the most expensive failure mode. Detecting it early is critical.",
        "",
    ])

    # Key Decisions
    L.extend([
        "---", "", "## Key Decisions", "",
        _mark("placeholder"),
        "| Decision | Rationale | Status |",
        "|----------|-----------|--------|",
        "| <!-- e.g. Use PostgreSQL --> | <!-- why this choice --> | <!-- Active / Revisit / Superseded --> |",
        "",
        "<!-- Track decisions that constrain future work. Remove rows when no longer relevant. -->",
        "",
    ])

    # Active Risks
    L.extend([
        "---", "", "## Active Risks", "",
        _mark("placeholder"),
        "<!-- What is currently fragile, under migration, or operationally risky -->",
        "<!-- Remove items as they are resolved -->",
        "",
    ])

    # Formatting
    L.extend(["---", "", "## Formatting Standards", ""])
    if ec.get("formatting_rules"):
        L.append(_mark("migrated"))
        for rule in ec["formatting_rules"]:
            L.append(f"- {rule}")
        L.append("")
    else:
        L.extend([
            _mark("placeholder"),
            "- Use consistent indentation (spaces or tabs, not mixed)",
            "- Maximum line length: 100 characters",
            "- Files end with a single newline",
            "- No trailing whitespace",
            "- Use descriptive variable and function names",
            "- Keep functions focused — one responsibility per function",
            "- Prefer explicit over implicit",
            "",
        ])

    # Stakeholders
    if ec.get("stakeholder_notes"):
        L.extend(["---", "", "## Stakeholder Preferences", "",
                   _mark("migrated"), ec["stakeholder_notes"], ""])

    # Pre-Task Protocol (Announce-at-Start + Checklist)
    L.extend(["---", "", "## Pre-Task Protocol", ""])
    L.extend([
        "### Announce at Start", "",
        "Before writing any code, announce:", "",
        "1. **What approach** you are using (fix, feature, refactor, etc.)",
        "2. **Which files** you expect to modify",
        "3. **What verification** you will run when done", "",
    ])
    L.extend(["### Checklist", "", "Before starting any task:", ""])
    if ec.get("checklist_items"):
        L.append(_mark("migrated"))
        L.extend(ec["checklist_items"])
    else:
        L.append(_mark("placeholder"))
        L.append("- [ ] Read ERRORS_AND_LESSONS.md for known pitfalls")
        L.append("- [ ] Check if a local CLAUDE.md exists in the working directory")
        L.append("- [ ] Understand the existing code before making changes")
        L.append("- [ ] Run tests after changes to verify nothing broke")
        L.append("- [ ] Keep changes minimal and focused on the task")
        if info["env_files"]:
            L.append("- [ ] Verify `.env` configuration is up to date")
    L.append("")

    # Post-Task Protocol
    L.extend([
        "### Post-Task", "",
        "Before ending a session or completing a task:", "",
        "- [ ] Update ERRORS_AND_LESSONS.md if you hit a non-obvious problem",
        "- [ ] Record any decision that constrains future work in Key Decisions",
        "- [ ] If work is incomplete, leave a clear note about what remains",
        "- [ ] Run final verification to confirm nothing is broken",
        "",
    ])

    # Parallel Development (worktrees) — only for git projects
    if info["has_git"]:
        L.extend([
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
        ])

    # Provenance summary
    if sources:
        L.extend(["---", "", "## Provenance", "",
                   "Content in this file was assembled from:", ""])
        for src in sorted(sources):
            L.append(f"- `{src}`")
        L.append("")
        L.append("Sections containing `migrated` in a comment came from existing files — verify accuracy.")
        L.append("Sections containing `inferred` were detected from project structure — may need correction.")
        L.append("Sections containing `placeholder` need manual input.")
        L.append("")

    L.extend(["---", "", "## Document Information", "",
              f"**Last Updated:** {today}",
              f"**Generated by:** claude-primer v{__version__}"])

    return "\n".join(L) + "\n"


def generate_quickstart_md(info: dict) -> str:
    ec = info.get("existing_content", {})
    # Adjust cross-references for clean_root (from .claude/docs/, CLAUDE.md is at ../../CLAUDE.md)
    if info.get("clean_root"):
        claude_ref = "[CLAUDE.md](../../CLAUDE.md)"
        standards_ref = "[STANDARDS.md](STANDARDS.md)"
    else:
        claude_ref = "[CLAUDE.md](CLAUDE.md)"
        standards_ref = "[STANDARDS.md](STANDARDS.md)"
    L = [
        "<!-- AUTO-MAINTAINED by claude-primer. Manual edits below the marker will be preserved. -->",
        "",
        "# Quick Start — Command Reference", "",
        f"Commands only. For context: {claude_ref}. For rules: {standards_ref}.",
        "", "---", "",
    ]

    if ec.get("commands") and len(ec["commands"]) >= 3:
        ranked_cmds = dedup_and_rank_commands(ec["commands"])
        L.extend([_mark("migrated"), "## Commands", "", "```bash"])
        for cmd in ranked_cmds[:15]:
            L.append(cmd)
        L.extend(["```", ""])
    else:
        L.extend([_mark("inferred"), "## Setup", "", "```bash"])
        if "python" in info["stacks"]:
            root = Path(info["root"])
            if (root / "requirements.txt").exists():
                L.append("pip install -r requirements.txt")
            elif (root / "pyproject.toml").exists():
                L.append("pip install -e .")
            else:
                L.append("pip install -r requirements.txt")
        if "node" in info["stacks"]: L.append("npm install")
        if "rust" in info["stacks"]: L.append("cargo build")
        if "go" in info["stacks"]: L.append("go mod download")
        if "elixir" in info["stacks"]: L.append("mix deps.get")
        if "dart" in info["stacks"]: L.append("flutter pub get" if "flutter" in info.get("frameworks", []) else "dart pub get")
        if "java" in info["stacks"]:
            root = Path(info["root"])
            if (root / "pom.xml").exists():
                L.append("mvn install")
            elif (root / "build.gradle").exists() or (root / "build.gradle.kts").exists():
                L.append("gradle build")
            else:
                L.append("mvn install")
        if "dotnet" in info["stacks"]: L.append("dotnet restore")
        if not info["stacks"]:
            L.extend([
                "# 1. Install dependencies",
                "# (add install command here)",
                "",
                "# 2. Configure environment",
                "# cp .env.example .env",
                "",
                "# 3. Run",
                "# (add run command here)",
            ])
        L.extend(["```", ""])

        if info["scripts"]:
            L.extend(["## Run", "", "```bash"])
            priority = ["dev", "start", "build", "test", "lint", "format", "deploy"]
            added = set()
            for s in priority:
                if s in info["scripts"]:
                    L.append(f"npm run {s}")
                    added.add(s)
            for s in info["scripts"]:
                if s not in added and len(added) < 10:
                    L.append(f"npm run {s}")
                    added.add(s)
            L.extend(["```", ""])

    if info["test_dirs"]:
        L.extend(["## Test", "", "```bash"])
        if "python" in info["stacks"]: L.append("pytest")
        if "node" in info["stacks"]: L.append("npm test")
        if "rust" in info["stacks"]: L.append("cargo test")
        if "go" in info["stacks"]: L.append("go test ./...")
        if "elixir" in info["stacks"]: L.append("mix test")
        if "dart" in info["stacks"]: L.append("flutter test" if "flutter" in info.get("frameworks", []) else "dart test")
        if "dotnet" in info["stacks"]: L.append("dotnet test")
        L.extend(["```", ""])

    L.extend(["## Quick Fixes", "", "| Problem | Fix |", "|---------|-----|"])
    if "python" in info["stacks"]:
        L.append("| Module not found | `pip install -r requirements.txt` |")
    if "node" in info["stacks"]:
        L.append("| Module not found | `rm -rf node_modules && npm install` |")
        L.append("| Port in use | `npm run dev -- -p 3001` |")
    if "elixir" in info["stacks"]:
        L.append("| Deps conflict | `mix deps.clean --all && mix deps.get` |")
    if "go" in info["stacks"]:
        L.append("| Module mismatch | `go mod tidy` |")
    if not info["stacks"]:
        L.append("| Permission denied | `chmod +x script.sh` |")
        L.append("| Port already in use | `lsof -i :PORT` then `kill -9 PID` |")
        L.append("| Git merge conflict | Resolve manually, then `git add . && git commit` |")
        L.append("| Env var missing | Check `.env` file or export manually |")
    # Complete Example Workflow
    L.extend([
        "", "## Complete Workflow Example", "",
        "A typical development cycle from start to finish:", "",
        "```bash",
        "# 1. Set up (first time only)",
    ])
    if "python" in info["stacks"]:
        L.append("python -m venv .venv && source .venv/bin/activate")
        L.append("pip install -r requirements.txt")
    elif "node" in info["stacks"]:
        L.append("npm install")
    elif "rust" in info["stacks"]:
        L.append("cargo build")
    else:
        L.append("# (run install command)")
    L.extend([
        "",
        "# 2. Create a branch for your work",
        "git checkout -b feature/my-feature",
        "",
        "# 3. Make changes, then verify",
    ])
    if "python" in info["stacks"]:
        L.append("pytest  # run tests")
    elif "node" in info["stacks"]:
        L.append("npm test  # run tests")
    elif "rust" in info["stacks"]:
        L.append("cargo test  # run tests")
    else:
        L.append("# (run test command)")
    L.extend([
        "",
        "# 4. Commit and push",
        "git add -A && git commit -m 'feat: describe your change'",
        "git push -u origin feature/my-feature",
        "```", "",
    ])

    # Adjust references for clean_root
    if info.get("clean_root"):
        L.extend(["## References", "",
                  "- [CLAUDE.md](../../CLAUDE.md)",
                  "- [STANDARDS.md](STANDARDS.md)",
                  "- [ERRORS_AND_LESSONS.md](ERRORS_AND_LESSONS.md)",
                  "", "---", f"**Last Updated:** {datetime.date.today().isoformat()}"])
    else:
        L.extend(["## References", "",
                  "- [CLAUDE.md](CLAUDE.md)",
                  "- [STANDARDS.md](STANDARDS.md)",
                  "- [ERRORS_AND_LESSONS.md](ERRORS_AND_LESSONS.md)",
                  "", "---", f"**Last Updated:** {datetime.date.today().isoformat()}"])

    return "\n".join(L) + "\n"


def generate_standards_md(info: dict) -> str:
    today = datetime.date.today().isoformat()
    ec = info.get("existing_content", {})
    has_external = any(
        f in info["frameworks"]
        for f in ["django", "flask", "fastapi", "nextjs", "nestjs", "hono", "express",
                  "phoenix", "spring", "laravel", "gin", "fiber", "echo", "remix", "astro"]
    )

    existing = ec.get("standards_sections", {})
    if len(existing) >= 4:
        L = [
            "# STANDARDS.md — QA & Documentation Standards", "",
            "Quality assurance and documentation standards for this repository.", "",
            "**Referenced by CLAUDE.md. Enforced by Claude Code.**", "",
            "**Verifiability principle:** Every rule in this file can be checked objectively.",
            "", _mark("migrated"), "", "---", "",
        ]
        for heading, body in existing.items():
            if not heading:
                continue
            L.extend([f"## {heading}", "", body, ""])
        L.append(f"**Last Updated:** {today}")
        return "\n".join(L) + "\n"

    # ── Tier detection for gates ──
    tier = info.get("tier", {})
    tier_num = tier.get("tier", 3)

    L = [
        "# STANDARDS.md — Governance & Quality Standards", "",
        "Lean governance for this repository. Every rule is objectively verifiable.", "",
        "**Referenced by:** [CLAUDE.md](../../CLAUDE.md)" if info.get("clean_root") else "**Referenced by:** [CLAUDE.md](CLAUDE.md)", "",
        "**Assumed knowledge:** Language-standard conventions (PEP 8, ESLint defaults, etc.) are assumed.",
        "This file only documents project-specific rules and deviations.",
        "", "---", "",

        # Core Principles
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

        # Project Tiers
        "## 2. Project Tiers", "",
        "| Tier | Blast Radius | Required Gates | Max Iterations |",
        "|------|-------------|----------------|----------------|",
        "| **T1** | Multi-phase, writes to external systems | README, CLAUDE.md, PLAN.md, dry-run, preflight, manifest | 15 |",
        "| **T2** | Single-phase, external reads/writes | README, CLAUDE.md, dry-run, preflight | 10 |",
        "| **T3** | Local only — reads data, generates reports | README | 7 |",
        "| **T4** | Reference material, static resources | Optional | 5 |",
        "", "---", "",

        # Required Gates by Tier
        "## 3. Required Gates by Tier", "",
    ]

    # T1/T2 gates
    if tier_num <= 2 or has_external:
        L.extend([
            "### T1/T2 — External Systems", "",
            "- **Dry-run default:** no writes without `--live` flag",
            "- **Preflight validation:** inputs exist and are well-formed before execution",
            "- **Manifest output:** JSON manifest in `output/` after every run",
            "- **Rollback info:** manifest contains enough data to undo manually",
            "- **Idempotency:** README documents whether re-running is safe", "",
        ])

    L.extend([
        "### T3 — Local Processing", "",
        "- Validate input files before processing",
        "- Clear error messages on failure",
        "- Non-zero exit code on error", "",
    ])

    L.extend([
        "### T4 — Documentation", "",
        "- No execution-level gates required",
        "", "---", "",
    ])

    # Naming Conventions
    L.extend(["## 4. Naming Conventions", ""])
    if "python" in info["stacks"]:
        L.extend(["### Python", "- Files: `snake_case.py`", "- Verb-first for scripts: `publish_`, `validate_`", ""])
    if "node" in info["stacks"]:
        L.extend(["### JavaScript/TypeScript", "- Files: `camelCase.ts` or `kebab-case.ts` (be consistent)", "- Components: `PascalCase.tsx`", ""])
    if "rust" in info["stacks"]:
        L.extend(["### Rust", "- Files: `snake_case.rs`", ""])
    if "go" in info["stacks"]:
        L.extend(["### Go", "- Files: `snake_case.go`", "- Packages: short, lowercase, no underscores", ""])
    if "elixir" in info["stacks"]:
        L.extend(["### Elixir", "- Files: `snake_case.ex`", "- Modules: `PascalCase`", ""])
    if "java" in info["stacks"]:
        L.extend(["### Java/Kotlin", "- Files: `PascalCase.java` / `PascalCase.kt`", "- Packages: `com.company.project`", ""])
    if "dart" in info["stacks"]:
        L.extend(["### Dart", "- Files: `snake_case.dart`", "- Classes: `PascalCase`", ""])
    if not info["stacks"]:
        L.extend([
            "### General",
            "- Files: lowercase with hyphens or underscores (be consistent)",
            "- Constants: `UPPER_SNAKE_CASE`",
            "- Functions/methods: descriptive, verb-first names",
            "- Classes: `PascalCase`",
            "",
        ])

    L.extend([
        "### Config & Output",
        "- Config: YAML or TOML", "- Data/output: JSON", "- Secrets: `.env` (never committed)",
        "", "---", "",

        # Code Quality
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

        # Git Conventions
        "## 6. Git Conventions", "",
        "- Branch naming: `feature/`, `fix/`, `chore/` prefixes",
        "- Commit messages: imperative mood, max 72 chars first line",
        "- One logical change per commit",
        "- Never commit `.env`, credentials, or large binaries",
        "", "---", "",

        # Plan Format
        "## 7. Plan Format Standard", "",
        "When writing implementation plans:", "",
        "- Break work into bite-sized tasks (2-5 minutes each)",
        "- Each task specifies: exact file paths, expected changes, verification command",
        "- Tasks are written for someone with zero context about the codebase",
        "- Order: setup → implement → test → verify → document",
        "- Include expected output for verification commands",
        "", "---", "",

        # Documentation Relevance
        "## 8. Documentation Relevance Rule", "",
        "Document only what helps someone proceed safely with the next task.", "",
        "- If a decision constrains future work → document it",
        "- If a workaround exists for a known issue → document it in ERRORS_AND_LESSONS.md",
        "- If documentation would be stale within a sprint → skip it",
        "- Pressure-test documentation: if an agent rationalizes around a rule, add an explicit counter",
        "", "---", "",

        # Exception Rule
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

        # Error Catalog
        "## 10. Error Catalog", "",
        "All recurring errors must be documented in [ERRORS_AND_LESSONS.md](ERRORS_AND_LESSONS.md).", "",
        "---", "",
        f"**Created:** {today}", f"**Last Updated:** {today}",
    ])

    return "\n".join(L) + "\n"


def generate_errors_md(info: dict) -> str:
    ec = info.get("existing_content", {})
    entries = ec.get("errors_entries", [])

    L = [
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
    ]

    if entries:
        L.extend([_mark("migrated"), ""])
        for entry in entries:
            first_line = entry.split("\n")[0]
            rest = "\n".join(entry.split("\n")[1:]).strip()
            L.append(f"### {first_line}")
            if rest:
                L.append(rest)
            L.append("")
    else:
        L.extend([
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
        ])

    # Rationalization Table — common excuses mapped to reality
    L.extend([
        "", "---", "",
        "## Rationalization Table", "",
        "Common excuses that lead to mistakes. If you catch yourself thinking these, stop.", "",
        "| Excuse | Reality |",
        "|--------|---------|",
        "| \"Too simple to test\" | Simple code breaks. A test takes 30 seconds. |",
        "| \"I'll fix it later\" | Later never comes. First fix sets the pattern. |",
        "| \"Should work now\" | RUN the verification. Assumptions are bugs waiting to happen. |",
        "| \"Just a quick fix\" | Quick fixes become permanent. Follow the full process. |",
        "| \"I'll test after I finish\" | Tests written after code are weaker. Write them first. |",
        "| \"The agent said it succeeded\" | Verify independently. Trust but verify. |",
        "| \"One more attempt should fix it\" | 3+ failures = architectural problem. Step back. |",
        "| \"This doesn't need a plan\" | Plans prevent wasted effort. 5 minutes of planning saves hours. |",
        "| \"I know this codebase\" | Read the code anyway. Memory is unreliable. |",
        "",
    ])

    # Defense-in-Depth Debugging Pattern
    L.extend([
        "---", "",
        "## Defense-in-Depth Debugging", "",
        "After fixing any bug, validate at every layer the data passes through:", "",
        "1. **Entry point** — is the input correct where it enters the system?",
        "2. **Business logic** — does the transformation produce the right result?",
        "3. **Environment guards** — are configs, permissions, and dependencies correct?",
        "4. **Output verification** — does the final output match expectations?", "",
        "Don't stop at the first layer that looks correct. Bugs hide behind other bugs.",
        "",
    ])

    return "\n".join(L) + "\n"


def generate_readme_md(info: dict) -> str:
    name = info["name"]
    desc = info["description"] or "(Add project description)"
    stacks = ", ".join(info["stacks"]) if info["stacks"] else ""
    doc_refs = _root_doc_refs(info.get("clean_root", False))

    L = [f"# {name}", "", desc, ""]
    if stacks:
        L.extend([f"**Stack:** {stacks}", ""])
    if info["is_monorepo"]:
        L.extend([f"**Monorepo:** {info['monorepo_tool'] or 'detected'}", ""])
    L.extend([
        "## Setup", "", f"See [QUICKSTART.md]({doc_refs['quickstart']}) for commands.", "",
        "## Documentation", "",
        f"- [CLAUDE.md]({doc_refs['claude']}) — Full project context for Claude Code",
        f"- [STANDARDS.md]({doc_refs['standards']}) — QA and documentation rules",
        f"- [QUICKSTART.md]({doc_refs['quickstart']}) — Command reference",
        f"- [ERRORS_AND_LESSONS.md]({doc_refs['errors']}) — Mistake catalog",
    ])

    return "\n".join(L) + "\n"


# ─────────────────────────────────────────────
# Ralph integration generators
# ─────────────────────────────────────────────

def generate_ralph_prompt_md(info: dict) -> str:
    """Generate thin PROMPT.md that delegates to CLAUDE.md instead of duplicating context."""
    doc_refs = _ralph_doc_refs(info.get("clean_root", False))
    L = [
        "# Ralph Development Instructions", "",
        "## Project Context", "",
        "All project context, architecture, conventions, and standards are maintained in the",
        "repository knowledge architecture files. Read them in this order:", "",
        f"1. **[{doc_refs['claude']}]({doc_refs['claude']})** — Primary project context (architecture, stack, conventions)",
        f"2. **[{doc_refs['standards']}]({doc_refs['standards']})** — QA rules, tier system, naming conventions",
        f"3. **[{doc_refs['errors']}]({doc_refs['errors']})** — Mistakes catalog (read BEFORE starting work)",
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
        f"- If you encounter a recurring error, add it to `{doc_refs['errors']}`",
        "- If you're stuck on the same problem for 2+ loops, describe the blocker in RALPH_STATUS",
        "- Never silently skip a failing test", "",
        "### Auto-Documentation",
        "After completing a milestone:", "",
        f"1. Update `{doc_refs['quickstart']}` if new commands were added (only if it has the AUTO-MAINTAINED marker)",
        f"2. Update `{doc_refs['claude']}` if architecture changed",
        f"3. Add errors/lessons to `{doc_refs['errors']}`",
    ]
    return "\n".join(L) + "\n"


def generate_ralph_fix_plan_md(info: dict) -> str:
    """Generate initial fix_plan.md task list template."""
    name = info.get("name", "project")
    L = [
        "# Fix Plan — Task Priorities", "",
        "## Current Sprint", "",
        f"- [ ] [P0] Define and implement core {name} structure",
        "- [ ] [P1] (Add your tasks here)",
        "- [ ] [P2] Write tests for core functionality",
        "- [ ] [P3] Documentation and cleanup", "",
        "## Completed", "",
        "(Ralph moves completed tasks here)",
    ]
    return "\n".join(L) + "\n"


def generate_ralphrc(info: dict) -> str:
    """Generate stack-aware .ralphrc configuration."""
    name = info.get("name", "my-project")
    stacks = info.get("stacks", [])

    # Build ALLOWED_TOOLS from detected stacks
    base_tools = "Write,Read,Edit,Bash(git *),Bash(cat *),Bash(ls *)"
    stack_tools = []
    for stack in stacks:
        if stack in RALPH_TOOLS_BY_STACK:
            stack_tools.append(RALPH_TOOLS_BY_STACK[stack])
    all_tools = base_tools
    if stack_tools:
        all_tools += "," + ",".join(stack_tools)

    # Determine project type for Ralph
    project_type = stacks[0] if stacks else "generic"

    L = [
        "# .ralphrc — Ralph project configuration",
        f"# Generated by claude-primer for {name}",
        "",
        "# ── Project identity ──",
        f'PROJECT_NAME="{name}"',
        f'PROJECT_TYPE="{project_type}"',
        "",
        "# ── Loop control ──",
        "MAX_CALLS_PER_HOUR=100",
        "CLAUDE_TIMEOUT_MINUTES=15",
        'CLAUDE_OUTPUT_FORMAT="json"',
        "",
        "# ── Tool permissions ──",
        "# Auto-generated from detected stacks. Adjust as needed.",
        f'ALLOWED_TOOLS="{all_tools}"',
        "",
        "# ── Session management ──",
        "SESSION_CONTINUITY=true",
        "SESSION_EXPIRY_HOURS=24",
        "",
        "# ── Circuit breaker thresholds ──",
        "CB_NO_PROGRESS_THRESHOLD=3",
        "CB_SAME_ERROR_THRESHOLD=5",
    ]
    return "\n".join(L) + "\n"


def generate_ralph_post_loop_hook(info: dict) -> str:
    """Generate post-loop hook that detects changes to knowledge architecture files."""
    L = [
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
    ]
    return "\n".join(L) + "\n"


RALPH_GITIGNORE_ENTRIES = """
# Ralph runtime files
.ralph/logs/
.ralph/.ralph_session
.ralph/.ralph_session_history
.ralph/status.json
.ralph/live.log
.ralph/docs/generated/
"""


def setup_ralph(target: Path, info: dict, dry_run: bool = False, force: bool = False) -> list:
    """Orchestrate Ralph integration file creation. Returns list of FileAction."""
    actions = []
    ralph_dir = target / ".ralph"
    hooks_dir = ralph_dir / "hooks"
    doc_refs = _ralph_doc_refs(info.get("clean_root", False))

    if not dry_run:
        ralph_dir.mkdir(parents=True, exist_ok=True)
        hooks_dir.mkdir(parents=True, exist_ok=True)

    # 1. .ralph/PROMPT.md — always overwrite (thin wrapper, no user content)
    prompt_path = ralph_dir / "PROMPT.md"
    prompt_exists = prompt_path.exists()
    content = generate_ralph_prompt_md(info)
    if not dry_run:
        prompt_path.write_text(content, encoding="utf-8")
    actions.append(FileAction(".ralph/PROMPT.md", "overwrite" if prompt_exists else "create", lines=content.count("\n")))

    # 2. .ralph/AGENT.md → knowledge architecture quickstart symlink
    agent_path = ralph_dir / "AGENT.md"
    agent_exists = agent_path.exists() or agent_path.is_symlink()
    if not dry_run:
        if agent_exists:
            agent_path.unlink()
        agent_path.symlink_to(doc_refs["quickstart"])
    actions.append(FileAction(".ralph/AGENT.md", "overwrite" if agent_exists else "create", reason=f"symlink → {doc_refs['quickstart']}"))

    # 3. .ralph/fix_plan.md — only create if doesn't exist (Ralph owns this file)
    fix_plan_path = ralph_dir / "fix_plan.md"
    fix_plan_exists = fix_plan_path.exists()
    if fix_plan_exists:
        actions.append(FileAction(".ralph/fix_plan.md", "skip", reason="Ralph owns this file"))
    else:
        content = generate_ralph_fix_plan_md(info)
        if not dry_run:
            fix_plan_path.write_text(content, encoding="utf-8")
        actions.append(FileAction(".ralph/fix_plan.md", "create", lines=content.count("\n"), reason="Ralph owns this file"))

    # 4. .ralphrc at project root
    ralphrc_path = target / ".ralphrc"
    ralphrc_exists = ralphrc_path.exists()
    content = generate_ralphrc(info)
    if ralphrc_exists and not force:
        actions.append(FileAction(".ralphrc", "skip", reason="exists"))
    else:
        if not dry_run:
            ralphrc_path.write_text(content, encoding="utf-8")
        mode = "overwrite" if ralphrc_exists else "create"
        actions.append(FileAction(".ralphrc", mode, lines=content.count("\n")))

    # 5. .ralph/hooks/post-loop.sh
    hook_path = hooks_dir / "post-loop.sh"
    hook_exists = hook_path.exists()
    content = generate_ralph_post_loop_hook(info)
    if not dry_run:
        hook_path.write_text(content, encoding="utf-8")
        hook_path.chmod(0o755)
    actions.append(FileAction(".ralph/hooks/post-loop.sh", "overwrite" if hook_exists else "create", lines=content.count("\n")))

    # 6. Update .gitignore with Ralph entries
    gitignore_path = target / ".gitignore"
    gitignore_exists = gitignore_path.exists()
    if gitignore_path.exists():
        existing = gitignore_path.read_text(encoding="utf-8", errors="ignore")
    else:
        existing = ""
    if ".ralph/logs/" not in existing:
        if not dry_run:
            with open(str(gitignore_path), "a", encoding="utf-8") as f:
                f.write(RALPH_GITIGNORE_ENTRIES)
        actions.append(FileAction(".gitignore", "update" if gitignore_exists else "create", reason="added Ralph entries"))

    return actions


# ─────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────

# Default file set (README.md excluded — opt-in with --with-readme)
DEFAULT_FILES = [
    ("CLAUDE.md", generate_claude_md),
    ("QUICKSTART.md", generate_quickstart_md),
    ("STANDARDS.md", generate_standards_md),
    ("ERRORS_AND_LESSONS.md", generate_errors_md),
]


def _empty_scan_result(target: Path) -> dict:
    """Return a blank scan result for nonexistent/empty directories."""
    return {
        "root": str(target),
        "name": target.name,
        "is_empty": True,
        "stacks": [],
        "frameworks": [],
        "deploy": [],
        "has_git": False,
        "existing_docs": [],
        "sub_projects": [],
        "directories": [],
        "file_count": 0,
        "extension_counts": defaultdict(int),
        "config_files": [],
        "test_dirs": [],
        "env_files": [],
        "scripts": {},
        "description": "",
        "existing_content": {},
        "is_monorepo": False,
        "monorepo_tool": "",
        "workspace_dirs": [],
        "sub_project_details": [],
    }


# ─────────────────────────────────────────────
# Interactive wizard for empty projects
# ─────────────────────────────────────────────

_FRAMEWORKS_BY_STACK = {
    "python": ["django", "flask", "fastapi", "streamlit"],
    "node": ["nextjs", "react", "vue", "svelte", "solidjs", "remix", "astro",
             "express", "nestjs", "hono"],
    "rust": ["axum", "actix", "rocket"],
    "go": ["gin", "fiber", "echo"],
    "elixir": ["phoenix"],
    "java": ["spring"],
    "php": ["laravel"],
    "dart": ["flutter"],
    "ruby": [], "dotnet": [], "swift": [], "zig": [], "scala": [],
}

_DEPLOY_OPTIONS = ["docker", "vercel", "render", "fly.io", "github_actions", "gitlab_ci"]

_STACK_DISPLAY = {
    "python": "Python", "node": "Node.js/TypeScript", "rust": "Rust",
    "go": "Go", "ruby": "Ruby", "java": "Java/Kotlin", "php": "PHP",
    "dotnet": ".NET", "elixir": "Elixir", "swift": "Swift",
    "dart": "Dart/Flutter", "zig": "Zig", "scala": "Scala",
}


def _pick_multi(prompt: str, options: list[str], display: dict | None = None) -> list[str]:
    """Show numbered list, accept comma-separated input. Enter to skip."""
    print(f"\n  {prompt}")
    for i, opt in enumerate(options, 1):
        label = display.get(opt, opt) if display else opt
        print(f"    {i:>2}) {label}")
    print(f"    Enter) skip")
    raw = _safe_input("  Choice (e.g. 1,3,5): ", default="").strip()
    if not raw:
        return []
    selected = []
    for part in raw.replace(" ", "").split(","):
        try:
            idx = int(part) - 1
            if 0 <= idx < len(options):
                selected.append(options[idx])
        except ValueError:
            part_lower = part.lower()
            for opt in options:
                if opt.lower() == part_lower:
                    selected.append(opt)
                    break
    return list(dict.fromkeys(selected))


def run_wizard(info: dict) -> dict:
    """Interactive wizard for empty/new projects. Injects answers into info dict."""
    print("  No code detected — starting project wizard.")
    print("  Answer a few questions to generate contextual docs.")
    print("  Press Enter to skip any question.\n")

    # 1. Description
    desc = _safe_input("  Project description (one line): ", default="").strip()
    if desc:
        info["description"] = desc

    # 2. Stacks
    stack_keys = list(_STACK_DISPLAY.keys())
    chosen_stacks = _pick_multi("Which language(s)/runtime(s)?", stack_keys, _STACK_DISPLAY)
    if chosen_stacks:
        info["stacks"] = chosen_stacks

    # 3. Frameworks — filtered by chosen stacks
    available_frameworks = []
    for s in info["stacks"]:
        available_frameworks.extend(_FRAMEWORKS_BY_STACK.get(s, []))
    available_frameworks = list(dict.fromkeys(available_frameworks))
    if available_frameworks:
        chosen_frameworks = _pick_multi("Which framework(s)?", available_frameworks)
        if chosen_frameworks:
            info["frameworks"] = chosen_frameworks

    # 4. Deploy
    chosen_deploy = _pick_multi("Deploy target(s)?", _DEPLOY_OPTIONS)
    if chosen_deploy:
        info["deploy"] = chosen_deploy

    # 5. Monorepo
    if len(info["stacks"]) > 1 or "node" in info["stacks"]:
        mono = _safe_input("\n  Is this a monorepo? [y/N]: ", default="n").strip().lower()
        if mono in ("y", "yes", "s", "sim"):
            info["is_monorepo"] = True
            tool = _safe_input("  Monorepo tool (turborepo/nx/pnpm/lerna) [Enter to skip]: ", default="").strip().lower()
            if tool in ("turborepo", "nx", "pnpm", "lerna"):
                info["monorepo_tool"] = tool

    has_config = bool(info["stacks"] or info["frameworks"] or info["description"])
    if has_config:
        if "existing_content" not in info:
            info["existing_content"] = {}
        info["existing_content"].setdefault("sources", set()).add("wizard")
        info["is_empty"] = False

        print()
        print("  ─── Wizard summary ───")
        if info["description"]:
            print(f"  Description: {info['description']}")
        if info["stacks"]:
            print(f"  Stacks: {', '.join(info['stacks'])}")
        if info["frameworks"]:
            print(f"  Frameworks: {', '.join(info['frameworks'])}")
        if info["deploy"]:
            print(f"  Deploy: {', '.join(info['deploy'])}")
        if info["is_monorepo"]:
            print(f"  Monorepo: {info['monorepo_tool'] or 'yes'}")
        print("  ──────────────────────\n")
    else:
        print("\n  All questions skipped — generating generic templates.\n")

    return info


# ─────────────────────────────────────────────
# Post-generation verification
# ─────────────────────────────────────────────

def _verify_generated(target: Path, actions: list, clean_root: bool = False) -> list[str]:
    """Verify generated files exist and have expected structure. Returns list of issues."""
    issues = []
    for a in actions:
        if clean_root and a.filename not in ("CLAUDE.md", "README.md"):
            fp = target / ".claude" / "docs" / a.filename
        else:
            fp = target / a.filename
        if not fp.exists():
            issues.append(f"{a.filename}: file not written")
            continue
        content = fp.read_text(encoding="utf-8", errors="ignore")
        if not content.strip():
            issues.append(f"{a.filename}: file is empty")
            continue
        # Check for expected heading
        if a.filename.endswith(".md") and not re.search(r"^#\s+", content, re.MULTILINE):
            issues.append(f"{a.filename}: missing markdown heading")
        # Check CLAUDE.md has frontmatter
        if a.filename == "CLAUDE.md" and not content.startswith("---"):
            issues.append(f"CLAUDE.md: missing YAML frontmatter")
    return issues


# ─────────────────────────────────────────────
# RC file persistence
# ─────────────────────────────────────────────

RC_FILENAME = ".claude-setup.rc"

def _rc_path(target: Path) -> Path:
    return target / RC_FILENAME


def load_rc(target: Path) -> dict:
    """Load saved wizard answers from .claude-setup.rc. Returns empty dict if absent."""
    rc = _rc_path(target)
    if not rc.exists():
        return {}
    try:
        cp = configparser.ConfigParser()
        cp.read(str(rc), encoding="utf-8")
        result = {}
        if cp.has_section("project"):
            for key in ("description", "monorepo_tool"):
                if cp.has_option("project", key):
                    result[key] = cp.get("project", key)
            for key in ("stacks", "frameworks", "deploy"):
                if cp.has_option("project", key):
                    val = cp.get("project", key).strip()
                    result[key] = [v.strip() for v in val.split(",") if v.strip()] if val else []
            if cp.has_option("project", "is_monorepo"):
                result["is_monorepo"] = cp.getboolean("project", "is_monorepo")
            if cp.has_option("project", "with_ralph"):
                result["with_ralph"] = cp.getboolean("project", "with_ralph")
            if cp.has_option("project", "clean_root"):
                result["clean_root"] = cp.getboolean("project", "clean_root")
        return result
    except (configparser.Error, OSError):
        return {}


def save_rc(target: Path, info: dict) -> None:
    """Save wizard answers to .claude-setup.rc for future runs."""
    cp = configparser.ConfigParser()
    cp.add_section("project")
    if info.get("description"):
        cp.set("project", "description", info["description"])
    for key in ("stacks", "frameworks", "deploy"):
        vals = info.get(key, [])
        if vals:
            cp.set("project", key, ", ".join(vals))
    if info.get("is_monorepo"):
        cp.set("project", "is_monorepo", "true")
        if info.get("monorepo_tool"):
            cp.set("project", "monorepo_tool", info["monorepo_tool"])
    if info.get("with_ralph"):
        cp.set("project", "with_ralph", "true")
    if info.get("clean_root"):
        cp.set("project", "clean_root", "true")
    try:
        with open(str(_rc_path(target)), "w", encoding="utf-8") as f:
            f.write(f"# Generated by claude-primer — wizard answers\n")
            f.write(f"# Re-run with --reconfigure to update\n\n")
            cp.write(f)
    except OSError:
        pass


def apply_rc(info: dict, rc: dict) -> dict:
    """Merge saved RC config into scan result (RC wins for wizard fields)."""
    for key in ("description", "is_monorepo", "monorepo_tool", "with_ralph", "clean_root"):
        if key in rc and rc[key]:
            info[key] = rc[key]
    for key in ("stacks", "frameworks", "deploy"):
        if key in rc and rc[key]:
            info[key] = rc[key]
    if rc:
        info.setdefault("existing_content", {}).setdefault("sources", set()).add(RC_FILENAME)
        if info.get("stacks"):
            info["is_empty"] = False
    return info


def run(target: Path, dry_run: bool = False, force: bool = False,
        no_git_check: bool = False, with_readme: bool = False,
        with_ralph: bool = False, git_mode: str = "ask",
        interactive: bool = True, reconfigure: bool = False,
        force_all: bool = False, from_doc: Optional[str] = None,
        clean_root: bool = False, template_dir: Optional[str] = None,
        agents: Optional[list] = None, output_format: str = "markdown",
        plugin_dir: Optional[str] = None):

    target = target.resolve()

    # Handle missing target
    target_exists = target.exists()
    if not target_exists:
        if dry_run:
            # Dry-run + missing target: treat as empty project, no warning
            pass
        else:
            print(f"Creating directory: {target}")
            target.mkdir(parents=True, exist_ok=True)
            target_exists = True

    print(f"\n{'=' * 60}")
    print(f"  claude-primer v{__version__}")
    print(f"  Target: {target}")
    mode_label = "DRY RUN" if dry_run else "LIVE"
    if not interactive:
        mode_label += " (non-interactive)"
    print(f"  Mode:   {mode_label}")
    print(f"{'=' * 60}\n")

    # Build file list
    files_to_generate = list(DEFAULT_FILES)
    if with_readme:
        files_to_generate.append(("README.md", generate_readme_md))

    filenames = [f[0] for f in files_to_generate]

    # ── Scan FIRST — before git safety ──
    # Content must be read from the current working tree, not from
    # whatever is in the last commit. Stashing before scan would
    # cause generated files to be based on stale committed content.
    if target_exists:
        info = scan_directory(target)
    else:
        info = _empty_scan_result(target)

    # ── Load saved wizard config ──
    rc = load_rc(target) if target_exists and not reconfigure else {}
    if rc and not reconfigure:
        info = apply_rc(info, rc)
        print(f"  Config: loaded from {RC_FILENAME}")
        # Inherit with_ralph from RC if not explicitly set via CLI
        if not with_ralph and rc.get("with_ralph"):
            with_ralph = True

    # ── Propagate with_ralph to info for RC persistence ──
    if with_ralph:
        info["with_ralph"] = True

    # ── Propagate clean_root to info ──
    info["clean_root"] = clean_root
    # Inherit clean_root from RC if not explicitly set via CLI
    if not clean_root and rc.get("clean_root"):
        clean_root = True
        info["clean_root"] = True

    # ── Import from external document ──
    if from_doc:
        doc_path = Path(from_doc)
        if not doc_path.is_absolute():
            doc_path = target / doc_path
        doc_data = extract_from_document(doc_path)
        ec = info.get("existing_content", {})
        if not ec:
            ec = {"description": "", "architecture_notes": "", "commands": [], "sources": set()}
            info["existing_content"] = ec
        # Fill gaps: doc content doesn't overwrite existing
        if not ec.get("description") and doc_data["description"]:
            ec["description"] = doc_data["description"]
        if not ec.get("architecture_notes") and doc_data["architecture_notes"]:
            ec["architecture_notes"] = doc_data["architecture_notes"]
        if doc_data["commands"]:
            existing_cmds = set(ec.get("commands", []))
            for cmd in doc_data["commands"]:
                if cmd not in existing_cmds:
                    ec.setdefault("commands", []).append(cmd)
        if doc_data["sources"]:
            ec.setdefault("sources", set()).update(doc_data["sources"])
        # Also fill top-level description if empty
        if not info.get("description") and doc_data["description"]:
            info["description"] = doc_data["description"]
        print(f"  From-doc: {doc_path.name}")

    # ── Interactive wizard for empty projects ──
    needs_wizard = (info["is_empty"] and not info["stacks"]) or reconfigure
    if needs_wizard and interactive and not dry_run:
        info = run_wizard(info)
        # Save wizard answers for future runs
        if target_exists and info.get("stacks"):
            save_rc(target, info)
            print(f"  Config: saved to {RC_FILENAME}")
    elif needs_wizard and not interactive:
        print("  Project: EMPTY (use interactive mode for guided setup)\n")

    # ── Tier detection (after wizard so it sees wizard answers) ──
    info["tier"] = detect_project_tier(info)

    # ── Load user templates ──
    tpl_dir = Path(template_dir) if template_dir else target / ".claude-primer" / "templates"
    user_templates = load_templates(tpl_dir) if tpl_dir.is_dir() else {}
    if user_templates:
        info["_templates"] = user_templates
        info["_template_vars"] = _build_template_variables(info)
        print(f"  Templates: loaded from {tpl_dir}")

    ec = info.get("existing_content", {})

    # ── Compute write plan before any mutation ──
    write_plan = []
    generators = {fn: gen for fn, gen in files_to_generate}
    _content_cache = {}  # cache content generated during diff check
    for filename, generator in files_to_generate:
        # Determine actual path: clean_root moves aux docs to .claude/docs/
        if clean_root and filename not in ("CLAUDE.md", "README.md"):
            actual_path = target / ".claude" / "docs" / filename
        else:
            actual_path = target / filename
        exists = target_exists and actual_path.exists()
        if exists and not force and not force_all:
            write_plan.append(PlannedWrite(filename, exists, "skip", reason="exists", actual_path=actual_path))
        elif exists and (force or force_all):
            # --force: skip if content unchanged; --force-all: always overwrite
            if force and not force_all:
                new_content = generator(info)
                # Apply template overrides before diff check
                if user_templates:
                    new_content = merge_with_templates(new_content, user_templates, info.get("_template_vars", {}), filename)
                _content_cache[filename] = new_content
                old_content = actual_path.read_text(encoding="utf-8", errors="ignore")
                if new_content == old_content:
                    write_plan.append(PlannedWrite(filename, exists, "skip", reason="unchanged", actual_path=actual_path))
                else:
                    write_plan.append(PlannedWrite(filename, exists, "overwrite", actual_path=actual_path))
            else:
                write_plan.append(PlannedWrite(filename, exists, "overwrite", actual_path=actual_path))
        else:
            write_plan.append(PlannedWrite(filename, exists, "create", actual_path=actual_path))

    overwrite_targets = [pw.filename for pw in write_plan if pw.mode == "overwrite"]

    # ── Git safety — only when there are real overwrite targets ──
    result = RunResult()

    if not no_git_check and not dry_run and overwrite_targets:
        git_action = run_git_safety(target, git_mode, overwrite_targets, interactive)
        result.git_action = git_action
        if git_action == "aborted":
            return result
        print()
    else:
        result.git_action = "no-git" if no_git_check else "skipped"

    # ── Report ──
    if info["is_empty"]:
        print("  Project: EMPTY — creating template structure\n")
    elif info["file_count"] == 0 and info["stacks"]:
        # Wizard-configured: no files yet but user told us what they're building
        print(f"  Project: NEW (configured via wizard)")
        print(f"  Stacks: {', '.join(info['stacks'])}")
        if info["frameworks"]:
            print(f"  Frameworks: {', '.join(info['frameworks'])}")
        tier = info["tier"]
        print(f"  Suggested tier: T{tier['tier']} ({tier['confidence']} confidence)")
        if info["deploy"]:
            print(f"  Deploy: {', '.join(info['deploy'])}")
        if info["is_monorepo"]:
            print(f"  Monorepo: {info['monorepo_tool'] or 'yes'}")
        print()
    else:
        print(f"  Project: EXISTING ({info['file_count']} files)")
        print(f"  Stacks: {', '.join(info['stacks']) or 'none'}")
        print(f"  Frameworks: {', '.join(info['frameworks']) or 'none'}")
        tier = info["tier"]
        print(f"  Suggested tier: T{tier['tier']} ({tier['confidence']} confidence)")
        if info["deploy"]:
            print(f"  Deploy: {', '.join(info['deploy'])}")
        if info["is_monorepo"]:
            print(f"  Monorepo: {info['monorepo_tool']} ({', '.join(info['workspace_dirs']) or 'no workspace dirs'})")
        if info["existing_docs"]:
            print(f"  Docs: {', '.join(info['existing_docs'])}")
        if info["sub_projects"]:
            print(f"  Sub-projects: {', '.join(info['sub_projects'][:10])}")
            if len(info["sub_projects"]) > 10:
                print(f"    ... and {len(info['sub_projects']) - 10} more")

        sources = ec.get("sources", set())
        if sources:
            print(f"  Extracted from: {', '.join(sorted(sources))}")
        print()

    # ── Generate — driven by write plan ──
    # Cache content that was already generated during write plan diff check
    _content_cache = {}

    # Create .claude/docs/ directory if needed for clean_root
    if clean_root and not dry_run:
        docs_dir = target / ".claude" / "docs"
        docs_dir.mkdir(parents=True, exist_ok=True)

    for pw in write_plan:
        if pw.mode == "skip":
            result.actions.append(FileAction(pw.filename, "skip", reason=pw.reason))
            continue

        # Reuse cached content from diff check, or generate fresh
        if pw.filename in _content_cache:
            content = _content_cache[pw.filename]
        else:
            content = generators[pw.filename](info)
        # Apply user template overrides
        if user_templates:
            content = merge_with_templates(content, user_templates, info.get("_template_vars", {}), pw.filename)
        line_count = content.count("\n")

        # Use actual_path (respects clean_root placement)
        write_path = pw.actual_path if pw.actual_path else target / pw.filename
        if not dry_run:
            write_path.parent.mkdir(parents=True, exist_ok=True)
            write_path.write_text(content, encoding="utf-8")

        result.actions.append(FileAction(pw.filename, pw.mode, lines=line_count))

    # ── Post-generation verification ──
    if not dry_run and result.created_count > 0:
        errors = _verify_generated(target, [a for a in result.actions if a.action in ("create", "overwrite")], clean_root=clean_root)
        if errors:
            print(f"\n  ⚠ Verification issues:")
            for err in errors:
                print(f"    - {err}")

    # ── Ralph integration (opt-in) ──
    if with_ralph:
        ralph_actions = setup_ralph(target, info, dry_run=dry_run, force=force)
        result.actions.extend(ralph_actions)

    # ── Multi-agent output ──
    if agents:
        agent_actions = write_agent_files(target, info, agents, fmt=output_format, dry_run=dry_run)
        result.actions.extend(agent_actions)

    # ── Plugin extensions ──
    plugin_dir_path = Path(plugin_dir) if plugin_dir else target / ".claude-primer" / "plugins"
    plugins = load_plugins(plugin_dir_path)
    if plugins:
        print(f"  Plugins: {len(plugins)} loaded from {plugin_dir_path}")
        plugin_actions = run_plugins(target, info, plugins, dry_run=dry_run)
        result.actions.extend(plugin_actions)

    # Memory directory
    mem = target / ".claude" / "projects"
    if not dry_run and target_exists and not mem.exists():
        mem.mkdir(parents=True, exist_ok=True)
        result.actions.append(FileAction(".claude/projects/", "create"))
    elif dry_run and (not target_exists or not mem.exists()):
        result.actions.append(FileAction(".claude/projects/", "create"))

    # ── Output ──
    print("─" * 50)
    for a in result.actions:
        label = a.action.upper()
        if dry_run and a.action != "skip":
            label += " [DRY RUN]"
        extra = f" ({a.lines} lines)" if a.lines else ""
        reason = f" — {a.reason}" if a.reason else ""
        print(f"  {label:<20s} {a.filename}{extra}{reason}")
    print("─" * 50)

    print(f"\n  Created: {result.created_count}  Skipped: {result.skipped_count}")

    if result.skipped_count and not force:
        print(f"\n  Tip: Use --force to overwrite existing files")

    if "README.md" not in filenames:
        print(f"  Note: README.md not included (use --with-readme to generate)")

    if clean_root:
        print(f"  Note: .claude/ may be in .gitignore. Ensure .claude/docs/ is tracked if needed.")

    if not dry_run and result.created_count > 0:
        print(f"\n  Next steps:")
        print(f"  1. Review generated files — sections containing 'placeholder' need input")
        print(f"  2. Sections containing 'migrated' came from existing files — verify accuracy")
        print(f"  3. Sections containing 'inferred' were detected — may need correction")

        if with_ralph:
            print(f"\n  Ralph integration:")
            print(f"  4. Edit .ralph/fix_plan.md with your tasks")
            print(f"  5. Review .ralphrc tool permissions")
            print(f"  6. Start: ralph --monitor")

        if info["has_git"]:
            gen_files = [a.filename for a in result.actions
                         if a.action in ("create", "overwrite") and "/" not in a.filename]
            if gen_files:
                print(f"\n  Git tip:")
                print(f"    git add {' '.join(gen_files)}")
                print(f"    git commit -m 'docs: bootstrap Claude Code knowledge architecture'")

            if result.git_action == "stash":
                print(f"\n  Don't forget: your previous changes are stashed.")
                print(f"    git stash pop   # restore stashed changes")

    print()
    return result


# ─────────────────────────────────────────────
# Multi-agent context output
# ─────────────────────────────────────────────

AGENT_CONVENTIONS = {
    "claude": {"file": "CLAUDE.md", "dir": None},
    "cursor": {"file": ".cursor/rules/project.mdc", "dir": ".cursor/rules"},
    "copilot": {"file": ".github/copilot-instructions.md", "dir": ".github"},
    "windsurf": {"file": ".windsurfrules", "dir": None},
    "aider": {"file": ".aider/conventions.md", "dir": ".aider"},
    "codex": {"file": "AGENTS.md", "dir": None},
}


def _agent_core_context(info: dict) -> dict:
    """Extract core context shared by all agent formats."""
    ec = info.get("existing_content", {})
    tier = info.get("tier", {})
    return {
        "project_name": info.get("name", ""),
        "description": info.get("description", "") or ec.get("description", ""),
        "stacks": info.get("stacks", []),
        "frameworks": info.get("frameworks", []),
        "deploy": info.get("deploy", []),
        "tier": f"T{tier.get('tier', 3)}",
        "commands": ec.get("commands", []),
        "architecture": ec.get("architecture_notes", ""),
        "env_notes": ec.get("env_notes", ""),
        "formatting_rules": ec.get("formatting_rules", []),
        "test_dirs": info.get("test_dirs", []),
        "sub_projects": info.get("sub_projects", []),
        "is_monorepo": info.get("is_monorepo", False),
    }


def _generate_cursor_rules(info: dict) -> str:
    """Generate .cursor/rules/project.mdc (Cursor rules format with frontmatter)."""
    ctx = _agent_core_context(info)
    lines = [
        "---",
        f"description: Project context for {ctx['project_name']}",
        'globs: ["**/*"]',
        "alwaysApply: true",
        "---",
        "",
        f"# {ctx['project_name']}",
        "",
    ]
    if ctx["description"]:
        lines.extend([ctx["description"], ""])
    lines.extend([
        "## Tech Stack",
        "",
        f"- **Languages:** {', '.join(ctx['stacks']) or 'not detected'}",
        f"- **Frameworks:** {', '.join(ctx['frameworks']) or 'none'}",
    ])
    if ctx["deploy"]:
        lines.append(f"- **Deploy:** {', '.join(ctx['deploy'])}")
    lines.append("")
    if ctx["commands"]:
        lines.extend(["## Commands", "", "```bash"])
        for cmd in ctx["commands"][:15]:
            lines.append(cmd)
        lines.extend(["```", ""])
    if ctx["architecture"]:
        lines.extend(["## Architecture", "", ctx["architecture"][:2000], ""])
    if ctx["formatting_rules"]:
        lines.extend(["## Code Style", ""])
        for rule in ctx["formatting_rules"][:10]:
            lines.append(f"- {rule}")
        lines.append("")
    return "\n".join(lines) + "\n"


def _generate_copilot_instructions(info: dict) -> str:
    """Generate .github/copilot-instructions.md."""
    ctx = _agent_core_context(info)
    lines = [
        f"# {ctx['project_name']} — Copilot Instructions",
        "",
    ]
    if ctx["description"]:
        lines.extend([ctx["description"], ""])
    lines.extend([
        "## Project Overview",
        "",
        f"- **Stack:** {', '.join(ctx['stacks']) or 'not detected'}",
        f"- **Frameworks:** {', '.join(ctx['frameworks']) or 'none'}",
        f"- **Tier:** {ctx['tier']}",
        "",
    ])
    if ctx["commands"]:
        lines.extend(["## Common Commands", "", "```bash"])
        for cmd in ctx["commands"][:15]:
            lines.append(cmd)
        lines.extend(["```", ""])
    if ctx["architecture"]:
        lines.extend(["## Architecture", "", ctx["architecture"][:2000], ""])
    if ctx["formatting_rules"]:
        lines.extend(["## Coding Conventions", ""])
        for rule in ctx["formatting_rules"][:10]:
            lines.append(f"- {rule}")
        lines.append("")
    return "\n".join(lines) + "\n"


def _generate_windsurf_rules(info: dict) -> str:
    """Generate .windsurfrules."""
    ctx = _agent_core_context(info)
    lines = [
        f"# {ctx['project_name']} Rules",
        "",
    ]
    if ctx["description"]:
        lines.extend([ctx["description"], ""])
    lines.extend([
        f"Stack: {', '.join(ctx['stacks']) or 'not detected'}",
        f"Frameworks: {', '.join(ctx['frameworks']) or 'none'}",
        "",
    ])
    if ctx["commands"]:
        lines.extend(["## Commands", "", "```bash"])
        for cmd in ctx["commands"][:15]:
            lines.append(cmd)
        lines.extend(["```", ""])
    if ctx["architecture"]:
        lines.extend(["## Architecture", "", ctx["architecture"][:2000], ""])
    if ctx["formatting_rules"]:
        lines.extend(["## Style", ""])
        for rule in ctx["formatting_rules"][:10]:
            lines.append(f"- {rule}")
        lines.append("")
    return "\n".join(lines) + "\n"


def _generate_aider_conventions(info: dict) -> str:
    """Generate .aider/conventions.md."""
    ctx = _agent_core_context(info)
    lines = [
        f"# Conventions for {ctx['project_name']}",
        "",
        f"**Stack:** {', '.join(ctx['stacks']) or 'not detected'}",
        f"**Frameworks:** {', '.join(ctx['frameworks']) or 'none'}",
        "",
    ]
    if ctx["test_dirs"]:
        lines.extend(["## Test Directories", ""])
        for td in ctx["test_dirs"][:10]:
            lines.append(f"- `{td}/`")
        lines.append("")
    if ctx["commands"]:
        lines.extend(["## Key Commands", "", "```bash"])
        for cmd in ctx["commands"][:15]:
            lines.append(cmd)
        lines.extend(["```", ""])
    if ctx["formatting_rules"]:
        lines.extend(["## Formatting", ""])
        for rule in ctx["formatting_rules"][:10]:
            lines.append(f"- {rule}")
        lines.append("")
    if ctx["architecture"]:
        lines.extend(["## Architecture Notes", "", ctx["architecture"][:2000], ""])
    return "\n".join(lines) + "\n"


def _generate_codex_agents(info: dict) -> str:
    """Generate AGENTS.md (OpenAI Codex format)."""
    ctx = _agent_core_context(info)
    lines = [
        f"# AGENTS.md",
        "",
        f"## {ctx['project_name']}",
        "",
    ]
    if ctx["description"]:
        lines.extend([ctx["description"], ""])
    lines.extend([
        "## Workspace",
        "",
        f"- **Languages:** {', '.join(ctx['stacks']) or 'not detected'}",
        f"- **Frameworks:** {', '.join(ctx['frameworks']) or 'none'}",
    ])
    if ctx["is_monorepo"]:
        lines.append(f"- **Monorepo:** yes")
        if ctx["sub_projects"]:
            lines.append(f"- **Sub-projects:** {', '.join(ctx['sub_projects'][:10])}")
    lines.append("")
    if ctx["commands"]:
        lines.extend(["## Setup & Commands", "", "```bash"])
        for cmd in ctx["commands"][:15]:
            lines.append(cmd)
        lines.extend(["```", ""])
    if ctx["architecture"]:
        lines.extend(["## Architecture", "", ctx["architecture"][:2000], ""])
    return "\n".join(lines) + "\n"


_AGENT_GENERATORS = {
    "cursor": _generate_cursor_rules,
    "copilot": _generate_copilot_instructions,
    "windsurf": _generate_windsurf_rules,
    "aider": _generate_aider_conventions,
    "codex": _generate_codex_agents,
}


def _format_as_yaml(data: dict, indent: int = 0) -> str:
    """Minimal YAML serializer for context data (stdlib only)."""
    lines = []
    prefix = "  " * indent
    for key, val in data.items():
        if isinstance(val, list):
            if not val:
                lines.append(f"{prefix}{key}: []")
            else:
                lines.append(f"{prefix}{key}:")
                for item in val:
                    if isinstance(item, dict):
                        lines.append(f"{prefix}  -")
                        for k2, v2 in item.items():
                            lines.append(f"{prefix}    {k2}: {v2}")
                    else:
                        lines.append(f"{prefix}  - {item}")
        elif isinstance(val, dict):
            lines.append(f"{prefix}{key}:")
            lines.append(_format_as_yaml(val, indent + 1))
        elif isinstance(val, bool):
            lines.append(f"{prefix}{key}: {'true' if val else 'false'}")
        else:
            # Quote strings that contain special chars
            sv = str(val)
            if any(c in sv for c in (":", "#", "\n", '"')):
                sv = '"' + sv.replace('"', '\\"').replace("\n", "\\n") + '"'
            lines.append(f"{prefix}{key}: {sv}")
    return "\n".join(lines)


def write_agent_files(target: Path, info: dict, agents: list, fmt: str = "markdown",
                      dry_run: bool = False) -> list:
    """Generate context files for specified AI agents."""
    actions = []
    ctx = _agent_core_context(info)

    for agent in agents:
        if agent == "claude":
            continue  # Claude files handled by the main pipeline

        conv = AGENT_CONVENTIONS.get(agent)
        if not conv:
            continue

        # Generate content
        generator = _AGENT_GENERATORS.get(agent)
        if not generator:
            continue

        if fmt == "markdown":
            content = generator(info)
            filepath = target / conv["file"]
        elif fmt == "json":
            content = json.dumps(ctx, indent=2, default=str) + "\n"
            filepath = target / f".claude-primer-{agent}.json"
        elif fmt == "yaml":
            content = _format_as_yaml(ctx) + "\n"
            filepath = target / f".claude-primer-{agent}.yaml"
        else:
            continue

        exists = filepath.exists()
        if not dry_run:
            filepath.parent.mkdir(parents=True, exist_ok=True)
            filepath.write_text(content, encoding="utf-8")

        action_type = "overwrite" if exists else "create"
        actions.append(FileAction(str(filepath.relative_to(target)), action_type, lines=content.count("\n")))

    return actions


# ─────────────────────────────────────────────
# Watch mode
# ─────────────────────────────────────────────

# Config files to watch for changes
_WATCH_FILES = [
    "package.json", "pyproject.toml", "Cargo.toml", "go.mod", "mix.exs",
    "pubspec.yaml", "composer.json", "build.gradle", "pom.xml", "build.sbt",
    "Makefile", "Dockerfile", "docker-compose.yml", "docker-compose.yaml",
    "README.md", "CLAUDE.md", "STANDARDS.md", ".env", ".env.example",
    "requirements.txt", "Pipfile", "setup.py", "setup.cfg",
]


def _get_watch_targets(root: Path) -> dict:
    """Return {filepath: mtime} for all watchable files."""
    mtimes = {}
    for f in _WATCH_FILES:
        fp = root / f
        try:
            if fp.exists():
                mtimes[f] = fp.stat().st_mtime
        except OSError:
            pass
    # Also check .github/workflows/
    wf_dir = root / ".github" / "workflows"
    if wf_dir.is_dir():
        try:
            for item in wf_dir.iterdir():
                if item.is_file() and item.suffix in (".yml", ".yaml"):
                    rel = f".github/workflows/{item.name}"
                    mtimes[rel] = item.stat().st_mtime
        except OSError:
            pass
    return mtimes


def _diff_scan_results(old: dict, new: dict) -> list:
    """Compare two scan results and return human-readable diff lines."""
    diffs = []
    old_stacks = set(old.get("stacks", []))
    new_stacks = set(new.get("stacks", []))
    for s in new_stacks - old_stacks:
        diffs.append(f"Stack added: {s}")
    for s in old_stacks - new_stacks:
        diffs.append(f"Stack removed: {s}")
    old_fws = set(old.get("frameworks", []))
    new_fws = set(new.get("frameworks", []))
    for f in new_fws - old_fws:
        diffs.append(f"Framework added: {f}")
    for f in old_fws - new_fws:
        diffs.append(f"Framework removed: {f}")
    old_subs = set(old.get("sub_projects", []))
    new_subs = set(new.get("sub_projects", []))
    for s in new_subs - old_subs:
        diffs.append(f"Sub-project added: {s}")
    old_fc = old.get("file_count", 0)
    new_fc = new.get("file_count", 0)
    if abs(new_fc - old_fc) > 5:
        diffs.append(f"File count: {old_fc} -> {new_fc}")
    return diffs


def run_watch(target: Path, interval: int = 5, auto: bool = False, **run_kwargs):
    """Poll-based watch mode. Re-scans on config file changes."""
    import time as _time

    target = target.resolve()
    print(f"\n  Watching {target} (interval: {interval}s, auto-update: {auto})")
    print(f"  Press Ctrl+C to stop.\n")

    mtimes = _get_watch_targets(target)
    last_scan = scan_directory(target)

    try:
        while True:
            _time.sleep(interval)
            new_mtimes = _get_watch_targets(target)
            changed = {k for k in new_mtimes if new_mtimes.get(k) != mtimes.get(k)}
            new_files = set(new_mtimes) - set(mtimes)
            removed_files = set(mtimes) - set(new_mtimes)

            if changed or new_files or removed_files:
                ts = datetime.datetime.now().strftime("%H:%M:%S")
                print(f"  [{ts}] Changes detected:")
                for f in sorted(changed):
                    print(f"    Modified: {f}")
                for f in sorted(new_files):
                    print(f"    Added: {f}")
                for f in sorted(removed_files):
                    print(f"    Removed: {f}")

                new_scan = scan_directory(target)
                diffs = _diff_scan_results(last_scan, new_scan)
                if diffs:
                    print(f"  Impact:")
                    for d in diffs:
                        print(f"    {d}")

                if auto:
                    print(f"  Auto-regenerating...")
                    run(target, **run_kwargs)
                else:
                    print(f"  Run 'claude-primer --force' to regenerate.\n")

                mtimes = new_mtimes
                last_scan = new_scan
    except KeyboardInterrupt:
        print(f"\n  Watch stopped.")


def plan_json(target: Path, with_readme: bool = False) -> dict:
    """Compute full project analysis without writing files. Returns JSON-serializable dict."""
    target = target.resolve()

    files_to_generate = list(DEFAULT_FILES)
    if with_readme:
        files_to_generate.append(("README.md", generate_readme_md))

    if target.exists():
        info = scan_directory(target)
    else:
        info = _empty_scan_result(target)

    info["tier"] = detect_project_tier(info)

    # Compute write plan
    write_plan = []
    for filename, _ in files_to_generate:
        exists = target.exists() and (target / filename).exists()
        write_plan.append({
            "filename": filename,
            "exists": exists,
            "mode": "skip" if exists else "create",
        })

    # Git status
    git_info = git_check(target) if target.exists() else {
        "is_git": False, "dirty": False, "branch": "",
    }
    git_recommendation = "skip"
    if git_info.get("is_git"):
        any_overwrite = any(wp["exists"] for wp in write_plan)
        if git_info.get("dirty") and any_overwrite:
            git_recommendation = "stash"
        elif any_overwrite:
            git_recommendation = "safe"
        else:
            git_recommendation = "skip"

    # Build output — only JSON-serializable types
    ec = info.get("existing_content", {})
    sources = list(ec.get("sources", set()))

    # Serialize confidence scores
    raw_scores = info.get("confidence_scores", {})
    confidence_scores = {}
    for k, v in raw_scores.items():
        if isinstance(v, list):
            confidence_scores[k] = [sv.as_dict() for sv in v if isinstance(sv, ScoredValue)]
        elif isinstance(v, ScoredValue):
            confidence_scores[k] = v.as_dict()

    return {
        "target": str(target),
        "name": info["name"],
        "stacks": info["stacks"],
        "frameworks": info["frameworks"],
        "deploy": info.get("deploy", []),
        "is_monorepo": info.get("is_monorepo", False),
        "monorepo_tool": info.get("monorepo_tool", ""),
        "workspace_dirs": info.get("workspace_dirs", []),
        "tier": info["tier"],
        "file_count": info.get("file_count", 0),
        "has_git": info.get("has_git", False),
        "existing_docs": info.get("existing_docs", []),
        "sub_projects": info.get("sub_projects", []),
        "sub_project_details": info.get("sub_project_details", []),
        "extracted_from": sources,
        "write_plan": write_plan,
        "confidence_scores": confidence_scores,
        "git": {
            "is_git": git_info.get("is_git", False),
            "dirty": git_info.get("dirty", False),
            "branch": git_info.get("branch", ""),
            "recommendation": git_recommendation,
        },
    }


def main():
    # Ensure UTF-8 output on Windows (cp1252 can't encode box-drawing chars)
    import sys
    if sys.stdout.encoding and sys.stdout.encoding.lower().replace("-", "") != "utf8":
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

    import time as _time

    parser = argparse.ArgumentParser(
        description="Bootstrap Claude Code Knowledge Architecture in a project directory.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  claude-primer                       # interactive setup
  claude-primer /path/to/repo         # specific directory
  claude-primer --dry-run             # preview
  claude-primer --force --yes         # overwrite changed files, no prompts
  claude-primer --force-all --yes     # overwrite ALL files, no prompts
  claude-primer --with-readme         # also generate README.md
  claude-primer --with-ralph          # generate Ralph integration files
  claude-primer --reconfigure         # re-run wizard (ignore saved config)
  claude-primer --git-mode stash      # auto-stash, no prompt
  claude-primer --git-mode skip --yes # full automation
  claude-primer --plan-json           # output project analysis as JSON
        """,
    )
    parser.add_argument("target", nargs="?", default=".", help="Target directory (default: current)")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing")
    parser.add_argument("--force", action="store_true", help="Overwrite existing files")
    parser.add_argument("--yes", "-y", action="store_true", help="Accept defaults, no interactive prompts")
    parser.add_argument("--with-readme", action="store_true", help="Include README.md in generated files")
    parser.add_argument("--with-ralph", action="store_true",
                        help="Generate Ralph integration files (.ralph/, .ralphrc)")
    parser.add_argument("--no-git-check", action="store_true", help="Skip git safety entirely")
    parser.add_argument("--git-mode", choices=["ask", "stash", "skip"], default="ask",
                        help="Git safety mode: ask (interactive), stash (auto), skip (none)")
    parser.add_argument("--plan-json", action="store_true",
                        help="Output project analysis as JSON without writing files")
    parser.add_argument("--reconfigure", action="store_true",
                        help="Re-run wizard even if .claude-setup.rc exists")
    parser.add_argument("--force-all", action="store_true",
                        help="Overwrite all files unconditionally (--force skips unchanged)")
    parser.add_argument("--from-doc", type=str, default=None,
                        help="Bootstrap from an existing document (PRD, spec, RFC, etc.)")
    parser.add_argument("--clean-root", action="store_true",
                        help="Move auxiliary docs to .claude/docs/, keep only CLAUDE.md and README.md at root")
    parser.add_argument("--template-dir", type=str, default=None,
                        help="Directory containing template overrides (default: .claude-primer/templates/)")
    parser.add_argument("--watch", action="store_true",
                        help="Watch for changes and suggest updates (poll-based)")
    parser.add_argument("--watch-interval", type=int, default=5,
                        help="Polling interval in seconds for watch mode (default: 5)")
    parser.add_argument("--watch-auto", action="store_true",
                        help="Auto-regenerate files when changes detected in watch mode")
    parser.add_argument("--agent", type=str, default=None,
                        help="Target agent(s): claude, cursor, copilot, windsurf, aider, codex, all (comma-separated)")
    parser.add_argument("--format", type=str, default="markdown", choices=["markdown", "yaml", "json"],
                        help="Output format for agent context files (default: markdown)")
    parser.add_argument("--plugin-dir", type=str, default=None,
                        help="Directory containing plugin generators (default: .claude-primer/plugins/)")
    parser.add_argument("--telemetry-off", action="store_true",
                        help="Disable telemetry even if CLAUDE_PRIMER_TELEMETRY=1 is set")

    args = parser.parse_args()

    _t0 = _time.monotonic()

    if args.plan_json:
        result = plan_json(Path(args.target), with_readme=args.with_readme)
        print(json.dumps(result, indent=2))
        _send_telemetry_if_enabled(args, result, _time.monotonic() - _t0)
        return

    # Parse agent list
    agents = None
    if args.agent:
        if args.agent == "all":
            agents = list(AGENT_CONVENTIONS.keys())
        else:
            agents = [a.strip() for a in args.agent.split(",")]
            for a in agents:
                if a not in AGENT_CONVENTIONS:
                    parser.error(f"Unknown agent: {a}. Valid: {', '.join(AGENT_CONVENTIONS.keys())}, all")

    # Watch mode
    if args.watch:
        run_watch(
            Path(args.target),
            interval=args.watch_interval,
            auto=args.watch_auto,
            dry_run=args.dry_run,
            force=True,
            no_git_check=True,
            with_readme=args.with_readme,
            with_ralph=args.with_ralph,
            git_mode="skip",
            interactive=False,
            force_all=args.force_all,
            clean_root=args.clean_root,
            template_dir=args.template_dir,
            agents=agents,
            output_format=args.format,
            plugin_dir=args.plugin_dir,
        )
        return

    interactive = not args.yes
    git_mode = args.git_mode
    if args.no_git_check:
        git_mode = "skip"
    elif args.yes and git_mode == "ask":
        git_mode = "stash"  # --yes with default git-mode → auto-stash

    # --force-all implies --force
    force = args.force or args.force_all

    run(
        Path(args.target),
        dry_run=args.dry_run,
        force=force,
        no_git_check=args.no_git_check,
        with_readme=args.with_readme,
        with_ralph=args.with_ralph,
        git_mode=git_mode,
        interactive=interactive,
        reconfigure=args.reconfigure,
        force_all=args.force_all,
        from_doc=args.from_doc,
        clean_root=args.clean_root,
        template_dir=args.template_dir,
        agents=agents,
        output_format=args.format,
        plugin_dir=args.plugin_dir,
    )

    _telemetry_info = scan_directory(Path(args.target).resolve()) if Path(args.target).exists() else {}
    _send_telemetry_if_enabled(args, _telemetry_info, _time.monotonic() - _t0)


def _collect_telemetry(args, info: dict, duration_s: float) -> dict:
    """Collect anonymous telemetry payload. No PII, no project content."""
    flags = []
    for flag in ["dry_run", "force", "force_all", "with_readme", "with_ralph",
                  "no_git_check", "plan_json", "reconfigure", "clean_root",
                  "watch", "watch_auto"]:
        if getattr(args, flag, False):
            flags.append(flag.replace("_", "-"))
    if getattr(args, "agent", None):
        flags.append(f"agent={args.agent}")
    if getattr(args, "format", "markdown") != "markdown":
        flags.append(f"format={args.format}")
    if getattr(args, "template_dir", None):
        flags.append("template-dir")
    if getattr(args, "plugin_dir", None):
        flags.append("plugin-dir")

    return {
        "v": 1,
        "tool_version": __version__,
        "command": "plan-json" if getattr(args, "plan_json", False)
                   else ("watch" if getattr(args, "watch", False) else "run"),
        "flags": flags,
        "stacks": info.get("stacks", []),
        "frameworks": info.get("frameworks", []),
        "tier": info.get("tier", {}).get("tier") if isinstance(info.get("tier"), dict) else None,
        "is_monorepo": info.get("is_monorepo", False),
        "file_count": info.get("file_count", 0),
        "duration_s": round(duration_s, 2),
        "platform": sys.platform,
    }


def _send_telemetry_if_enabled(args, info: dict, duration_s: float):
    """Send telemetry if opt-in env var is set and --telemetry-off is not used."""
    if os.environ.get("CLAUDE_PRIMER_TELEMETRY") != "1":
        return
    if getattr(args, "telemetry_off", False):
        return

    import threading
    import urllib.request

    payload = _collect_telemetry(args, info, duration_s)
    url = os.environ.get("CLAUDE_PRIMER_TELEMETRY_URL",
                         "https://telemetry.claude-primer.dev/v1/events")

    def _post():
        try:
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(url, data=data,
                headers={"Content-Type": "application/json"}, method="POST")
            urllib.request.urlopen(req, timeout=5)
        except Exception:
            pass  # best-effort

    t = threading.Thread(target=_post, daemon=True)
    t.start()


if __name__ == "__main__":
    main()
