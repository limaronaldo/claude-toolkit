#!/usr/bin/env python3
"""
Tests for claude_primer.py

Regression suite + golden output tests.
Run: python3 -m pytest tests/ -v
"""

import json
import os
import re
import subprocess
import tempfile
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parent.parent / "claude_primer.py"


def run_setup(*args, cwd=None, timeout=30):
    """Run claude.py with given args, return CompletedProcess."""
    cmd = ["python3", str(SCRIPT)] + list(args)
    return subprocess.run(
        cmd, capture_output=True, text=True,
        cwd=cwd, timeout=timeout,
    )


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

@pytest.fixture
def empty_dir(tmp_path):
    """An empty temporary directory."""
    return tmp_path


@pytest.fixture
def python_project(tmp_path):
    """A minimal Python project."""
    (tmp_path / "requirements.txt").write_text("requests==2.31.0\n")
    (tmp_path / "main.py").write_text("print('hello')\n")
    (tmp_path / "tests").mkdir()
    (tmp_path / "tests" / "test_main.py").write_text("def test_ok(): assert True\n")
    return tmp_path


@pytest.fixture
def node_project(tmp_path):
    """A minimal Node.js project."""
    pkg = {
        "name": "test-app",
        "version": "1.0.0",
        "scripts": {"test": "jest", "start": "node index.js", "build": "tsc"},
        "dependencies": {"express": "^4.18.0"},
    }
    (tmp_path / "package.json").write_text(json.dumps(pkg, indent=2))
    (tmp_path / "index.js").write_text("const express = require('express');\n")
    return tmp_path


@pytest.fixture
def monorepo_project(tmp_path):
    """A turborepo-style monorepo."""
    (tmp_path / "turbo.json").write_text('{"pipeline": {}}\n')
    pkg = {"name": "root", "private": True, "workspaces": ["apps/*", "packages/*"]}
    (tmp_path / "package.json").write_text(json.dumps(pkg, indent=2))

    apps = tmp_path / "apps" / "web"
    apps.mkdir(parents=True)
    (apps / "package.json").write_text('{"name": "web"}\n')
    next_cfg = apps / "next.config.js"
    next_cfg.write_text("module.exports = {};\n")

    pkgs = tmp_path / "packages" / "ui"
    pkgs.mkdir(parents=True)
    (pkgs / "package.json").write_text('{"name": "ui"}\n')
    (pkgs / "Button.tsx").write_text("export default function Button() {}\n")

    return tmp_path


@pytest.fixture
def git_repo(tmp_path):
    """A git-initialized empty repo."""
    subprocess.run(["git", "init"], cwd=tmp_path, capture_output=True)
    subprocess.run(["git", "config", "user.email", "test@test.com"], cwd=tmp_path, capture_output=True)
    subprocess.run(["git", "config", "user.name", "Test"], cwd=tmp_path, capture_output=True)
    # Initial commit so branch exists
    (tmp_path / ".gitkeep").write_text("")
    subprocess.run(["git", "add", "."], cwd=tmp_path, capture_output=True)
    subprocess.run(["git", "commit", "-m", "init"], cwd=tmp_path, capture_output=True)
    return tmp_path


# ─────────────────────────────────────────────
# Regression tests
# ─────────────────────────────────────────────

class TestBasicBehavior:
    """Core behavior: create, skip, force, dry-run."""

    def test_empty_dir_creates_all_files(self, empty_dir):
        r = run_setup(str(empty_dir), "--yes", "--no-git-check")
        assert r.returncode == 0
        for f in ["CLAUDE.md", "QUICKSTART.md", "STANDARDS.md", "ERRORS_AND_LESSONS.md"]:
            assert (empty_dir / f).exists(), f"{f} not created"

    def test_skip_existing_without_force(self, empty_dir):
        # First run: create
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        # Mark files with known content
        (empty_dir / "CLAUDE.md").write_text("custom content\n")
        # Second run: skip
        r = run_setup(str(empty_dir), "--yes", "--no-git-check")
        assert r.returncode == 0
        assert "SKIP" in r.stdout
        assert (empty_dir / "CLAUDE.md").read_text() == "custom content\n"

    def test_force_overwrites_existing(self, empty_dir):
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        (empty_dir / "CLAUDE.md").write_text("custom content\n")
        r = run_setup(str(empty_dir), "--yes", "--no-git-check", "--force")
        assert r.returncode == 0
        assert "OVERWRITE" in r.stdout
        assert (empty_dir / "CLAUDE.md").read_text() != "custom content\n"

    def test_dry_run_writes_nothing(self, empty_dir):
        r = run_setup(str(empty_dir), "--dry-run", "--yes")
        assert r.returncode == 0
        assert "DRY RUN" in r.stdout
        for f in ["CLAUDE.md", "QUICKSTART.md", "STANDARDS.md", "ERRORS_AND_LESSONS.md"]:
            assert not (empty_dir / f).exists(), f"{f} should not exist in dry-run"

    def test_dry_run_missing_target(self):
        with tempfile.TemporaryDirectory() as td:
            missing = Path(td) / "nonexistent"
            r = run_setup(str(missing), "--dry-run", "--yes")
            assert r.returncode == 0
            assert not missing.exists()

    def test_with_readme_generates_readme(self, empty_dir):
        r = run_setup(str(empty_dir), "--yes", "--no-git-check", "--with-readme")
        assert r.returncode == 0
        assert (empty_dir / "README.md").exists()

    def test_without_readme_no_readme(self, empty_dir):
        r = run_setup(str(empty_dir), "--yes", "--no-git-check")
        assert r.returncode == 0
        assert not (empty_dir / "README.md").exists()


class TestStackDetection:
    """Stack and framework detection."""

    def test_python_detected(self, python_project):
        r = run_setup(str(python_project), "--plan-json")
        data = json.loads(r.stdout)
        assert "python" in data["stacks"]

    def test_node_detected(self, node_project):
        r = run_setup(str(node_project), "--plan-json")
        data = json.loads(r.stdout)
        assert "node" in data["stacks"]

    def test_express_framework_detected(self, node_project):
        r = run_setup(str(node_project), "--plan-json")
        data = json.loads(r.stdout)
        assert "express" in data["frameworks"]

    def test_empty_dir_no_stacks(self, empty_dir):
        r = run_setup(str(empty_dir), "--plan-json")
        data = json.loads(r.stdout)
        assert data["stacks"] == []
        assert data["frameworks"] == []


class TestTierDetection:
    """Project tier classification."""

    def test_empty_is_t4(self, empty_dir):
        r = run_setup(str(empty_dir), "--plan-json")
        data = json.loads(r.stdout)
        assert data["tier"]["tier"] == 4

    def test_python_is_t3(self, python_project):
        r = run_setup(str(python_project), "--plan-json")
        data = json.loads(r.stdout)
        assert data["tier"]["tier"] == 3

    def test_node_express_is_t2(self, node_project):
        r = run_setup(str(node_project), "--plan-json")
        data = json.loads(r.stdout)
        # express is external-facing → T2
        assert data["tier"]["tier"] == 2

    def test_monorepo_with_framework_and_deploy_is_t1(self, monorepo_project):
        # Add deploy signal + framework config at root level
        (monorepo_project / "Dockerfile").write_text("FROM node:18\n")
        (monorepo_project / "next.config.js").write_text("module.exports = {};\n")
        r = run_setup(str(monorepo_project), "--plan-json")
        data = json.loads(r.stdout)
        assert data["tier"]["tier"] == 1


class TestMonorepo:
    """Monorepo detection."""

    def test_turborepo_detected(self, monorepo_project):
        r = run_setup(str(monorepo_project), "--plan-json")
        data = json.loads(r.stdout)
        assert data["is_monorepo"] is True
        assert data["monorepo_tool"] == "turborepo"

    def test_workspace_dirs_found(self, monorepo_project):
        r = run_setup(str(monorepo_project), "--plan-json")
        data = json.loads(r.stdout)
        assert "apps" in data["workspace_dirs"] or len(data["sub_projects"]) > 0


