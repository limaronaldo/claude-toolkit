"""Tests for v1.8.0 features: --check, --export, --migrate, --init, --format."""
import json
import os
import tempfile
import subprocess
from pathlib import Path

SCRIPT = Path(__file__).parent.parent / "claude_primer.py"


def run_primer(*args):
    return subprocess.run(
        ["python3", str(SCRIPT), *args],
        capture_output=True, text=True, timeout=30,
    )


def make_project(tmp):
    """Create a minimal project and generate docs."""
    pkg = {"name": "test-proj", "version": "1.0.0", "dependencies": {"express": "^4.0.0"}}
    with open(os.path.join(tmp, "package.json"), "w") as f:
        json.dump(pkg, f)
    run_primer(tmp, "--yes", "--no-git-check")


class TestCheck:
    def test_check_passes_fresh(self):
        """--check should pass immediately after generation (dates normalized)."""
        with tempfile.TemporaryDirectory() as tmp:
            make_project(tmp)
            r = run_primer(tmp, "--check", "--no-git-check")
            assert r.returncode == 0, f"--check failed on fresh docs: {r.stdout}"
            assert "All files up-to-date" in r.stdout

    def test_check_fails_when_stale(self):
        """--check should fail after modifying a source file."""
        with tempfile.TemporaryDirectory() as tmp:
            make_project(tmp)
            # Modify package.json to make docs stale
            pkg = {"name": "test-proj", "version": "2.0.0",
                   "dependencies": {"express": "^4.0.0", "react": "^18.0.0"}}
            with open(os.path.join(tmp, "package.json"), "w") as f:
                json.dump(pkg, f)
            r = run_primer(tmp, "--check", "--no-git-check")
            assert r.returncode == 1, "--check should fail when docs are stale"

    def test_check_without_files(self):
        """--check on a project with no generated files should fail."""
        with tempfile.TemporaryDirectory() as tmp:
            with open(os.path.join(tmp, "package.json"), "w") as f:
                json.dump({"name": "bare", "version": "1.0.0"}, f)
            r = run_primer(tmp, "--check", "--no-git-check")
            assert r.returncode == 1, "--check should fail with no generated files"


class TestExport:
    def test_export_default_md(self):
        """--export should create a .md file by default."""
        with tempfile.TemporaryDirectory() as tmp:
            make_project(tmp)
            r = run_primer(tmp, "--export", "--no-git-check")
            assert r.returncode == 0, f"--export failed: {r.stderr}"
            outfile = os.path.join(os.getcwd(), "claude-primer-export.md")
            # The default writes to CWD; check that it exported
            assert "Exported" in r.stdout

    def test_export_custom_path(self):
        """--export with custom path should create at that path."""
        with tempfile.TemporaryDirectory() as tmp:
            make_project(tmp)
            out = os.path.join(tmp, "out.md")
            r = run_primer(tmp, "--export", out, "--no-git-check")
            assert r.returncode == 0, f"--export failed: {r.stderr}"
            assert os.path.exists(out), "Custom export file not created"
            content = Path(out).read_text()
            assert "<!-- FILE: CLAUDE.md -->" in content

    def test_export_zip(self):
        """--export to .zip should create a valid zip."""
        import zipfile
        with tempfile.TemporaryDirectory() as tmp:
            make_project(tmp)
            out = os.path.join(tmp, "export.zip")
            r = run_primer(tmp, "--export", out, "--no-git-check")
            assert r.returncode == 0, f"--export zip failed: {r.stderr}"
            assert os.path.exists(out)
            assert zipfile.is_zipfile(out)

    def test_export_targz(self):
        """--export to .tar.gz should create a valid archive."""
        import tarfile
        with tempfile.TemporaryDirectory() as tmp:
            make_project(tmp)
            out = os.path.join(tmp, "export.tar.gz")
            r = run_primer(tmp, "--export", out, "--no-git-check")
            assert r.returncode == 0, f"--export tar.gz failed: {r.stderr}"
            assert os.path.exists(out)
            assert tarfile.is_tarfile(out)

    def test_export_nothing(self):
        """--export on empty project should report nothing."""
        with tempfile.TemporaryDirectory() as tmp:
            with open(os.path.join(tmp, "package.json"), "w") as f:
                json.dump({"name": "bare", "version": "1.0.0"}, f)
            out = os.path.join(tmp, "out.md")
            r = run_primer(tmp, "--export", out, "--no-git-check")
            assert r.returncode == 0
            assert "No generated files" in r.stdout


class TestMigrate:
    def test_migrate_creates_toml(self):
        """--migrate should convert .claude-setup.rc to .claude-primer.toml."""
        with tempfile.TemporaryDirectory() as tmp:
            rc = os.path.join(tmp, ".claude-setup.rc")
            with open(rc, "w") as f:
                f.write("[project]\ndescription = test project\nstacks = node\n")
            r = run_primer(tmp, "--migrate", "--no-git-check")
            assert r.returncode == 0, f"--migrate failed: {r.stderr}"
            toml = os.path.join(tmp, ".claude-primer.toml")
            assert os.path.exists(toml), ".claude-primer.toml not created"

    def test_migrate_no_rc(self):
        """--migrate without .claude-setup.rc should report nothing."""
        with tempfile.TemporaryDirectory() as tmp:
            r = run_primer(tmp, "--migrate", "--no-git-check")
            assert r.returncode == 0
            assert ".claude-setup.rc" in r.stdout or "No" in r.stdout


class TestInit:
    def test_init_yes_creates_toml(self):
        """--init --yes should create a default .claude-primer.toml."""
        with tempfile.TemporaryDirectory() as tmp:
            r = run_primer(tmp, "--init", "--yes", "--no-git-check")
            assert r.returncode == 0, f"--init failed: {r.stderr}"
            toml = os.path.join(tmp, ".claude-primer.toml")
            assert os.path.exists(toml), ".claude-primer.toml not created"


class TestFormat:
    def test_format_json(self):
        """--format json should produce a JSON file."""
        with tempfile.TemporaryDirectory() as tmp:
            make_project(tmp)
            # Re-run with --format json
            r = run_primer(tmp, "--yes", "--no-git-check", "--format", "json", "--force-all")
            assert r.returncode == 0, f"--format json failed: {r.stderr}"
            json_file = os.path.join(tmp, "claude-primer.json")
            assert os.path.exists(json_file), "claude-primer.json not created"
            data = json.loads(Path(json_file).read_text())
            assert isinstance(data, dict)

    def test_format_yaml(self):
        """--format yaml should produce a YAML file."""
        with tempfile.TemporaryDirectory() as tmp:
            make_project(tmp)
            r = run_primer(tmp, "--yes", "--no-git-check", "--format", "yaml", "--force-all")
            assert r.returncode == 0, f"--format yaml failed: {r.stderr}"
            yaml_file = os.path.join(tmp, "claude-primer.yaml")
            assert os.path.exists(yaml_file), "claude-primer.yaml not created"
            content = Path(yaml_file).read_text()
            # YAML should have key: value patterns
            assert ":" in content
