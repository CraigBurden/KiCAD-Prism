"""Adding a KiCad .gitignore to a project that hasn't got one.

A project that was imported, or started outside Prism, often has none, and then git
reports KiCad's churn as uncommitted work forever: caches, lock files, backups, fetched
libraries. That is not
cosmetic. It makes "you have uncommitted changes" meaningless, so the user learns to
ignore the warning for the one time it matters, and it makes "discard my changes"
ill-defined, because the pile is churn and design work mixed together.
"""

import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from prism_agent import gitignore  # noqa: E402
from prism_agent.gitignore import IgnoreError  # noqa: E402


def git(*args, cwd, check=True):
    return subprocess.run(
        ["git", *args], cwd=str(cwd), capture_output=True, text=True, check=check
    )


@pytest.fixture
def repo(tmp_path):
    """An imported KiCad project: real files, KiCad's churn, and no .gitignore."""
    path = tmp_path / "board"
    path.mkdir()
    git("init", "-b", "main", cwd=path)
    git("config", "user.email", "t@t.t", cwd=path)
    git("config", "user.name", "T", cwd=path)
    (path / "board.kicad_pcb").write_text("(kicad_pcb)")
    git("add", "-A", cwd=path)
    git("commit", "-m", "first", cwd=path)

    # The churn, exactly as KiCad leaves it.
    (path / "fp-info-cache").write_text("regenerated")
    (path / "~board.kicad_pcb.lck").write_text("open in kicad")
    (path / "board-backups").mkdir()
    (path / "board-backups" / "old.zip").write_text("archive")
    (path / "RemoteLibrary").mkdir()
    (path / "RemoteLibrary" / "part.kicad_sym").write_text("fetched")
    return path


# -- what it would do ------------------------------------------------------


def test_it_reports_what_would_be_silenced(repo):
    state = gitignore.status(repo)

    assert state["has_gitignore"] is False
    assert "fp-info-cache" in state["would_ignore"]
    assert any("lck" in p for p in state["would_ignore"])
    assert any("backups" in p for p in state["would_ignore"])


def test_looking_leaves_no_gitignore_behind(repo):
    """status() is read-only. It writes one to ask git what would be ignored, and must
    clean up: a project the user only LOOKED at must be unchanged."""
    before = sorted(p.name for p in repo.iterdir())
    gitignore.status(repo)
    assert sorted(p.name for p in repo.iterdir()) == before


def test_a_project_that_already_has_one_is_left_alone(repo):
    (repo / ".gitignore").write_text("*.zip\n")

    state = gitignore.status(repo)
    assert state["has_gitignore"] is True
    # And we do not offer to "help".
    assert state["would_ignore"] == []


def test_a_folder_that_is_not_a_repo_reports_nothing(tmp_path):
    plain = tmp_path / "plain"
    plain.mkdir()
    assert gitignore.status(plain)["is_repo"] is False


# -- adding it -------------------------------------------------------------


def test_adding_it_silences_the_churn(repo):
    result = gitignore.add(repo)

    assert (repo / ".gitignore").is_file()
    assert result["silenced"]

    # git agrees: none of it is reported any more.
    left = git("status", "--porcelain", cwd=repo).stdout
    assert "fp-info-cache" not in left
    assert "lck" not in left
    assert "backups" not in left


def test_the_users_own_files_are_untouched(repo):
    """The point is to silence what KiCad generates, not to hide the user's work."""
    (repo / "notes.md").write_text("mine")
    (repo / "assets").mkdir()
    (repo / "assets" / "render.png").write_text("mine")

    gitignore.add(repo)

    left = git("status", "--porcelain", cwd=repo).stdout
    assert "notes.md" in left
    assert "assets" in left


def test_the_marker_is_not_ignored(repo):
    """`.prism.json` is OURS and is meant to be committed: it is what lets any checkout
    identify itself. is_noise filters it from change lists; ignoring it would break
    identity."""
    (repo / ".prism.json").write_text('{"project": {"id": "prj_a"}}')

    gitignore.add(repo)

    left = git("status", "--porcelain", cwd=repo).stdout
    assert ".prism.json" in left


def test_it_never_overwrites_an_existing_one(repo):
    """Theirs, and possibly hand-tuned. Merging two ignore files sensibly is not a thing
    we can do, and appending our block would be presumptuous."""
    (repo / ".gitignore").write_text("# mine\n*.zip\n")

    with pytest.raises(IgnoreError, match="already has a .gitignore"):
        gitignore.add(repo)

    assert (repo / ".gitignore").read_text() == "# mine\n*.zip\n"


def test_it_does_not_commit(repo):
    """Writing a file is easy to undo. Committing on someone's behalf is a change to
    shared history they did not ask for."""
    before = git("rev-parse", "HEAD", cwd=repo).stdout.strip()

    result = gitignore.add(repo)

    assert result["committed"] is False
    assert git("rev-parse", "HEAD", cwd=repo).stdout.strip() == before
    # It is sitting there, uncommitted, for the user to review.
    assert ".gitignore" in git("status", "--porcelain", cwd=repo).stdout


def test_adding_to_a_non_repo_is_refused(tmp_path):
    plain = tmp_path / "plain"
    plain.mkdir()
    with pytest.raises(IgnoreError, match="not a git repository"):
        gitignore.add(plain)


# -- the already-tracked problem -------------------------------------------


def test_a_file_that_is_already_committed_is_reported(repo):
    """A .gitignore does NOT untrack anything. Saying "added, you're all set" while a
    .kicad_prl keeps appearing in every change list would be a small lie."""
    (repo / "board.kicad_prl").write_text("per-user state")
    git("add", "-f", "board.kicad_prl", cwd=repo)
    git("commit", "-m", "committed the prl", cwd=repo)

    assert "board.kicad_prl" in gitignore.status(repo)["already_tracked"]


def test_an_already_committed_file_is_never_untracked(repo):
    """Somebody chose to commit it. An ignore rule does not argue with that, and neither
    do we: reversing another team's decision is not ours to do, even with a prompt."""
    (repo / "board.kicad_prl").write_text("per-user state")
    git("add", "-f", "board.kicad_prl", cwd=repo)
    git("commit", "-m", "committed the prl", cwd=repo)

    result = gitignore.add(repo)

    assert "board.kicad_prl" in git("ls-files", cwd=repo).stdout
    # And we say so, rather than implying everything is now quiet.
    assert "board.kicad_prl" in result["still_tracked"]


def test_an_uncommitted_prl_is_silenced(repo):
    """The common case: KiCad writes one, nobody committed it, and it churns on every
    open and close."""
    (repo / "board.kicad_prl").write_text("per-user state")

    gitignore.add(repo)

    assert "kicad_prl" not in git("status", "--porcelain", cwd=repo).stdout


# -- the shared patterns ---------------------------------------------------


def test_the_gitignore_is_the_shared_one_not_a_copy(repo):
    """The patterns live beside the noise filter that hides the same files from the
    history. Two copies would drift the first time KiCad changes a suffix, and then
    Prism would hide a file in the history while git kept reporting it as your work."""
    from prism_agent.gitignore import gitignore as agent_gitignore

    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
    from app.services.kicad_noise_service import GITIGNORE as canonical

    assert agent_gitignore() == canonical


def test_what_the_gitignore_silences_is_what_is_noise(repo):
    """The two must agree. A file the .gitignore hides but is_noise calls design work
    (or the reverse) is exactly the drift this sharing exists to prevent."""
    from prism_agent.worktree_diff import _is_noise

    for path in gitignore.status(repo)["would_ignore"]:
        assert _is_noise(path), f"{path} is ignored but not classified as noise"


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