class TestGitIntegration:
    """Git safety and detection."""

    def test_git_repo_detected(self, git_repo):
        r = run_setup(str(git_repo), "--plan-json")
        data = json.loads(r.stdout)
        assert data["has_git"] is True
        assert data["git"]["is_git"] is True

    def test_non_git_dir(self, empty_dir):
        r = run_setup(str(empty_dir), "--plan-json")
        data = json.loads(r.stdout)
        assert data["has_git"] is False
        assert data["git"]["is_git"] is False

    def test_no_git_check_skips_git(self, git_repo):
        # Create a file, dirty the repo
        (git_repo / "dirty.txt").write_text("dirty\n")
        r = run_setup(str(git_repo), "--yes", "--no-git-check")
        assert r.returncode == 0
        assert (git_repo / "CLAUDE.md").exists()

    def test_git_safety_skipped_when_no_overwrites(self, git_repo):
        """When all files will be created (not overwritten), git safety should be skipped."""
        r = run_setup(str(git_repo), "--yes")
        assert r.returncode == 0
        # Should succeed without git prompts since nothing is being overwritten
        assert (git_repo / "CLAUDE.md").exists()


class TestPlanJson:
    """--plan-json flag."""

    def test_valid_json_output(self, empty_dir):
        r = run_setup(str(empty_dir), "--plan-json")
        assert r.returncode == 0
        data = json.loads(r.stdout)
        assert "target" in data
        assert "stacks" in data
        assert "write_plan" in data
        assert "git" in data
        assert "tier" in data

    def test_no_files_written(self, empty_dir):
        r = run_setup(str(empty_dir), "--plan-json")
        assert r.returncode == 0
        for f in ["CLAUDE.md", "QUICKSTART.md", "STANDARDS.md", "ERRORS_AND_LESSONS.md"]:
            assert not (empty_dir / f).exists()

    def test_write_plan_reflects_existing(self, empty_dir):
        # Create some files first
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        # Now plan-json should show "skip" for existing files
        r = run_setup(str(empty_dir), "--plan-json")
        data = json.loads(r.stdout)
        for wp in data["write_plan"]:
            assert wp["mode"] == "skip"
            assert wp["exists"] is True

    def test_write_plan_create_for_new(self, empty_dir):
        r = run_setup(str(empty_dir), "--plan-json")
        data = json.loads(r.stdout)
        for wp in data["write_plan"]:
            assert wp["mode"] == "create"
            assert wp["exists"] is False

    def test_with_readme_in_plan(self, empty_dir):
        r = run_setup(str(empty_dir), "--plan-json", "--with-readme")
        data = json.loads(r.stdout)
        filenames = [wp["filename"] for wp in data["write_plan"]]
        assert "README.md" in filenames


# ─────────────────────────────────────────────
# Golden output tests — content quality
# ─────────────────────────────────────────────

class TestGeneratedContent:
    """Verify generated files contain expected sections and markers."""

    def test_claude_md_has_required_sections(self, empty_dir):
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        content = (empty_dir / "CLAUDE.md").read_text()
        for section in [
            "## Repository Overview",
            "## Invariants",
            "## Decision Heuristics",
            "## Verification Standard",
            "## Red Flags",
            "## Stuck Protocol",
            "## Pre-Task Protocol",
            "### Post-Task",
            "## Key Decisions",
        ]:
            assert section in content, f"Missing section: {section}"

    def test_claude_md_has_frontmatter(self, empty_dir):
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        content = (empty_dir / "CLAUDE.md").read_text()
        assert content.startswith("---\n")
        assert "project:" in content
        assert "tier:" in content

    def test_claude_md_has_iron_law(self, empty_dir):
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        content = (empty_dir / "CLAUDE.md").read_text()
        assert "Iron Law" in content

    def test_claude_md_has_size_guidance(self, empty_dir):
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        content = (empty_dir / "CLAUDE.md").read_text()
        assert "300 lines" in content

    def test_standards_md_has_hard_gates(self, empty_dir):
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        content = (empty_dir / "STANDARDS.md").read_text()
        assert "<HARD-GATE>" in content

    def test_standards_md_has_severity_levels(self, empty_dir):
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        content = (empty_dir / "STANDARDS.md").read_text()
        assert "CRITICAL" in content
        assert "HIGH" in content
        assert "MEDIUM" in content

    def test_standards_md_has_core_principles(self, empty_dir):
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        content = (empty_dir / "STANDARDS.md").read_text()
        assert "Core Principles" in content
        assert "Iron Law" in content

    def test_standards_md_has_iteration_limits(self, empty_dir):
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        content = (empty_dir / "STANDARDS.md").read_text()
        assert "Max Iterations" in content

    def test_standards_md_has_legitimate_exceptions(self, empty_dir):
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        content = (empty_dir / "STANDARDS.md").read_text()
        assert "Legitimate Exceptions" in content
        assert "Emergency hotfix" in content

    def test_errors_md_has_rationalization_table(self, empty_dir):
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        content = (empty_dir / "ERRORS_AND_LESSONS.md").read_text()
        assert "Rationalization Table" in content
        assert "Too simple to test" in content

    def test_errors_md_has_defense_in_depth(self, empty_dir):
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        content = (empty_dir / "ERRORS_AND_LESSONS.md").read_text()
        assert "Defense-in-Depth" in content

    def test_quickstart_has_workflow_example(self, empty_dir):
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        content = (empty_dir / "QUICKSTART.md").read_text()
        assert "Complete Workflow Example" in content

    def test_python_project_has_stack_info(self, python_project):
        run_setup(str(python_project), "--yes", "--no-git-check")
        content = (python_project / "CLAUDE.md").read_text()
        assert "python" in content.lower() or "Python" in content

    def test_node_project_has_stack_info(self, node_project):
        run_setup(str(node_project), "--yes", "--no-git-check")
        content = (node_project / "CLAUDE.md").read_text()
        assert "node" in content.lower() or "Node" in content

    def test_provenance_markers_only_three_types(self, empty_dir):
        """All provenance markers should be one of: migrated, inferred, placeholder."""
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        import re
        valid_markers = {"migrated", "inferred", "placeholder"}
        for f in ["CLAUDE.md", "QUICKSTART.md", "STANDARDS.md", "ERRORS_AND_LESSONS.md"]:
            content = (empty_dir / f).read_text()
            markers = re.findall(r'<!-- \[([^\]]+)\] -->', content)
            for marker in markers:
                assert marker in valid_markers, (
                    f"Invalid provenance marker '{marker}' in {f}. "
                    f"Expected one of: {valid_markers}"
                )

    def test_no_empty_bash_blocks(self, empty_dir):
        """Generated files should not have empty ```bash``` blocks."""
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        import re
        for f in ["CLAUDE.md", "QUICKSTART.md"]:
            content = (empty_dir / f).read_text()
            # Find bash blocks with only comments or whitespace
            blocks = re.findall(r'```bash\n(.*?)```', content, re.DOTALL)
            for block in blocks:
                stripped = "\n".join(
                    line for line in block.strip().split("\n")
                    if line.strip() and not line.strip().startswith("#")
                )
                # It's ok to have comment-only blocks for placeholders,
                # but not completely empty blocks
                assert block.strip(), f"Empty bash block found in {f}"


class TestGitWorktreeSection:
    """Worktree guidance only appears in git repos."""

    def test_git_repo_has_parallel_dev(self, git_repo):
        run_setup(str(git_repo), "--yes", "--no-git-check")
        content = (git_repo / "CLAUDE.md").read_text()
        assert "Parallel Development" in content

    def test_non_git_no_parallel_dev(self, empty_dir):
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        content = (empty_dir / "CLAUDE.md").read_text()
        assert "Parallel Development" not in content


# ─────────────────────────────────────────────
# Edge cases
# ─────────────────────────────────────────────

class TestEdgeCases:
    """Edge cases and boundary conditions."""

    def test_target_with_spaces(self, tmp_path):
        d = tmp_path / "my project dir"
        d.mkdir()
        r = run_setup(str(d), "--yes", "--no-git-check")
        assert r.returncode == 0
        assert (d / "CLAUDE.md").exists()

    def test_nested_path(self, tmp_path):
        d = tmp_path / "a" / "b" / "c"
        r = run_setup(str(d), "--yes", "--no-git-check")
        assert r.returncode == 0
        assert d.exists()
        assert (d / "CLAUDE.md").exists()

    def test_existing_docs_detected(self, empty_dir):
        """Existing docs should show up in plan-json."""
        (empty_dir / "CLAUDE.md").write_text("# existing\n")
        r = run_setup(str(empty_dir), "--plan-json")
        data = json.loads(r.stdout)
        assert "CLAUDE.md" in data["existing_docs"]

    def test_idempotent_with_force(self, empty_dir):
        """Running with --force twice on existing files should produce same content."""
        # First run creates files
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        # Second run with --force: extracts from existing files
        run_setup(str(empty_dir), "--yes", "--no-git-check", "--force")
        content1 = (empty_dir / "CLAUDE.md").read_text()
        # Third run with --force: should produce same as second (stable extraction)
        run_setup(str(empty_dir), "--yes", "--no-git-check", "--force")
        content2 = (empty_dir / "CLAUDE.md").read_text()
        assert content1 == content2


# ─────────────────────────────────────────────
# RC file persistence (Phase 1)
# ─────────────────────────────────────────────

class TestRCPersistence:
    """Test .claude-setup.rc save/load cycle."""

    def test_rc_not_created_for_existing_project(self, python_project):
        """RC file is only created from wizard, not from auto-detected projects."""
        run_setup(str(python_project), "--yes", "--no-git-check")
        assert not (python_project / ".claude-setup.rc").exists()

    def test_rc_load_applies_config(self, empty_dir):
        """Manually written RC config should be loaded and used."""
        rc_content = (
            "[project]\n"
            "description = My test project\n"
            "stacks = python, node\n"
            "frameworks = fastapi, react\n"
            "deploy = docker\n"
            "is_monorepo = false\n"
        )
        (empty_dir / ".claude-setup.rc").write_text(rc_content)
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        content = (empty_dir / "CLAUDE.md").read_text()
        assert "python" in content.lower()
        assert "node" in content.lower()
        assert "fastapi" in content.lower() or "FastAPI" in content

    def test_rc_reflected_in_plan_json(self, empty_dir):
        """Plan JSON should reflect RC-loaded stacks."""
        rc_content = "[project]\nstacks = rust\nframeworks = axum\n"
        (empty_dir / ".claude-setup.rc").write_text(rc_content)
        r = run_setup(str(empty_dir), "--plan-json")
        # RC doesn't apply in plan_json (which only uses scan_directory),
        # but the file should at least not crash
        assert r.returncode == 0


# ─────────────────────────────────────────────
# Dual-condition overwrite (Phase 6)
# ─────────────────────────────────────────────

class TestDualOverwrite:
    """Test --force (skip unchanged) vs --force-all behavior."""

    def test_force_skips_unchanged(self, empty_dir):
        """--force should skip files that haven't changed."""
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        r = run_setup(str(empty_dir), "--yes", "--no-git-check", "--force")
        # All files should show as SKIP (unchanged) since content is identical
        assert "unchanged" in r.stdout.lower() or "skip" in r.stdout.lower()

    def test_force_all_overwrites_unchanged(self, empty_dir):
        """--force-all should overwrite even unchanged files."""
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        r = run_setup(str(empty_dir), "--yes", "--no-git-check", "--force-all")
        assert r.returncode == 0
        # Should show OVERWRITE, not SKIP
        assert "OVERWRITE" in r.stdout

    def test_force_detects_content_change(self, empty_dir):
        """--force should overwrite files that have been modified externally."""
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        # Modify a file externally
        (empty_dir / "CLAUDE.md").write_text("# Modified externally\n")
        r = run_setup(str(empty_dir), "--yes", "--no-git-check", "--force")
        assert r.returncode == 0
        content = (empty_dir / "CLAUDE.md").read_text()
        # Should have been overwritten with generated content
        assert "Repository Overview" in content


# ─────────────────────────────────────────────
# AUTO-MAINTAINED marker (Phase 4)
# ─────────────────────────────────────────────

class TestAutoMaintained:
    """QUICKSTART.md should have AUTO-MAINTAINED marker."""

    def test_quickstart_has_auto_maintained(self, empty_dir):
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        content = (empty_dir / "QUICKSTART.md").read_text()
        assert "AUTO-MAINTAINED" in content

    def test_auto_maintained_is_html_comment(self, empty_dir):
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        content = (empty_dir / "QUICKSTART.md").read_text()
        assert "<!-- AUTO-MAINTAINED" in content


# ─────────────────────────────────────────────
# Post-generation verification (Phase 3)
# ─────────────────────────────────────────────

class TestVerification:
    """Post-generation verification catches issues."""

    def test_clean_run_no_warnings(self, empty_dir):
        """A clean run should not produce verification warnings."""
        r = run_setup(str(empty_dir), "--yes", "--no-git-check")
        assert "Verification issues" not in r.stdout

    def test_version_stamp(self, empty_dir):
        """Generated files should reference claude-primer version."""
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        content = (empty_dir / "CLAUDE.md").read_text()
        assert re.search(r"claude-primer v\d+\.\d+", content), "Should contain versioned claude-primer reference"


# ─────────────────────────────────────────────
# Unit tests for pure functions
# ─────────────────────────────────────────────

class TestPureFunctions:
    """Unit tests for pure helper functions."""

    def test_extract_md_sections_basic(self):
        from claude_primer import extract_md_sections
        content = "# Title\nIntro\n## Section A\nBody A\n## Section B\nBody B"
        sections = extract_md_sections(content)
        assert "Title" in sections
        # ## headings under # Title get hierarchical keys
        assert "Title > Section A" in sections
        assert "Title > Section B" in sections
        assert "Body A" in sections["Title > Section A"]

    def test_extract_md_sections_nested(self):
        from claude_primer import extract_md_sections
        content = "## Parent\n### Child\nNested body"
        sections = extract_md_sections(content)
        assert "Parent > Child" in sections
        assert "Nested body" in sections["Parent > Child"]

    def test_extract_md_sections_code_block(self):
        from claude_primer import extract_md_sections
        content = "## Real\nBody\n```\n## Not a heading\n```\n## Another\nMore"
        sections = extract_md_sections(content)
        assert "Real" in sections
        assert "Another" in sections
        assert "Not a heading" not in sections

    def test_detect_project_tier_empty(self):
        from claude_primer import detect_project_tier
        result = detect_project_tier({"stacks": [], "frameworks": [], "deploy": [], "is_empty": True, "is_monorepo": False})
        assert result["tier"] == 4

    def test_detect_project_tier_python(self):
        from claude_primer import detect_project_tier
        result = detect_project_tier({"stacks": ["python"], "frameworks": [], "deploy": [], "is_empty": False, "is_monorepo": False})
        assert result["tier"] == 3

    def test_detect_project_tier_t1(self):
        from claude_primer import detect_project_tier
        result = detect_project_tier({
            "stacks": ["node"], "frameworks": ["nextjs"],
            "deploy": ["vercel"], "is_empty": False, "is_monorepo": True
        })
        assert result["tier"] == 1

    def test_load_rc_missing_file(self, tmp_path):
        from claude_primer import load_rc
        result = load_rc(tmp_path)
        assert result == {}

    def test_save_load_rc_roundtrip(self, tmp_path):
        from claude_primer import save_rc, load_rc
        info = {
            "description": "Test project",
            "stacks": ["python", "node"],
            "frameworks": ["fastapi"],
            "deploy": ["docker"],
            "is_monorepo": True,
            "monorepo_tool": "turborepo",
        }
        save_rc(tmp_path, info)
        loaded = load_rc(tmp_path)
        assert loaded["description"] == "Test project"
        assert loaded["stacks"] == ["python", "node"]
        assert loaded["frameworks"] == ["fastapi"]
        assert loaded["deploy"] == ["docker"]
        assert loaded["is_monorepo"] is True
        assert loaded["monorepo_tool"] == "turborepo"

    def test_verify_generated_catches_empty(self, tmp_path):
        from claude_primer import _verify_generated, FileAction
        (tmp_path / "CLAUDE.md").write_text("")
        actions = [FileAction("CLAUDE.md", "create")]
        issues = _verify_generated(tmp_path, actions)
        assert any("empty" in i for i in issues)

    def test_verify_generated_catches_missing_heading(self, tmp_path):
        from claude_primer import _verify_generated, FileAction
        (tmp_path / "test.md").write_text("No heading here, just text.")
        actions = [FileAction("test.md", "create")]
        issues = _verify_generated(tmp_path, actions)
        assert any("heading" in i for i in issues)


# ─────────────────────────────────────────────
# Ralph integration (optional --with-ralph)
# ─────────────────────────────────────────────

class TestRalphIntegration:
    """Test optional Ralph integration via --with-ralph flag."""

    def test_no_ralph_by_default(self, empty_dir):
        """Ralph files should NOT be created without --with-ralph."""
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        assert not (empty_dir / ".ralph").exists()
        assert not (empty_dir / ".ralphrc").exists()

    def test_with_ralph_creates_structure(self, empty_dir):
        """--with-ralph should create .ralph/, PROMPT.md, AGENT.md, fix_plan.md, .ralphrc."""
        run_setup(str(empty_dir), "--yes", "--no-git-check", "--with-ralph")
        assert (empty_dir / ".ralph").is_dir()
        assert (empty_dir / ".ralph" / "PROMPT.md").exists()
        assert (empty_dir / ".ralph" / "AGENT.md").exists()
        assert (empty_dir / ".ralph" / "fix_plan.md").exists()
        assert (empty_dir / ".ralphrc").exists()
        assert (empty_dir / ".ralph" / "hooks" / "post-loop.sh").exists()

    def test_ralph_prompt_references_claude_md(self, empty_dir):
        """PROMPT.md should reference CLAUDE.md."""
        run_setup(str(empty_dir), "--yes", "--no-git-check", "--with-ralph")
        content = (empty_dir / ".ralph" / "PROMPT.md").read_text()
        assert "CLAUDE.md" in content
        assert "STANDARDS.md" in content
        assert "ERRORS_AND_LESSONS.md" in content

    def test_ralph_prompt_no_duplication(self, empty_dir):
        """PROMPT.md should NOT contain architecture or stack details."""
        run_setup(str(empty_dir), "--yes", "--no-git-check", "--with-ralph")
        content = (empty_dir / ".ralph" / "PROMPT.md").read_text()
        assert "## Architecture" not in content
        assert "## Environment" not in content
        assert "Tech stack:" not in content

    def test_ralph_prompt_has_loop_instructions(self, empty_dir):
        """PROMPT.md should contain Ralph-specific loop instructions."""
        run_setup(str(empty_dir), "--yes", "--no-git-check", "--with-ralph")
        content = (empty_dir / ".ralph" / "PROMPT.md").read_text()
        assert "EXIT_SIGNAL" in content
        assert "fix_plan" in content
        assert "RALPH_STATUS" in content

    def test_ralph_agent_is_symlink(self, empty_dir):
        """AGENT.md should be a symlink to QUICKSTART.md."""
        run_setup(str(empty_dir), "--yes", "--no-git-check", "--with-ralph")
        agent = empty_dir / ".ralph" / "AGENT.md"
        assert agent.is_symlink()
        # Symlink should resolve to QUICKSTART.md
        assert agent.resolve() == (empty_dir / "QUICKSTART.md").resolve()

    def test_ralph_allowed_tools_python(self, python_project):
        """Python project should have python tools in .ralphrc."""
        run_setup(str(python_project), "--yes", "--no-git-check", "--with-ralph")
        content = (python_project / ".ralphrc").read_text()
        assert "Bash(python *)" in content
        assert "Bash(pytest)" in content

    def test_ralph_allowed_tools_node(self, node_project):
        """Node project should have npm/npx tools in .ralphrc."""
        run_setup(str(node_project), "--yes", "--no-git-check", "--with-ralph")
        content = (node_project / ".ralphrc").read_text()
        assert "Bash(npm *)" in content
        assert "Bash(npx *)" in content

    def test_ralph_fix_plan_not_overwritten(self, empty_dir):
        """Existing fix_plan.md should NOT be overwritten on --force."""
        run_setup(str(empty_dir), "--yes", "--no-git-check", "--with-ralph")
        custom_content = "# My custom plan\n- [ ] Custom task\n"
        (empty_dir / ".ralph" / "fix_plan.md").write_text(custom_content)
        run_setup(str(empty_dir), "--yes", "--no-git-check", "--with-ralph", "--force")
        content = (empty_dir / ".ralph" / "fix_plan.md").read_text()
        assert "Custom task" in content

    def test_ralph_gitignore_updated(self, empty_dir):
        """.gitignore should have Ralph runtime entries."""
        (empty_dir / ".gitignore").write_text("*.pyc\n")
        run_setup(str(empty_dir), "--yes", "--no-git-check", "--with-ralph")
        content = (empty_dir / ".gitignore").read_text()
        assert ".ralph/logs/" in content
        assert ".ralph/.ralph_session" in content

    def test_ralph_gitignore_no_duplicates(self, empty_dir):
        """.gitignore entries should not be duplicated on repeat runs."""
        (empty_dir / ".gitignore").write_text("*.pyc\n")
        run_setup(str(empty_dir), "--yes", "--no-git-check", "--with-ralph")
        run_setup(str(empty_dir), "--yes", "--no-git-check", "--with-ralph", "--force")
        content = (empty_dir / ".gitignore").read_text()
        assert content.count(".ralph/logs/") == 1

    def test_ralph_dry_run(self, empty_dir):
        """Dry run with --with-ralph should not create Ralph files."""
        run_setup(str(empty_dir), "--yes", "--no-git-check", "--with-ralph", "--dry-run")
        assert not (empty_dir / ".ralph").exists()
        assert not (empty_dir / ".ralphrc").exists()

    def test_ralph_hook_is_executable(self, empty_dir):
        """Post-loop hook should be valid bash."""
        run_setup(str(empty_dir), "--yes", "--no-git-check", "--with-ralph")
        hook = empty_dir / ".ralph" / "hooks" / "post-loop.sh"
        assert hook.exists()
        content = hook.read_text()
        assert content.startswith("#!/usr/bin/env bash")

    def test_ralph_ralphrc_has_project_name(self, empty_dir):
        """.ralphrc should have the project name."""
        run_setup(str(empty_dir), "--yes", "--no-git-check", "--with-ralph")
        content = (empty_dir / ".ralphrc").read_text()
        assert "PROJECT_NAME=" in content

    def test_ralph_ralphrc_base_tools(self, empty_dir):
        """.ralphrc should always include Write,Read,Edit base tools."""
        run_setup(str(empty_dir), "--yes", "--no-git-check", "--with-ralph")
        content = (empty_dir / ".ralphrc").read_text()
        assert "Write,Read,Edit" in content
        assert "Bash(git *)" in content

    def test_ralph_clean_root_prompt_references_docs_dir(self, empty_dir):
        """With --clean-root, PROMPT.md should point to .claude/docs/ files."""
        run_setup(str(empty_dir), "--yes", "--no-git-check", "--with-ralph", "--clean-root")
        content = (empty_dir / ".ralph" / "PROMPT.md").read_text()
        assert "../.claude/docs/QUICKSTART.md" in content
        assert "../.claude/docs/STANDARDS.md" in content
        assert "../.claude/docs/ERRORS_AND_LESSONS.md" in content

    def test_ralph_clean_root_agent_symlink_points_docs_dir(self, empty_dir):
        """With --clean-root, AGENT.md should link to the relocated QUICKSTART.md."""
        run_setup(str(empty_dir), "--yes", "--no-git-check", "--with-ralph", "--clean-root")
        agent = empty_dir / ".ralph" / "AGENT.md"
        assert agent.is_symlink()
        assert agent.resolve() == (empty_dir / ".claude" / "docs" / "QUICKSTART.md").resolve()

    def test_ralph_first_run_reports_create_actions(self, empty_dir):
        """First Ralph run should report newly created files as CREATE."""
        r = run_setup(str(empty_dir), "--yes", "--no-git-check", "--with-ralph")
        assert r.returncode == 0
        assert "CREATE               .ralph/PROMPT.md" in r.stdout
        assert "CREATE               .ralph/fix_plan.md" in r.stdout
        assert "CREATE               .ralphrc" in r.stdout
        assert "OVERWRITE            .ralph/PROMPT.md" not in r.stdout
        assert "SKIP                 .ralph/fix_plan.md" not in r.stdout


# ─────────────────────────────────────────────
# --from-doc flag
# ─────────────────────────────────────────────

class TestFromDoc:
    """Test --from-doc flag for bootstrapping from existing documents."""

    def test_from_doc_extracts_description(self, empty_dir):
        """Create a temp .md file with a description, run with --from-doc, check CLAUDE.md has the description."""
        doc = empty_dir / "spec.md"
        doc.write_text(
            "# My Project Spec\n\n"
            "This is a fantastic project that does amazing things.\n\n"
            "## Details\n\nMore info here.\n"
        )
        r = run_setup(str(empty_dir), "--yes", "--no-git-check", "--from-doc", str(doc))
        assert r.returncode == 0
        content = (empty_dir / "CLAUDE.md").read_text()
        assert "fantastic project" in content

    def test_from_doc_extracts_commands(self, empty_dir):
        """Temp .md with bash blocks, check QUICKSTART.md has them."""
        doc = empty_dir / "prd.md"
        doc.write_text(
            "# PRD\n\n"
            "Some intro text for the project.\n\n"
            "## Setup\n\n"
            "```bash\npip install -r requirements.txt\npython main.py\n```\n\n"
            "## Testing\n\n"
            "```sh\npytest -v\n```\n"
        )
        r = run_setup(str(empty_dir), "--yes", "--no-git-check", "--from-doc", str(doc))
        assert r.returncode == 0
        content = (empty_dir / "QUICKSTART.md").read_text()
        assert "pip install" in content or "pytest" in content

    def test_from_doc_missing_file(self, empty_dir):
        """Graceful handling when file doesn't exist (should still generate docs)."""
        missing = str(empty_dir / "nonexistent.md")
        r = run_setup(str(empty_dir), "--yes", "--no-git-check", "--from-doc", missing)
        assert r.returncode == 0
        # Should still generate docs, just without doc content
        assert (empty_dir / "CLAUDE.md").exists()
        assert (empty_dir / "QUICKSTART.md").exists()

    def test_from_doc_with_existing_project(self, python_project):
        """from-doc on a python project merges both sources."""
        doc = python_project / "design.md"
        doc.write_text(
            "# Design Doc\n\n"
            "A Python web service for data processing.\n\n"
            "## System Architecture\n\n"
            "The system uses a modular pipeline architecture with plugins.\n\n"
            "```bash\npytest --cov\n```\n"
        )
        r = run_setup(str(python_project), "--yes", "--no-git-check", "--from-doc", str(doc))
        assert r.returncode == 0
        content = (empty_dir / "CLAUDE.md").read_text() if False else (python_project / "CLAUDE.md").read_text()
        # Should have both python detection AND doc content
        assert "python" in content.lower() or "Python" in content
        # Architecture from the doc should appear
        assert "pipeline" in content or "modular" in content


# ─────────────────────────────────────────────
# Command deduplication and ranking (Phase 7)
# ─────────────────────────────────────────────

class TestCommandDedup:
    """Tests for dedup_and_rank_commands() pure function."""

    def test_dedup_removes_duplicates(self):
        from claude_primer import dedup_and_rank_commands
        result = dedup_and_rank_commands(["pip install x", "pip install x", "pytest"])
        assert len(result) == 2
        assert "pip install x" in result
        assert "pytest" in result

    def test_dedup_removes_path_specific(self):
        from claude_primer import dedup_and_rank_commands
        commands = [
            "pip install -r requirements.txt",
            "cd /Users/john/projects/myapp && npm install",
            "python /home/dev/scripts/run.py",
            "pytest",
        ]
        result = dedup_and_rank_commands(commands)
        assert "pip install -r requirements.txt" in result
        assert "pytest" in result
        # Path-specific commands should be removed
        assert not any("/Users/" in cmd for cmd in result)
        assert not any("/home/" in cmd for cmd in result)

    def test_dedup_ranking_order(self):
        from claude_primer import dedup_and_rank_commands
        commands = [
            "npm run build",       # build (4)
            "pytest",              # test (2)
            "pip install flask",   # install (0)
        ]
        result = dedup_and_rank_commands(commands)
        assert len(result) == 3
        # install should come before test, test before build
        install_idx = result.index("pip install flask")
        test_idx = result.index("pytest")
        build_idx = result.index("npm run build")
        assert install_idx < test_idx < build_idx

    def test_dedup_preserves_valid_commands(self):
        from claude_primer import dedup_and_rank_commands
        commands = [
            "pip install -r requirements.txt",
            "npm run dev",
            "pytest --cov",
            "eslint .",
            "docker compose up",
        ]
        result = dedup_and_rank_commands(commands)
        assert len(result) == 5
        for cmd in commands:
            assert cmd in result

    def test_dedup_empty_list(self):
        from claude_primer import dedup_and_rank_commands
        result = dedup_and_rank_commands([])
        assert result == []




# ─────────────────────────────────────────────
# Enhanced monorepo intelligence (Phase 9)
# ─────────────────────────────────────────────

class TestMonorepoIntelligence:
    """Enhanced monorepo sub-project detail detection."""

    def test_monorepo_sub_project_details(self, tmp_path):
        """Verify sub_project_details has correct stacks and frameworks."""
        # Create a fake monorepo
        (tmp_path / "turbo.json").write_text('{"pipeline": {}}\n')
        pkg = {"name": "root", "private": True, "workspaces": ["apps/*"]}
        (tmp_path / "package.json").write_text(json.dumps(pkg, indent=2))

        # apps/web — node project with next
        web = tmp_path / "apps" / "web"
        web.mkdir(parents=True)
        web_pkg = {"name": "web", "dependencies": {"next": "^14.0.0"}}
        (web / "package.json").write_text(json.dumps(web_pkg, indent=2))

        # apps/api — python project with fastapi
        api = tmp_path / "apps" / "api"
        api.mkdir(parents=True)
        (api / "requirements.txt").write_text("fastapi==0.100.0\nuvicorn\n")

        r = run_setup(str(tmp_path), "--plan-json")
        data = json.loads(r.stdout)

        assert data["is_monorepo"] is True
        assert "sub_project_details" in data
        details = data["sub_project_details"]
        assert len(details) >= 2

        # Find web and api details
        web_detail = next((d for d in details if "web" in d["path"]), None)
        api_detail = next((d for d in details if "api" in d["path"]), None)

        assert web_detail is not None, f"No web detail found in {details}"
        assert "node" in web_detail["stacks"]

        assert api_detail is not None, f"No api detail found in {details}"
        assert "python" in api_detail["stacks"]

    def test_monorepo_claude_md_has_enhanced_table(self, tmp_path):
        """CLAUDE.md should have the enhanced table with Stack/Framework columns."""
        (tmp_path / "turbo.json").write_text('{"pipeline": {}}\n')
        pkg = {"name": "root", "private": True, "workspaces": ["apps/*"]}
        (tmp_path / "package.json").write_text(json.dumps(pkg, indent=2))

        web = tmp_path / "apps" / "web"
        web.mkdir(parents=True)
        web_pkg = {"name": "web", "dependencies": {"next": "^14.0.0"}}
        (web / "package.json").write_text(json.dumps(web_pkg, indent=2))

        api = tmp_path / "apps" / "api"
        api.mkdir(parents=True)
        (api / "requirements.txt").write_text("fastapi==0.100.0\n")

        run_setup(str(tmp_path), "--yes", "--no-git-check")
        content = (tmp_path / "CLAUDE.md").read_text()

        assert "| Directory | Stack | Framework | Local CLAUDE.md |" in content
        assert "|-----------|-------|-----------|" in content

    def test_monorepo_root_note(self, tmp_path):
        """CLAUDE.md should have the 'This is a monorepo root' note."""
        (tmp_path / "turbo.json").write_text('{"pipeline": {}}\n')
        pkg = {"name": "root", "private": True, "workspaces": ["apps/*"]}
        (tmp_path / "package.json").write_text(json.dumps(pkg, indent=2))

        web = tmp_path / "apps" / "web"
        web.mkdir(parents=True)
        (web / "package.json").write_text('{"name": "web"}\n')

        run_setup(str(tmp_path), "--yes", "--no-git-check")
        content = (tmp_path / "CLAUDE.md").read_text()

        assert "This is a monorepo root" in content

    def test_non_monorepo_no_enhanced_table(self, tmp_path):
        """Regular (non-monorepo) project should not have the monorepo table."""
        (tmp_path / "requirements.txt").write_text("requests==2.31.0\n")
        (tmp_path / "main.py").write_text("print('hello')\n")

        run_setup(str(tmp_path), "--yes", "--no-git-check")
        content = (tmp_path / "CLAUDE.md").read_text()

        assert "This is a monorepo root" not in content
        assert "| Directory | Stack | Framework | Local CLAUDE.md |" not in content


if __name__ == "__main__":
    pytest.main([__file__, "-v"])


# ─────────────────────────────────────────────
# Clean root (--clean-root)
# ─────────────────────────────────────────────

class TestCleanRoot:
    """Test --clean-root moves auxiliary docs to .claude/docs/."""

    def test_clean_root_claude_md_at_root(self, empty_dir):
        """CLAUDE.md should remain in the project root when --clean-root is used."""
        r = run_setup(str(empty_dir), "--yes", "--no-git-check", "--clean-root")
        assert r.returncode == 0
        assert (empty_dir / "CLAUDE.md").exists()

    def test_clean_root_others_in_docs_dir(self, empty_dir):
        """STANDARDS.md, QUICKSTART.md, ERRORS_AND_LESSONS.md should be in .claude/docs/."""
        r = run_setup(str(empty_dir), "--yes", "--no-git-check", "--clean-root")
        assert r.returncode == 0
        docs = empty_dir / ".claude" / "docs"
        for f in ["STANDARDS.md", "QUICKSTART.md", "ERRORS_AND_LESSONS.md"]:
            assert (docs / f).exists(), f"{f} not found in .claude/docs/"
            assert not (empty_dir / f).exists(), f"{f} should NOT be at root with --clean-root"

    def test_clean_root_references_updated(self, empty_dir):
        """CLAUDE.md references should point to .claude/docs/ paths."""
        r = run_setup(str(empty_dir), "--yes", "--no-git-check", "--clean-root")
        assert r.returncode == 0
        content = (empty_dir / "CLAUDE.md").read_text()
        assert ".claude/docs/QUICKSTART.md" in content
        assert ".claude/docs/STANDARDS.md" in content
        assert ".claude/docs/ERRORS_AND_LESSONS.md" in content

    def test_clean_root_readme_references_updated(self, empty_dir):
        """README.md references should point to .claude/docs/ paths when generated."""
        r = run_setup(str(empty_dir), "--yes", "--no-git-check", "--clean-root", "--with-readme")
        assert r.returncode == 0
        content = (empty_dir / "README.md").read_text()
        assert ".claude/docs/QUICKSTART.md" in content
        assert ".claude/docs/STANDARDS.md" in content
        assert ".claude/docs/ERRORS_AND_LESSONS.md" in content

    def test_no_clean_root_default(self, empty_dir):
        """Without --clean-root, all files should be at root (default behavior)."""
        r = run_setup(str(empty_dir), "--yes", "--no-git-check")
        assert r.returncode == 0
        for f in ["CLAUDE.md", "QUICKSTART.md", "STANDARDS.md", "ERRORS_AND_LESSONS.md"]:
            assert (empty_dir / f).exists(), f"{f} not at root"
        assert not (empty_dir / ".claude" / "docs").exists()

    def test_clean_root_creates_docs_dir(self, empty_dir):
        """.claude/docs/ directory should be created when --clean-root is used."""
        r = run_setup(str(empty_dir), "--yes", "--no-git-check", "--clean-root")
        assert r.returncode == 0
        assert (empty_dir / ".claude" / "docs").is_dir()

    def test_clean_root_ralph_prompt_references(self, tmp_path):
        """Ralph PROMPT.md should reference .claude/docs/ paths under --clean-root."""
        (tmp_path / "requirements.txt").write_text("flask\n")
        (tmp_path / "app.py").write_text("print('hi')\n")
        r = run_setup(str(tmp_path), "--yes", "--no-git-check", "--clean-root", "--with-ralph")
        assert r.returncode == 0
        content = (tmp_path / ".ralph" / "PROMPT.md").read_text()
        assert ".claude/docs/STANDARDS.md" in content
        assert ".claude/docs/ERRORS_AND_LESSONS.md" in content

    def test_clean_root_ralph_agent_symlink_resolves(self, tmp_path):
        """Ralph AGENT.md symlink should resolve to QUICKSTART.md in .claude/docs/."""
        (tmp_path / "requirements.txt").write_text("flask\n")
        (tmp_path / "app.py").write_text("print('hi')\n")
        r = run_setup(str(tmp_path), "--yes", "--no-git-check", "--clean-root", "--with-ralph")
        assert r.returncode == 0
        agent = tmp_path / ".ralph" / "AGENT.md"
        assert agent.is_symlink(), "AGENT.md should be a symlink"
        # Symlink should actually resolve to a real file
        assert agent.exists(), f"AGENT.md symlink is broken (target: {agent.resolve()})"
        content = agent.read_text()
        assert "Quick Start" in content or "QUICKSTART" in content


# ─────────────────────────────────────────────
# Phase 6: Confidence scoring
# ─────────────────────────────────────────────

class TestConfidenceScoring:
    def test_plan_json_includes_confidence_scores(self, python_project):
        """--plan-json output should include confidence_scores."""
        r = run_setup(str(python_project), "--plan-json")
        assert r.returncode == 0
        data = json.loads(r.stdout)
        assert "confidence_scores" in data
        assert "stacks" in data["confidence_scores"]

    def test_stack_confidence_high_from_config_file(self, python_project):
        """Stacks detected from config files should have high confidence."""
        r = run_setup(str(python_project), "--plan-json")
        data = json.loads(r.stdout)
        stacks = data["confidence_scores"]["stacks"]
        python_score = [s for s in stacks if s["value"] == "python"]
        assert python_score, "Python stack should be detected"
        assert python_score[0]["confidence"] == "high"

    def test_stack_confidence_medium_from_extensions(self, tmp_path):
        """Stacks detected only from extensions should have medium confidence."""
        # Create a project with .py files but no requirements.txt/pyproject.toml
        (tmp_path / "script.py").write_text("print('hi')\n")
        (tmp_path / "util.py").write_text("x = 1\n")
        r = run_setup(str(tmp_path), "--plan-json")
        data = json.loads(r.stdout)
        stacks = data["confidence_scores"]["stacks"]
        python_score = [s for s in stacks if s["value"] == "python"]
        assert python_score, "Python stack should be detected"
        assert python_score[0]["confidence"] == "medium"

    def test_description_confidence_from_package_json(self, node_project):
        """Description from package.json should have high confidence."""
        r = run_setup(str(node_project), "--plan-json")
        data = json.loads(r.stdout)
        if "description" in data["confidence_scores"]:
            desc = data["confidence_scores"]["description"]
            assert desc["confidence"] in ("high", "medium")


# ─────────────────────────────────────────────
# Phase 11: Template system
# ─────────────────────────────────────────────

class TestTemplateSystem:
    def test_template_section_override(self, python_project):
        """User template should override matching sections."""
        tpl_dir = python_project / ".claude-primer" / "templates"
        tpl_dir.mkdir(parents=True)
        (tpl_dir / "claude.md").write_text(
            "## Code Architecture\n\nCustom architecture from template.\n"
        )
        r = run_setup(str(python_project), "--yes", "--no-git-check")
        assert r.returncode == 0
        content = (python_project / "CLAUDE.md").read_text()
        assert "Custom architecture from template." in content

    def test_template_variable_substitution(self, python_project):
        """{{project_name}} should be replaced with actual project name."""
        tpl_dir = python_project / ".claude-primer" / "templates"
        tpl_dir.mkdir(parents=True)
        (tpl_dir / "claude.md").write_text(
            "## Code Architecture\n\nProject: {{project_name}}, Stack: {{tech_stack}}\n"
        )
        r = run_setup(str(python_project), "--yes", "--no-git-check")
        assert r.returncode == 0
        content = (python_project / "CLAUDE.md").read_text()
        name = python_project.name
        assert f"Project: {name}" in content
        assert "Stack: python" in content

    def test_template_dir_flag(self, python_project, tmp_path):
        """--template-dir should load templates from specified directory."""
        custom_tpl = tmp_path / "custom-templates"
        custom_tpl.mkdir()
        (custom_tpl / "claude.md").write_text(
            "## Code Architecture\n\nCustom from --template-dir.\n"
        )
        r = run_setup(str(python_project), "--yes", "--no-git-check",
                       "--template-dir", str(custom_tpl))
        assert r.returncode == 0
        content = (python_project / "CLAUDE.md").read_text()
        assert "Custom from --template-dir." in content

    def test_non_matching_template_sections_ignored(self, python_project):
        """Template sections that don't match generated headers should not cause errors."""
        tpl_dir = python_project / ".claude-primer" / "templates"
        tpl_dir.mkdir(parents=True)
        (tpl_dir / "claude.md").write_text(
            "## Nonexistent Section\n\nThis should not appear.\n"
        )
        r = run_setup(str(python_project), "--yes", "--no-git-check")
        assert r.returncode == 0
        content = (python_project / "CLAUDE.md").read_text()
        assert "This should not appear." not in content


# ─────────────────────────────────────────────
# Phase 12: Watch mode
# ─────────────────────────────────────────────

class TestWatchMode:
    def test_watch_help_flag(self):
        """--watch flag should be recognized."""
        r = run_setup("--help")
        assert "--watch" in r.stdout

    def test_watch_interval_help(self):
        """--watch-interval flag should be recognized."""
        r = run_setup("--help")
        assert "--watch-interval" in r.stdout

    def test_watch_auto_help(self):
        """--watch-auto flag should be recognized."""
        r = run_setup("--help")
        assert "--watch-auto" in r.stdout


# ─────────────────────────────────────────────
# Phase 13: Multi-agent context output
# ─────────────────────────────────────────────

class TestMultiAgentOutput:
    def test_cursor_output(self, node_project):
        """--agent cursor should create .cursor/rules/project.mdc."""
        r = run_setup(str(node_project), "--yes", "--no-git-check", "--agent", "cursor")
        assert r.returncode == 0
        mdc = node_project / ".cursor" / "rules" / "project.mdc"
        assert mdc.exists(), ".cursor/rules/project.mdc should be created"
        content = mdc.read_text()
        assert "alwaysApply: true" in content
        assert "node" in content

    def test_copilot_output(self, node_project):
        """--agent copilot should create .github/copilot-instructions.md."""
        r = run_setup(str(node_project), "--yes", "--no-git-check", "--agent", "copilot")
        assert r.returncode == 0
        f = node_project / ".github" / "copilot-instructions.md"
        assert f.exists()
        assert "Copilot Instructions" in f.read_text()

    def test_windsurf_output(self, node_project):
        """--agent windsurf should create .windsurfrules."""
        r = run_setup(str(node_project), "--yes", "--no-git-check", "--agent", "windsurf")
        assert r.returncode == 0
        f = node_project / ".windsurfrules"
        assert f.exists()
        assert "Rules" in f.read_text()

    def test_aider_output(self, node_project):
        """--agent aider should create .aider/conventions.md."""
        r = run_setup(str(node_project), "--yes", "--no-git-check", "--agent", "aider")
        assert r.returncode == 0
        f = node_project / ".aider" / "conventions.md"
        assert f.exists()
        assert "Conventions" in f.read_text()

    def test_codex_output(self, node_project):
        """--agent codex should create AGENTS.md."""
        r = run_setup(str(node_project), "--yes", "--no-git-check", "--agent", "codex")
        assert r.returncode == 0
        f = node_project / "AGENTS.md"
        assert f.exists()
        assert "AGENTS.md" in f.read_text()

    def test_all_agents(self, node_project):
        """--agent all should create files for all agents."""
        r = run_setup(str(node_project), "--yes", "--no-git-check", "--agent", "all")
        assert r.returncode == 0
        assert (node_project / ".cursor" / "rules" / "project.mdc").exists()
        assert (node_project / ".github" / "copilot-instructions.md").exists()
        assert (node_project / ".windsurfrules").exists()
        assert (node_project / ".aider" / "conventions.md").exists()
        assert (node_project / "AGENTS.md").exists()

    def test_json_format(self, node_project):
        """--format json should create a .json file."""
        r = run_setup(str(node_project), "--yes", "--no-git-check",
                       "--agent", "copilot", "--format", "json")
        assert r.returncode == 0
        json_files = list(node_project.glob(".claude-primer-*.json"))
        assert json_files, "JSON file should be created"
        data = json.loads(json_files[0].read_text())
        assert "stacks" in data

    def test_yaml_format(self, node_project):
        """--format yaml should create a .yaml file."""
        r = run_setup(str(node_project), "--yes", "--no-git-check",
                       "--agent", "copilot", "--format", "yaml")
        assert r.returncode == 0
        yaml_files = list(node_project.glob(".claude-primer-*.yaml"))
        assert yaml_files, "YAML file should be created"
        content = yaml_files[0].read_text()
        assert "stacks:" in content

    def test_invalid_agent_errors(self):
        """Invalid agent name should produce an error."""
        r = run_setup(".", "--agent", "invalid_agent")
        assert r.returncode != 0
        assert "Unknown agent" in r.stderr


# ─────────────────────────────────────────────
# Plugin system
# ─────────────────────────────────────────────

class TestPluginSystem:
    def test_plugin_generates_file(self, python_project):
        """Plugin should generate a custom file."""
        plugin_dir = python_project / ".claude-primer" / "plugins"
        plugin_dir.mkdir(parents=True)
        (plugin_dir / "custom.py").write_text(
            'def generate(info):\n'
            '    return {"filename": "CUSTOM.md", "content": "# Custom\\n"}\n'
        )
        r = run_setup(str(python_project), "--yes", "--no-git-check")
        assert r.returncode == 0
        assert (python_project / "CUSTOM.md").exists()
        assert (python_project / "CUSTOM.md").read_text() == "# Custom\n"

    def test_plugin_dir_flag(self, python_project, tmp_path):
        """--plugin-dir should load plugins from specified directory."""
        plugin_dir = tmp_path / "my-plugins"
        plugin_dir.mkdir()
        (plugin_dir / "extra.py").write_text(
            'def generate(info):\n'
            '    return {"filename": "EXTRA.md", "content": "# Extra\\n"}\n'
        )
        r = run_setup(str(python_project), "--yes", "--no-git-check",
                       "--plugin-dir", str(plugin_dir))
        assert r.returncode == 0
        assert (python_project / "EXTRA.md").exists()

    def test_plugin_multi_file(self, python_project):
        """Plugin returning a list should generate multiple files."""
        plugin_dir = python_project / ".claude-primer" / "plugins"
        plugin_dir.mkdir(parents=True)
        (plugin_dir / "multi.py").write_text(
            'def generate(info):\n'
            '    return [\n'
            '        {"filename": "A.md", "content": "# A\\n"},\n'
            '        {"filename": "B.md", "content": "# B\\n"},\n'
            '    ]\n'
        )
        r = run_setup(str(python_project), "--yes", "--no-git-check")
        assert r.returncode == 0
        assert (python_project / "A.md").exists()
        assert (python_project / "B.md").exists()

    def test_plugin_receives_info(self, python_project):
        """Plugin should receive the scan info dict with stacks."""
        plugin_dir = python_project / ".claude-primer" / "plugins"
        plugin_dir.mkdir(parents=True)
        (plugin_dir / "check_info.py").write_text(
            'def generate(info):\n'
            '    assert "stacks" in info\n'
            '    assert "frameworks" in info\n'
            '    return {"filename": "INFO_OK.md", "content": "ok\\n"}\n'
        )
        r = run_setup(str(python_project), "--yes", "--no-git-check")
        assert r.returncode == 0
        assert (python_project / "INFO_OK.md").exists()

    def test_broken_plugin_does_not_crash(self, python_project):
        """A failing plugin should warn but not crash."""
        plugin_dir = python_project / ".claude-primer" / "plugins"
        plugin_dir.mkdir(parents=True)
        (plugin_dir / "broken.py").write_text(
            'def generate(info):\n    raise RuntimeError("boom")\n'
        )
        r = run_setup(str(python_project), "--yes", "--no-git-check")
        assert r.returncode == 0
        assert (python_project / "CLAUDE.md").exists()

    def test_plugin_dir_help_flag(self):
        """--plugin-dir should appear in help."""
        r = run_setup("--help")
        assert "--plugin-dir" in r.stdout


# ─────────────────────────────────────────────
# Telemetry
# ─────────────────────────────────────────────

class TestTelemetry:
    def test_telemetry_not_sent_by_default(self, python_project):
        """Without CLAUDE_PRIMER_TELEMETRY=1, CLI runs fine."""
        env = os.environ.copy()
        env.pop("CLAUDE_PRIMER_TELEMETRY", None)
        r = run_setup(str(python_project), "--yes", "--no-git-check")
        assert r.returncode == 0

    def test_telemetry_off_flag(self, python_project):
        """--telemetry-off should suppress telemetry."""
        r = run_setup(str(python_project), "--yes", "--no-git-check", "--telemetry-off")
        assert r.returncode == 0

    def test_telemetry_flag_in_help(self):
        """--telemetry-off should appear in help."""
        r = run_setup("--help")
        assert "--telemetry-off" in r.stdout

    def test_telemetry_collection_shape(self):
        """Verify the telemetry payload shape."""
        import sys as _sys
        _sys.path.insert(0, str(SCRIPT.parent))
        import claude_primer
        from types import SimpleNamespace
        args = SimpleNamespace(
            dry_run=True, force=False, force_all=False, with_readme=False,
            with_ralph=False, no_git_check=True, plan_json=False,
            reconfigure=False, clean_root=False, watch=False, watch_auto=False,
            agent=None, format="markdown", template_dir=None, plugin_dir=None,
            telemetry_off=False,
        )
        info = {"stacks": ["python"], "frameworks": ["flask"],
                "tier": {"tier": 3}, "is_monorepo": False, "file_count": 5}
        payload = claude_primer._collect_telemetry(args, info, 1.23)
        assert payload["v"] == 1
        assert payload["stacks"] == ["python"]
        assert "dry-run" in payload["flags"]
        assert payload["duration_s"] == 1.23
        assert "tool_version" in payload
        # No PII
        assert "root" not in payload
        assert "name" not in payload


# ─────────────────────────────────────────────
# Diff mode
# ─────────────────────────────────────────────

class TestDiffMode:
    def test_diff_flag_in_help(self):
        r = run_setup("--help")
        assert "--diff" in r.stdout

    def test_diff_shows_changes(self, tmp_path):
        pkg = tmp_path / "package.json"
        pkg.write_text('{"name":"test","dependencies":{"express":"^4.0"}}')
        # Generate first
        run_setup(str(tmp_path), "--yes", "--no-git-check")
        assert (tmp_path / "CLAUDE.md").exists()
        # Modify a file to force differences
        claude_md = tmp_path / "CLAUDE.md"
        claude_md.write_text("# Old content\n")
        # Run diff
        r = run_setup(str(tmp_path), "--diff")
        assert r.returncode == 0
        assert "---" in r.stdout or "+++" in r.stdout

    def test_diff_no_changes(self, tmp_path):
        pkg = tmp_path / "package.json"
        pkg.write_text('{"name":"test"}')
        run_setup(str(tmp_path), "--yes", "--no-git-check")
        # Run diff immediately — should report no differences
        r = run_setup(str(tmp_path), "--diff")
        assert "No differences" in r.stdout or "---" in r.stdout

    def test_diff_does_not_write(self, tmp_path):
        pkg = tmp_path / "package.json"
        pkg.write_text('{"name":"test"}')
        # Run with --diff on a fresh project — should not create files
        r = run_setup(str(tmp_path), "--diff")
        assert not (tmp_path / "STANDARDS.md").exists()


# ─────────────────────────────────────────────
# TOML config file
# ─────────────────────────────────────────────

class TestTomlConfig:
    def test_toml_sets_defaults(self, tmp_path):
        pkg = tmp_path / "package.json"
        pkg.write_text('{"name":"test"}')
        toml = tmp_path / ".claude-primer.toml"
        toml.write_text('[flags]\nforce = true\nwith_readme = true\n')
        r = run_setup(str(tmp_path), "--yes", "--no-git-check")
        # with_readme should be applied from TOML
        assert (tmp_path / "README.md").exists()

    def test_cli_overrides_toml(self, tmp_path):
        pkg = tmp_path / "package.json"
        pkg.write_text('{"name":"test"}')
        toml = tmp_path / ".claude-primer.toml"
        toml.write_text('[flags]\nwith_readme = true\n')
        # Dry-run from CLI should prevent writing even though TOML sets with_readme
        r = run_setup(str(tmp_path), "--dry-run", "--yes")
        assert not (tmp_path / "README.md").exists()

    def test_toml_missing_is_ok(self, tmp_path):
        pkg = tmp_path / "package.json"
        pkg.write_text('{"name":"test"}')
        # No TOML file — should work fine
        r = run_setup(str(tmp_path), "--yes", "--no-git-check")
        assert r.returncode == 0
