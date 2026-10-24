"""Moving a working tree to a specific revision, without destroying anything.

The rule every one of these tests is really about: **never destroy work the user cannot
get back.** A commit is recoverable from git. An uncommitted edit to a board is not.

So anything that would discard uncommitted changes is REFUSED, with a reason, rather
than done with a warning. `git checkout` itself is not this careful: it will carry dirty
files onto another branch, and `git checkout -f` deletes them without a word.

The other half is the ECAD constraint: a .kicad_pcb is an s-expression tree and cannot
be three-way merged textually. Git will happily produce a board neither author drew, so
`pull` is fast-forward only and a divergence is an error, not a merge commit.
"""

import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from prism_agent import checkout  # noqa: E402
from prism_agent.checkout import CheckoutError  # noqa: E402


def git(*args, cwd, check=True):
    return subprocess.run(
        ["git", *args], cwd=str(cwd), capture_output=True, text=True, check=check
    )


def commit(repo: Path, filename: str, content: str, message: str) -> str:
    (repo / filename).write_text(content)
    git("add", "-A", cwd=repo)
    git("commit", "-m", message, cwd=repo)
    return git("rev-parse", "HEAD", cwd=repo).stdout.strip()


class Repo(type(Path())):
    """A Path that also remembers the shas of the commits we made in it."""

    first: str = ""
    second: str = ""
    with_cache: str = ""


@pytest.fixture
def repo(tmp_path):
    """A board repo with two commits on main."""
    path = Repo(tmp_path / "board")
    path.mkdir()
    git("init", "-b", "main", cwd=path)
    git("config", "user.email", "t@t.t", cwd=path)
    git("config", "user.name", "T", cwd=path)
    path.first = commit(path, "board.kicad_pcb", "(kicad_pcb v1)", "first")
    path.second = commit(path, "board.kicad_pcb", "(kicad_pcb v2)", "second")
    return path


# -- the guard that actually saves data ------------------------------------


def test_uncommitted_changes_block_a_checkout(repo):
    """THE one. An edited board that has not been committed cannot be recovered if it
    is overwritten, so this is a refusal, not a warning."""
    (repo / "board.kicad_pcb").write_text("(kicad_pcb work in progress)")

    state = checkout.status(repo, repo.first)
    assert state["can"] is False
    assert state["reason"] == "dirty"
    assert "uncommitted" in state["message"]

    with pytest.raises(CheckoutError, match="uncommitted"):
        checkout.checkout(repo, repo.first)

    # And the work is still there.
    assert (repo / "board.kicad_pcb").read_text() == "(kicad_pcb work in progress)"


def test_staged_but_uncommitted_changes_also_block(repo):
    (repo / "board.kicad_pcb").write_text("(kicad_pcb staged)")
    git("add", "-A", cwd=repo)

    assert checkout.status(repo, repo.first)["reason"] == "dirty"


def test_untracked_files_do_NOT_block(repo):
    """Git carries untracked files across a checkout, so they cannot be lost by one.
    Blocking on them would make the feature unusable: a KiCad project nearly always has
    some untracked output lying around."""
    (repo / "gerbers.zip").write_text("output")

    state = checkout.status(repo, repo.first)
    assert state["can"] is True
    assert state["untracked"] == ["gerbers.zip"]
    assert state["blocking"] == []

    checkout.checkout(repo, repo.first)
    # Still there afterwards.
    assert (repo / "gerbers.zip").is_file()


# -- the other refusals ----------------------------------------------------


def test_an_unknown_ref_is_refused_and_says_why(repo):
    state = checkout.status(repo, "deadbeef")
    assert state["can"] is False
    assert state["reason"] == "unknown_ref"
    # The likely cause is named, because "not found" alone sends people hunting.
    assert "not fetched" in state["message"]


def test_a_commit_not_in_this_repo_is_refused(repo, tmp_path):
    """A commit that exists, but on a branch this clone never fetched. The sha is real,
    so a naive `git checkout <sha>` fails with something cryptic."""
    other = tmp_path / "elsewhere"
    other.mkdir()
    git("init", "-b", "main", cwd=other)
    git("config", "user.email", "t@t.t", cwd=other)
    git("config", "user.name", "T", cwd=other)
    stranger = commit(other, "x.txt", "x", "a commit we never fetched")

    assert checkout.status(repo, stranger)["reason"] == "unknown_ref"


def test_a_checkout_mid_merge_is_refused(repo):
    """git's own state is half-written. Checking out now leaves the sequencer files
    behind, and the next `git merge --continue` operates on a tree that is no longer
    what it thinks it is."""
    git("checkout", "-b", "side", repo.first, cwd=repo)
    commit(repo, "board.kicad_pcb", "(kicad_pcb side)", "side edit")
    git("checkout", "main", cwd=repo)
    # Conflicting merge, left unresolved.
    git("merge", "side", cwd=repo, check=False)

    state = checkout.status(repo, repo.first)
    assert state["can"] is False
    assert state["reason"] in ("in_progress", "unmerged")
    assert "abort" in state["message"] or "Resolve" in state["message"]


def test_being_already_on_the_commit_is_reported_not_done_twice(repo):
    state = checkout.status(repo, repo.second)
    assert state["can"] is False
    assert state["reason"] == "already_here"


def test_switching_to_another_branch_at_the_same_commit_is_allowed(repo):
    """A branch freshly cut from HEAD points at the same commit, but switching to it
    still moves HEAD's ref. Refusing it as 'already here' is the 'I picked a branch and
    nothing happened' bug: the branch must be switchable even at the same commit."""
    git("branch", "side", cwd=repo)  # side == main == HEAD

    state = checkout.status(repo, "side")
    assert state["can"] is True
    assert state["reason"] == ""

    result = checkout.checkout(repo, "side")
    assert result["branch"] == "side"
    assert result["detached"] is False


def test_re_selecting_the_current_branch_is_still_a_no_op(repo):
    """The same-commit allowance is only for a DIFFERENT branch. Picking the branch you
    are already on changes nothing, so it stays 'already here'."""
    state = checkout.status(repo, "main")  # already on main
    assert state["can"] is False
    assert state["reason"] == "already_here"


def test_a_folder_that_is_not_a_repo_is_refused(tmp_path):
    plain = tmp_path / "plain"
    plain.mkdir()
    assert checkout.status(plain, "main")["reason"] == "not_a_repo"


def test_an_empty_ref_is_refused(repo):
    with pytest.raises(CheckoutError, match="No commit or branch"):
        checkout.resolve(repo, "")


# -- what a successful checkout does ---------------------------------------


def test_checking_out_a_commit_detaches_head_and_says_so(repo):
    """Detached HEAD is CORRECT for "look at this revision", but the user has to be told:
    committing here would otherwise strand the work on no branch."""
    result = checkout.checkout(repo, repo.first)

    assert result["sha"] == repo.first
    assert result["kind"] == "commit"
    assert result["detached"] is True
    assert (repo / "board.kicad_pcb").read_text() == "(kicad_pcb v1)"


def test_checking_out_a_branch_stays_attached(repo):
    """A branch is checked out by NAME, so HEAD stays attached and the user can commit
    normally afterwards."""
    git("branch", "feature", repo.first, cwd=repo)

    result = checkout.checkout(repo, "feature")
    assert result["kind"] == "branch"
    assert result["detached"] is False
    assert result["branch"] == "feature"


def test_a_tag_resolves_to_the_commit_it_points_at(repo):
    git("tag", "-a", "v1.0", repo.first, "-m", "release", cwd=repo)

    resolved = checkout.resolve(repo, "v1.0")
    assert resolved["kind"] == "tag"
    # The COMMIT, not the tag object. Checking out a tag object would be meaningless.
    assert resolved["sha"] == repo.first


def test_the_guards_are_rechecked_at_the_moment_of_acting(repo):
    """The UI may have looked a minute ago. The user could have saved a board in KiCad
    since. A stale "it was clean" is exactly how the data loss happens, so checkout()
    re-checks rather than trusting what it was told."""
    clean = checkout.status(repo, repo.first)
    assert clean["can"] is True

    # ... and now they edit the board.
    (repo / "board.kicad_pcb").write_text("(kicad_pcb just saved)")

    with pytest.raises(CheckoutError, match="uncommitted"):
        checkout.checkout(repo, repo.first)


# -- pulling ---------------------------------------------------------------


@pytest.fixture
def clone(repo, tmp_path):
    """A clone of `repo`, so there is a real upstream to pull from."""
    dest = tmp_path / "clone"
    git("clone", str(repo), str(dest), cwd=tmp_path)
    git("config", "user.email", "c@c.c", cwd=dest)
    git("config", "user.name", "C", cwd=dest)
    return dest


def test_pull_fast_forwards(repo, clone):
    commit(repo, "board.kicad_pcb", "(kicad_pcb v3)", "third")

    result = checkout.pull(clone)
    assert result["changed"] is True
    assert result["pulled"] == 1
    assert (clone / "board.kicad_pcb").read_text() == "(kicad_pcb v3)"


def test_pull_with_nothing_to_do_says_so(clone):
    result = checkout.pull(clone)
    assert result["changed"] is False
    assert "up to date" in result["message"]


def test_a_diverged_branch_is_refused_rather_than_merged(repo, clone):
    """THE ECAD constraint. Both sides changed the board. A textual three-way merge of an
    s-expression tree produces a file NEITHER author drew, and git will do it happily.
    That is silent board corruption, which is worse than any error message."""
    commit(repo, "board.kicad_pcb", "(kicad_pcb theirs)", "their edit")
    commit(clone, "board.kicad_pcb", "(kicad_pcb mine)", "my edit")

    with pytest.raises(CheckoutError, match="cannot be merged automatically"):
        checkout.pull(clone)

    # Nothing was merged, and the local work is intact.
    assert (clone / "board.kicad_pcb").read_text() == "(kicad_pcb mine)"


def test_the_divergence_message_names_both_sides(repo, clone):
    commit(repo, "board.kicad_pcb", "(kicad_pcb theirs)", "their edit")
    commit(clone, "board.kicad_pcb", "(kicad_pcb mine)", "my edit")

    with pytest.raises(CheckoutError) as exc:
        checkout.pull(clone)
    # "you are 1 ahead and 1 behind" is actionable. "cannot pull" is not.
    assert "1 local" in str(exc.value)
    assert "1 remote" in str(exc.value)


def test_pull_refuses_to_clobber_uncommitted_work(repo, clone):
    commit(repo, "board.kicad_pcb", "(kicad_pcb v3)", "third")
    (clone / "board.kicad_pcb").write_text("(kicad_pcb work in progress)")

    with pytest.raises(CheckoutError, match="would be overwritten"):
        checkout.pull(clone)

    assert (clone / "board.kicad_pcb").read_text() == "(kicad_pcb work in progress)"


def test_pull_on_a_detached_head_is_refused(clone):
    """There is no branch to pull into. `git pull` here does something surprising, so
    say plainly what the user has to do."""
    head = git("rev-parse", "HEAD~1", cwd=clone).stdout.strip()
    git("checkout", head, cwd=clone)

    with pytest.raises(CheckoutError, match="not on a branch"):
        checkout.pull(clone)


def test_pull_with_no_upstream_is_refused(repo):
    """A local-only branch has nothing to pull FROM."""
    git("checkout", "-b", "local-only", cwd=repo)
    with pytest.raises(CheckoutError, match="not tracking"):
        checkout.pull(repo)


def test_pull_mid_operation_is_refused(repo, clone):
    git("checkout", "-b", "side", "HEAD~1", cwd=clone)
    commit(clone, "board.kicad_pcb", "(kicad_pcb side)", "side")
    git("checkout", "main", cwd=clone)
    git("merge", "side", cwd=clone, check=False)  # leaves a conflict

    with pytest.raises(CheckoutError):
        checkout.pull(clone)


# -- an untracked file the target ALSO has ---------------------------------
#
# The hole in "untracked files always survive a checkout": they survive only if the
# target does not contain a file of the same name. If it does, git refuses outright and
# prints "Aborting", which names neither the file nor the way out.
#
# Real, not hypothetical: a KiCad project routinely has fp-info-cache untracked in one
# checkout and committed in another, and that alone aborts every attempt to open a commit.


@pytest.fixture
def collision(repo):
    """A repo where `fp-info-cache` is committed on main but untracked in the tree."""
    commit(repo, "fp-info-cache", "committed version", "add the cache")
    # Remove it from tracking, but leave a local copy behind: exactly the state a KiCad
    # project ends up in.
    git("rm", "--cached", "fp-info-cache", cwd=repo)
    git("commit", "-m", "stop tracking the cache", cwd=repo)
    (repo / "fp-info-cache").write_text("my local cache")
    repo.with_cache = git("rev-parse", "HEAD~1", cwd=repo).stdout.strip()
    return repo


def test_an_untracked_file_the_target_has_is_caught_before_git_aborts(collision):
    """Git's own message is "Aborting", which is useless. Ours has to name the file and
    the way out."""
    state = checkout.status(collision, collision.with_cache)

    assert state["can"] is False
    assert state["reason"] == "untracked_collision"
    assert state["clobbered"] == ["fp-info-cache"]
    assert "fp-info-cache" in state["message"]


def test_the_collision_does_not_abort_when_stashing(collision):
    """The bug the user hit. The guard said "can proceed" (nothing is *modified*), then
    git refused, and all they saw was "Aborting"."""
    result = checkout.checkout(
        collision, collision.with_cache, stash_message="my cache"
    )

    assert result["sha"] == collision.with_cache
    assert "fp-info-cache" in result["stashed"]["stashed"]
    # The committed version is now in the tree.
    assert (collision / "fp-info-cache").read_text() == "committed version"


def test_the_local_untracked_version_is_recoverable(collision):
    checkout.checkout(collision, collision.with_cache, stash_message="my cache")
    checkout.checkout(collision, "main")
    checkout.restore(collision)

    assert (collision / "fp-info-cache").read_text() == "my local cache"


def test_only_the_colliding_untracked_files_are_swept_up(collision):
    """NOT --include-untracked. Sweeping up someone's gerber exports and 3D renders
    because they happened to be lying around is taking something we did not need to take,
    and they would find them gone with no visible reason why."""
    (collision / "gerbers.zip").write_text("my exports")
    (collision / "render.png").write_text("my render")

    checkout.checkout(collision, collision.with_cache, stash_message="my cache")

    assert (collision / "gerbers.zip").read_text() == "my exports"
    assert (collision / "render.png").read_text() == "my render"


def test_an_untracked_file_the_target_does_NOT_have_still_never_blocks(repo):
    """The common case must stay unblocked, or the feature is unusable: a KiCad project
    almost always has some untracked output lying around."""
    (repo / "gerbers.zip").write_text("output")

    state = checkout.status(repo, repo.first)
    assert state["can"] is True
    assert state["clobbered"] == []


# -- discarding uncommitted work -------------------------------------------
#
# The harshest thing in the module. A stash can be fished back out with `git stash apply
# <sha>` for a while; a discarded edit to a board is gone the instant it runs. So the
# tests are mostly about it doing EXACTLY what was asked and nothing more.


def test_discarding_restores_the_committed_version(repo):
    (repo / "board.kicad_pcb").write_text("(kicad_pcb a failed experiment)")

    result = checkout.discard(repo)

    assert result["discarded"] == ["board.kicad_pcb"]
    assert (repo / "board.kicad_pcb").read_text() == "(kicad_pcb v2)"


def test_discarding_lets_a_blocked_checkout_proceed(repo):
    (repo / "board.kicad_pcb").write_text("(kicad_pcb a failed experiment)")

    result = checkout.checkout(repo, repo.first, discard_changes=True)

    assert result["sha"] == repo.first
    assert result["discarded"]["count"] == 1
    assert (repo / "board.kicad_pcb").read_text() == "(kicad_pcb v1)"
    # Nothing was stashed: discard means gone, not hidden.
    assert checkout.stashes(repo) == []


def test_discarding_leaves_untracked_files_alone(repo):
    """It clears what BLOCKS the move. Deleting somebody's gerber exports because they
    happened to be lying next to the board would be indefensible, and unlike a stash
    there is nothing to undo it with."""
    (repo / "board.kicad_pcb").write_text("(kicad_pcb wip)")
    (repo / "gerbers.zip").write_text("my exports")

    checkout.discard(repo)

    assert (repo / "gerbers.zip").read_text() == "my exports"


def test_discarding_deletes_only_the_colliding_untracked_files(repo):
    """An untracked file the target ALSO has has no committed version to restore, so the
    only way past it is deletion. Only that one, though."""
    commit(repo, "fp-info-cache", "committed cache", "add the cache")
    git("rm", "--cached", "fp-info-cache", cwd=repo)
    git("commit", "-m", "stop tracking it", cwd=repo)
    with_cache = git("rev-parse", "HEAD~1", cwd=repo).stdout.strip()
    (repo / "fp-info-cache").write_text("my local cache")
    (repo / "gerbers.zip").write_text("my exports")

    result = checkout.checkout(repo, with_cache, discard_changes=True)

    assert result["discarded"]["deleted"] == ["fp-info-cache"]
    assert (repo / "gerbers.zip").read_text() == "my exports"  # untouched


def test_discarding_nothing_is_refused(repo):
    """A no-op that reports success teaches people the button does nothing."""
    with pytest.raises(CheckoutError, match="no uncommitted changes"):
        checkout.discard(repo)


def test_without_an_explicit_yes_nothing_is_discarded(repo):
    """The default is still a refusal. Destroying someone's board needs an explicit
    request, not an absent argument."""
    (repo / "board.kicad_pcb").write_text("(kicad_pcb precious)")

    with pytest.raises(CheckoutError, match="uncommitted"):
        checkout.checkout(repo, repo.first)

    assert (repo / "board.kicad_pcb").read_text() == "(kicad_pcb precious)"


def test_discard_cannot_rescue_a_mid_operation_checkout(repo):
    """Same as stash: git would refuse anyway, and discarding on top of a half-finished
    merge turns a recoverable mess into an unrecoverable one."""
    git("checkout", "-b", "side", repo.first, cwd=repo)
    commit(repo, "board.kicad_pcb", "(kicad_pcb side)", "side edit")
    git("checkout", "main", cwd=repo)
    git("merge", "side", cwd=repo, check=False)  # leaves a conflict

    with pytest.raises(CheckoutError):
        checkout.checkout(repo, repo.first, discard_changes=True)


def test_discarding_reports_what_it_destroyed(repo):
    """ "Discarded 2 files" is checkable. "Done" is not."""
    commit(repo, "notes.md", "notes", "add notes")
    # Now dirty BOTH, so there are two things to lose.
    (repo / "board.kicad_pcb").write_text("(kicad_pcb wip)")
    (repo / "notes.md").write_text("edited")

    result = checkout.discard(repo)

    assert sorted(result["discarded"]) == ["board.kicad_pcb", "notes.md"]
    assert result["count"] == 2


# -- stashing: the way out of the dirty guard ------------------------------


def test_stashing_lets_a_blocked_checkout_proceed(repo):
    """Refusing was correct but a dead end: the user was told to commit or stash, then
    had to leave and do it by hand. This is the way forward."""
    (repo / "board.kicad_pcb").write_text("(kicad_pcb work in progress)")

    result = checkout.checkout(repo, repo.first, stash_message="my track routing")

    assert result["sha"] == repo.first
    assert result["stashed"]["count"] == 1
    # The tree really moved.
    assert (repo / "board.kicad_pcb").read_text() == "(kicad_pcb v1)"


def test_the_stashed_work_is_recoverable(repo):
    (repo / "board.kicad_pcb").write_text("(kicad_pcb work in progress)")
    checkout.checkout(repo, repo.first, stash_message="my track routing")

    # Back to where we were, then bring it back.
    checkout.checkout(repo, "main")
    checkout.restore(repo)

    assert (repo / "board.kicad_pcb").read_text() == "(kicad_pcb work in progress)"


def test_the_message_is_what_makes_a_stash_findable(repo):
    """Git's default is "WIP on main: a1b2c3d", which says nothing about what is in it.
    After two of those nobody knows which board they were editing."""
    (repo / "board.kicad_pcb").write_text("(kicad_pcb work in progress)")
    checkout.checkout(repo, repo.first, stash_message="rerouting the power rail")

    entries = checkout.stashes(repo)
    assert len(entries) == 1
    assert entries[0]["message"] == "rerouting the power rail"
    assert entries[0]["ours"] is True


def test_a_stash_records_the_branch_it_came_from(repo):
    """git stashes are a global stack, not per-branch. Recording the origin is what lets
    the agent offer to bring the work back on return, instead of leaving it forgotten."""
    (repo / "board.kicad_pcb").write_text("(kicad_pcb work in progress)")
    checkout.checkout(repo, repo.first, stash_message="power rail")

    entry = checkout.stashes(repo)[0]
    # The user's message is clean; the origin is parsed back out separately.
    assert entry["message"] == "power rail"
    assert entry["origin_branch"] == "main"
    assert entry["origin_sha"]  # the short sha of where it was taken from


def test_find_returnable_stash_matches_the_origin_branch(repo):
    (repo / "board.kicad_pcb").write_text("(kicad_pcb work in progress)")
    checkout.checkout(repo, repo.first, stash_message="power rail")

    # Detached on a commit now; the work belongs to main.
    match = checkout.find_returnable_stash(repo, "main")
    assert match is not None
    assert match["message"] == "power rail"
    # No stash claims a branch we never set one aside from.
    assert checkout.find_returnable_stash(repo, "some-other-branch") is None


def test_the_origin_round_trip_survives_special_characters(repo):
    """The user's message can contain the very brackets we use to encode the origin. The
    decoder must not mistake their text for the origin tag."""
    (repo / "board.kicad_pcb").write_text("(kicad_pcb wip)")
    checkout.checkout(
        repo, repo.first, stash_message="fix [regulator] and [caps]"
    )
    entry = checkout.stashes(repo)[0]
    assert entry["message"] == "fix [regulator] and [caps]"
    assert entry["origin_branch"] == "main"


def test_an_old_stash_without_an_origin_still_parses(repo):
    """A stash made before origins existed, or by hand, has no origin fields, not a
    crash. `stashes()` must tolerate it."""
    (repo / "board.kicad_pcb").write_text("(kicad_pcb wip)")
    # A bare Prism-prefixed stash with no origin suffix, as an older agent wrote.
    git("stash", "push", "-m", "prism: legacy work", cwd=repo)
    entry = checkout.stashes(repo)[0]
    assert entry["message"] == "legacy work"
    assert entry["origin_branch"] == ""
    assert entry["origin_sha"] == ""


def test_an_empty_message_still_gets_something_identifiable(repo):
    (repo / "board.kicad_pcb").write_text("(kicad_pcb wip)")
    checkout.checkout(repo, repo.first, stash_message="")

    assert checkout.stashes(repo)[0]["message"] == "Uncommitted changes"


def test_without_a_message_uncommitted_changes_are_still_refused(repo):
    """Stashing moves the user's work. That needs an explicit yes, not a default."""
    (repo / "board.kicad_pcb").write_text("(kicad_pcb work in progress)")

    with pytest.raises(CheckoutError, match="uncommitted"):
        checkout.checkout(repo, repo.first)  # no stash_message at all

    assert (repo / "board.kicad_pcb").read_text() == "(kicad_pcb work in progress)"


def test_untracked_files_are_not_swept_into_the_stash(repo):
    """They survive a checkout on their own, so taking them would be taking something we
    did not need to take, and the user would find them gone for no visible reason."""
    (repo / "board.kicad_pcb").write_text("(kicad_pcb wip)")
    (repo / "gerbers.zip").write_text("output")

    checkout.checkout(repo, repo.first, stash_message="wip")

    assert (repo / "gerbers.zip").is_file()


def test_stashing_a_clean_tree_is_refused(repo):
    """An empty stash is a trap: it looks like your work is safe somewhere."""
    with pytest.raises(CheckoutError, match="no uncommitted changes"):
        checkout.stash(repo, "nothing here")


def test_a_stash_cannot_rescue_a_mid_operation_checkout(repo):
    """git would refuse anyway, and stashing on top of a half-finished merge turns a
    recoverable mess into an unrecoverable one."""
    git("checkout", "-b", "side", repo.first, cwd=repo)
    commit(repo, "board.kicad_pcb", "(kicad_pcb side)", "side edit")
    git("checkout", "main", cwd=repo)
    git("merge", "side", cwd=repo, check=False)  # leaves a conflict

    with pytest.raises(CheckoutError):
        checkout.checkout(repo, repo.first, stash_message="rescue me")


def test_restoring_onto_a_dirty_tree_is_refused(repo):
    """A conflict between a stash and a board is exactly what we cannot merge our way
    out of."""
    (repo / "board.kicad_pcb").write_text("(kicad_pcb first edit)")
    checkout.stash(repo, "first")
    (repo / "board.kicad_pcb").write_text("(kicad_pcb second edit)")

    with pytest.raises(CheckoutError, match="uncommitted"):
        checkout.restore(repo)

    # Both are intact: the stash is untouched and so is the tree.
    assert (repo / "board.kicad_pcb").read_text() == "(kicad_pcb second edit)"
    assert len(checkout.stashes(repo)) == 1


def test_a_stash_made_by_hand_is_still_listed(repo):
    """It is the user's work. Hiding it from a list titled "your stashed changes" would
    be a good way to let them destroy it."""
    (repo / "board.kicad_pcb").write_text("(kicad_pcb by hand)")
    git("stash", "push", "-m", "did this in a terminal", cwd=repo)

    entries = checkout.stashes(repo)
    assert len(entries) == 1
    assert entries[0]["message"] == "did this in a terminal"
    assert entries[0]["ours"] is False


# -- what the UI is told about a detached HEAD -----------------------------
#
# Opening a commit detaches HEAD. That is correct, but `rev-parse --abbrev-ref HEAD`
# then returns the literal string "HEAD", which is not a branch and must never be shown
# as one. The plugin's branch tag vanished and its Git card said "Not a git repository"
# for a repo that was plainly fine.


def test_a_detached_head_is_reported_as_detached_not_as_a_branch_called_HEAD(repo):
    from prism_agent.projects import git_status

    git("checkout", repo.first, cwd=repo)
    st = git_status(repo)

    assert st.detached is True
    # NOT "HEAD". That is git's placeholder, not a branch name.
    assert st.branch == ""


def test_a_detached_head_still_says_which_branch_the_commit_is_on(repo):
    """The tag vanishing made the project look like it belonged to no branch at all,
    which is alarming and false: you are on the same history, just parked earlier."""
    from prism_agent.projects import git_status

    git("checkout", repo.first, cwd=repo)
    st = git_status(repo)

    assert "main" in st.on_branches


def test_a_branch_that_has_never_been_pushed_says_so(repo, tmp_path):
    """A new branch reports ahead == 0 because there is no upstream to count against,
    which is indistinguishable from "nothing to push".

    The plugin hid its Push button on exactly that check, so a branch full of real
    commits offered no way to publish them: the work existed only on that machine and
    the UI said nothing about it.
    """
    from prism_agent.projects import git_status

    bare = tmp_path / "origin.git"
    bare.mkdir()
    git("init", "--bare", "-b", "main", cwd=bare)
    git("remote", "add", "origin", str(bare), cwd=repo)
    git("push", "-u", "origin", "main", cwd=repo)

    checkout.create_branch(repo, "feature/new")
    commit(repo, "extra.txt", "x", "work on the new branch")

    st = git_status(repo)
    assert st.has_upstream is False
    assert st.ahead == 0, "there is nothing to count against, which was the trap"
    assert st.unpublished == 1, "but there IS work here, and that is what to show"


def test_a_published_branch_reports_an_upstream(repo, tmp_path):
    from prism_agent.projects import git_status

    bare = tmp_path / "origin.git"
    bare.mkdir()
    git("init", "--bare", "-b", "main", cwd=bare)
    git("remote", "add", "origin", str(bare), cwd=repo)
    git("push", "-u", "origin", "main", cwd=repo)

    st = git_status(repo)
    assert st.has_upstream is True
    assert st.unpublished == 0, "only meaningful for a branch with no upstream"


def test_being_on_a_branch_is_not_reported_as_detached(repo):
    from prism_agent.projects import git_status

    st = git_status(repo)
    assert st.detached is False
    assert st.branch == "main"
    assert st.on_branches == []


def test_git_status_marks_the_default_branch(repo):
    """On main (the default), the UI should be told so it can say 'default'."""
    from prism_agent.projects import git_status

    st = git_status(repo)
    assert st.default_branch == "main"
    assert st.on_default is True


def test_git_status_does_not_mark_a_feature_branch_as_default(repo):
    from prism_agent.projects import git_status

    checkout.create_branch(repo, "feature/x", switch=True)
    st = git_status(repo)
    assert st.branch == "feature/x"
    assert st.default_branch == "main"
    assert st.on_default is False


def test_a_detached_head_reports_the_branch_tip_to_compare_against(repo):
    """Current commit and Latest commit, side by side. Two rows that differ say "you are
    behind" on their own; a paragraph explaining it says the same thing twice."""
    from prism_agent.projects import git_status

    git("checkout", repo.first, cwd=repo)
    st = git_status(repo)

    assert st.tip_commit == "second"
    assert st.tip_commit_hash
    assert st.tip_commit_hash != st.last_commit_hash


def test_at_the_tip_there_is_no_second_row_to_show(repo):
    from prism_agent.projects import git_status

    st = git_status(repo)
    assert st.tip_commit_hash == ""


# -- "uncommitted changes" that are not the user's -------------------------


def test_kicad_churn_is_not_reported_as_the_users_uncommitted_work(repo):
    """A KiCad project with no .gitignore is permanently "dirty": caches, lock files and
    backups are regenerated and never committed. Reporting those as "you have
    uncommitted changes" is crying wolf, and the user learns to ignore the warning for
    the one time it matters."""
    from prism_agent.projects import git_status

    (repo / "fp-info-cache").write_text("regenerated")
    (repo / "~board.kicad_pcb.lck").write_text("kicad has it open")

    st = git_status(repo)
    # git DOES see them, and the guards must keep seeing them: git blocks on a lock file
    # as readily as on a board.
    assert st.dirty is True
    # But none of it is the user's work.
    assert st.yours == []
    assert st.to_dict()["dirty_by_you"] is False


def test_a_path_with_a_space_is_not_reported_quoted(repo):
    """git QUOTES any path containing a space in --porcelain output. The quotes then
    travel into every consumer: the noise classifier fails to match its own patterns and
    calls KiCad's lock files the user's work. A project named "Git test" produces exactly
    these paths, which is how this was found."""
    from prism_agent.projects import git_status

    (repo / "~Git test.kicad_pcb.lck").write_text("kicad has it open")

    st = git_status(repo)
    assert st.untracked == ["~Git test.kicad_pcb.lck"]  # no quotes
    # And so the classifier can actually see it for what it is.
    assert st.yours == []


def test_a_renamed_file_does_not_invent_a_phantom(repo):
    """With -z, a rename emits its ORIGINAL path as a separate entry with no status
    prefix. Read as a status line, its third character onwards becomes a filename that
    does not exist."""
    from prism_agent.projects import git_status

    git("mv", "board.kicad_pcb", "renamed.kicad_pcb", cwd=repo)

    st = git_status(repo)
    assert st.staged == ["renamed.kicad_pcb"]


def test_a_real_edit_beside_the_churn_is_still_reported(repo):
    from prism_agent.projects import git_status

    (repo / "fp-info-cache").write_text("regenerated")
    (repo / "board.kicad_pcb").write_text("(kicad_pcb my work)")

    st = git_status(repo)
    assert st.yours == ["board.kicad_pcb"]
    assert st.to_dict()["dirty_by_you"] is True


def test_a_detached_head_still_reports_the_commit_it_is_on(repo):
    """The Git card needs this to say "Current commit". It also gates the whole card:
    testing `branch` instead made it claim "Not a git repository"."""
    from prism_agent.projects import git_status

    git("checkout", repo.first, cwd=repo)
    st = git_status(repo)

    assert st.last_commit_hash
    assert st.last_commit == "first"


# -- discarding ------------------------------------------------------------
#
# The one place in this module where "never destroy work the user cannot get back" is
# knowingly set aside, because the user asked for it. So it is honest about that: it
# names what it destroyed, and it reports the sha, which is a real escape hatch until
# git garbage-collects.


def test_dropping_removes_the_stash(repo):
    (repo / "board.kicad_pcb").write_text("(kicad_pcb wip)")
    checkout.stash(repo, "throwaway")

    result = checkout.drop(repo)

    assert result["message"] == "throwaway"
    assert checkout.stashes(repo) == []


def test_dropping_reports_what_it_destroyed(repo):
    """ "Discarded 1 file" is checkable. "Done" is not."""
    (repo / "board.kicad_pcb").write_text("(kicad_pcb wip)")
    checkout.stash(repo, "throwaway")

    result = checkout.drop(repo)
    assert result["files"] == ["board.kicad_pcb"]


def test_dropping_hands_back_a_sha_to_recover_with(repo):
    """A dropped stash is not immediately gone: git keeps the commit until it is
    garbage-collected. A user who has just realised their mistake deserves that rather
    than being told "Discarded." and left with nothing."""
    (repo / "board.kicad_pcb").write_text("(kicad_pcb precious)")
    checkout.stash(repo, "throwaway")

    sha = checkout.drop(repo)["sha"]
    assert sha

    # It really does still apply.
    git("stash", "apply", sha, cwd=repo)
    assert (repo / "board.kicad_pcb").read_text() == "(kicad_pcb precious)"


def test_dropping_does_not_touch_the_working_tree(repo):
    """Discarding a STASH throws away what is in the stash, not what is in the tree."""
    (repo / "board.kicad_pcb").write_text("(kicad_pcb stashed)")
    checkout.stash(repo, "throwaway")
    (repo / "board.kicad_pcb").write_text("(kicad_pcb current work)")

    checkout.drop(repo)

    assert (repo / "board.kicad_pcb").read_text() == "(kicad_pcb current work)"


def test_dropping_an_unknown_ref_is_refused_rather_than_guessed(repo):
    """Stash refs shift as entries come and go, so acting on the wrong one is easy and
    unrecoverable. Falling back to stash@{0} would be a coin flip with someone's work."""
    (repo / "board.kicad_pcb").write_text("(kicad_pcb wip)")
    checkout.stash(repo, "keep me")

    with pytest.raises(CheckoutError, match="not in the stash list"):
        checkout.drop(repo, "stash@{7}")

    assert len(checkout.stashes(repo)) == 1


def test_dropping_with_nothing_stashed_is_refused(repo):
    with pytest.raises(CheckoutError, match="nothing stashed"):
        checkout.drop(repo)


def test_dropping_a_stash_needs_no_uncommitted_changes(repo):
    """The bug the user hit, from the other side. Discard on a CLEAN tree must work:
    the stash is what you are throwing away, and the tree being clean is the normal
    state when you are looking at the Set aside card.

    (What they actually saw, "There are no uncommitted changes to stash", was a stale
    agent falling through to stash(). The route now names its action so an agent that
    does not know a verb says so instead of running the wrong one.)
    """
    (repo / "board.kicad_pcb").write_text("(kicad_pcb wip)")
    checkout.stash(repo, "throwaway")
    assert checkout.status(repo)["blocking"] == []  # tree is clean now

    result = checkout.drop(repo)
    assert result["ok"] is True


def test_dropping_takes_the_named_stash_not_the_newest(repo):
    (repo / "board.kicad_pcb").write_text("(kicad_pcb first)")
    checkout.stash(repo, "older")
    (repo / "board.kicad_pcb").write_text("(kicad_pcb second)")
    checkout.stash(repo, "newer")

    # stash@{1} is the older one; git pushes onto the front.
    checkout.drop(repo, "stash@{1}")

    remaining = checkout.stashes(repo)
    assert [e["message"] for e in remaining] == ["newer"]


# -- stashing, and pulling -------------------------------------------------


def test_stashing_lets_a_blocked_pull_proceed(repo, clone):
    commit(repo, "board.kicad_pcb", "(kicad_pcb v3)", "third")
    (clone / "board.kicad_pcb").write_text("(kicad_pcb my wip)")

    result = checkout.pull(clone, stash_message="my wip")

    assert result["changed"] is True
    assert result["stashed"]["count"] == 1
    assert (clone / "board.kicad_pcb").read_text() == "(kicad_pcb v3)"


def test_a_stash_is_put_back_when_the_pull_does_not_happen(repo, clone):
    """The trap. If we stash and then the pull turns out to be a no-op, the user's work
    has left their tree with nothing to show for it. That is their work going missing."""
    (clone / "board.kicad_pcb").write_text("(kicad_pcb my wip)")

    result = checkout.pull(clone, stash_message="my wip")  # nothing to pull

    assert result["changed"] is False
    assert result["stashed"] is None
    # Straight back where it was.
    assert (clone / "board.kicad_pcb").read_text() == "(kicad_pcb my wip)"
    assert checkout.stashes(clone) == []


def test_a_stash_is_put_back_when_the_pull_is_refused_for_divergence(repo, clone):
    commit(repo, "board.kicad_pcb", "(kicad_pcb theirs)", "their edit")
    commit(clone, "board.kicad_pcb", "(kicad_pcb mine)", "my edit")
    (clone / "board.kicad_pcb").write_text("(kicad_pcb my wip)")

    with pytest.raises(CheckoutError, match="cannot be merged automatically"):
        checkout.pull(clone, stash_message="my wip")

    # Diverged is still refused, AND the work is back in the tree, not stranded.
    assert (clone / "board.kicad_pcb").read_text() == "(kicad_pcb my wip)"
    assert checkout.stashes(clone) == []


# -- committing ------------------------------------------------------------


def test_commit_stages_all_and_records_the_message(repo):
    (repo / "board.kicad_pcb").write_text("(kicad_pcb v3)")
    (repo / "notes.md").write_text("new file")

    # stage_all_design is the explicit "commit all my work" mode.
    result = checkout.commit(repo, "reroute the power rail", stage_all_design=True)

    assert result["subject"] == "reroute the power rail"
    assert result["branch"] == "main"
    assert "board.kicad_pcb" in result["committed"]
    assert "notes.md" in result["committed"]
    # The tree is clean of design work afterwards.
    assert checkout.status(repo)["blocking"] == []


def test_commit_only_named_paths_leaves_the_rest(repo):
    (repo / "board.kicad_pcb").write_text("(kicad_pcb v3)")
    (repo / "notes.md").write_text("not this one")

    checkout.commit(repo, "just the board", paths=["board.kicad_pcb"])

    # notes.md is still uncommitted.
    dirt = checkout.dirty_files(repo)
    assert "notes.md" in dirt["untracked"]


def test_commit_refuses_an_empty_message(repo):
    (repo / "board.kicad_pcb").write_text("(kicad_pcb v3)")
    with pytest.raises(CheckoutError, match="needs a message"):
        checkout.commit(repo, "   ")


def test_commit_refuses_when_there_is_nothing_staged(repo):
    with pytest.raises(CheckoutError, match="nothing staged"):
        checkout.commit(repo, "empty")


def test_commit_refuses_on_a_detached_head_by_default(repo):
    checkout.checkout(repo, repo.first)  # detaches
    (repo / "board.kicad_pcb").write_text("(kicad_pcb detached edit)")
    with pytest.raises(CheckoutError, match="detached"):
        checkout.commit(repo, "on a detached head", stage_all_design=True)


def test_commit_allows_detached_when_explicitly_permitted(repo):
    checkout.checkout(repo, repo.first)
    (repo / "board.kicad_pcb").write_text("(kicad_pcb detached edit)")
    result = checkout.commit(
        repo, "deliberate detached commit", allow_detached=True, stage_all_design=True
    )
    assert result["branch"] == ""  # still no branch, as warned
    assert result["sha"]


# -- creating branches -----------------------------------------------------


def test_create_branch_switches_onto_it(repo):
    result = checkout.create_branch(repo, "feature/new-rail")
    assert result["branch"] == "feature/new-rail"
    assert result["switched"] is True
    assert checkout.status(repo)["current_branch"] == "feature/new-rail"


def test_create_branch_here_rescues_a_detached_commit(repo):
    """The n10 remedy: commits made on a detached HEAD are orphaned; naming a branch at
    that point keeps them."""
    checkout.checkout(repo, repo.first)
    (repo / "board.kicad_pcb").write_text("(kicad_pcb work)")
    checkout.commit(repo, "detached work", allow_detached=True, stage_all_design=True)

    checkout.create_branch(repo, "rescue")

    # Now on a real branch, with the detached commit as its tip.
    st = checkout.status(repo)
    assert st["current_branch"] == "rescue"
    assert st["detached"] is False


def test_create_branch_refuses_a_duplicate_name(repo):
    with pytest.raises(CheckoutError, match="already exists"):
        checkout.create_branch(repo, "main")


def test_create_branch_refuses_an_empty_name(repo):
    with pytest.raises(CheckoutError, match="needs a name"):
        checkout.create_branch(repo, "  ")


def test_create_branch_refuses_an_invalid_name(repo):
    with pytest.raises(CheckoutError, match="valid branch name"):
        checkout.create_branch(repo, "bad..name")


# -- fetch and push --------------------------------------------------------


@pytest.fixture
def bare_and_clone(tmp_path):
    """A bare remote and a working clone tracking it, so push has somewhere to go.

    A non-bare repo refuses a push to its checked-out branch, so the remote here is bare,
    which is what a real hosted origin is anyway.
    """
    bare = tmp_path / "origin.git"
    git("init", "--bare", "-b", "main", str(bare), cwd=tmp_path)

    work = Repo(tmp_path / "work")
    git("clone", str(bare), str(work), cwd=tmp_path)
    git("config", "user.email", "w@w.w", cwd=work)
    git("config", "user.name", "W", cwd=work)
    work.first = commit(work, "board.kicad_pcb", "(kicad_pcb v1)", "first")
    git("push", "-u", "origin", "main", cwd=work)
    return bare, work


def test_push_sends_commits_to_the_remote(bare_and_clone):
    bare, work = bare_and_clone
    commit(work, "board.kicad_pcb", "(kicad_pcb v2)", "second")

    result = checkout.push(work)
    assert result["ok"] is True
    assert result["branch"] == "main"

    # The bare remote now has the second commit.
    log = git("log", "--format=%s", "main", cwd=bare).stdout
    assert "second" in log


def test_push_refuses_to_force_over_a_diverged_remote(bare_and_clone, tmp_path):
    bare, work = bare_and_clone
    # A second clone pushes a commit the first doesn't have.
    other = tmp_path / "other"
    git("clone", str(bare), str(other), cwd=tmp_path)
    git("config", "user.email", "o@o.o", cwd=other)
    git("config", "user.name", "O", cwd=other)
    commit(other, "board.kicad_pcb", "(kicad_pcb theirs)", "theirs")
    git("push", cwd=other)

    # The first clone commits locally, now behind and ahead → non-fast-forward.
    commit(work, "board.kicad_pcb", "(kicad_pcb mine)", "mine")

    with pytest.raises(CheckoutError, match="won't force-push"):
        checkout.push(work)


def test_push_refuses_from_a_detached_head(bare_and_clone):
    bare, work = bare_and_clone
    commit(work, "board.kicad_pcb", "(kicad_pcb v2)", "second")  # so first != HEAD
    checkout.checkout(work, work.first)  # detach onto the earlier commit
    with pytest.raises(CheckoutError, match="detached"):
        checkout.push(work)


def test_push_of_an_untracked_branch_asks_to_publish(bare_and_clone):
    bare, work = bare_and_clone
    checkout.create_branch(work, "feature/x")  # no upstream yet
    with pytest.raises(CheckoutError, match="isn't tracking a remote"):
        checkout.push(work)
    # With set_upstream it publishes.
    result = checkout.push(work, set_upstream=True)
    assert result["published"] is True


def test_fetch_reports_ahead_and_behind(bare_and_clone, tmp_path):
    bare, work = bare_and_clone
    other = tmp_path / "other"
    git("clone", str(bare), str(other), cwd=tmp_path)
    git("config", "user.email", "o@o.o", cwd=other)
    git("config", "user.name", "O", cwd=other)
    commit(other, "board.kicad_pcb", "(kicad_pcb theirs)", "theirs")
    git("push", cwd=other)

    result = checkout.fetch(work)
    assert result["behind"] == 1
    assert result["ahead"] == 0
    # Fetch touched no working-tree files.
    assert (work / "board.kicad_pcb").read_text() == "(kicad_pcb v1)"


# -- listing branches and commits ------------------------------------------


def test_list_branches_names_the_current_one(repo):
    checkout.create_branch(repo, "feature/x", switch=False)
    data = checkout.list_branches(repo)
    assert data["current"] == "main"
    assert "main" in data["local"]
    assert "feature/x" in data["local"]


def test_list_branches_current_is_empty_when_detached(repo):
    checkout.checkout(repo, repo.first)
    assert checkout.list_branches(repo)["current"] == ""


def test_list_branches_does_not_offer_the_remote_itself_as_a_branch(repo):
    """`origin/HEAD` shortens to "origin", not "origin/HEAD".

    git's refname:short drops the part that makes it unambiguous, so the symref that
    records the remote's default branch arrives looking exactly like a branch called
    "origin". Filtering on a "/HEAD" suffix therefore never matched it, and the picker
    offered "origin" as something to check out: a remote, not a branch, and checking it
    out fails.
    """
    remotes = repo / ".git" / "refs" / "remotes" / "origin"
    remotes.mkdir(parents=True, exist_ok=True)
    (remotes / "main").write_text(repo.first + "\n")
    (remotes / "HEAD").write_text("ref: refs/remotes/origin/main\n")

    data = checkout.list_branches(repo)
    assert "origin" not in data["remote"], data["remote"]


def test_list_branches_names_the_default_branch(repo):
    """With no remote, the default falls back to a local main/master so the picker can
    still mark it."""
    checkout.create_branch(repo, "feature/x", switch=False)
    data = checkout.list_branches(repo)
    assert data["default"] == "main"


def test_list_branches_surfaces_remote_only_branches(bare_and_clone, tmp_path):
    """A branch someone else pushed, that we have no local copy of, is offered so the
    user can check it out."""
    bare, work = bare_and_clone
    other = tmp_path / "other"
    git("clone", str(bare), str(other), cwd=tmp_path)
    git("config", "user.email", "o@o.o", cwd=other)
    git("config", "user.name", "O", cwd=other)
    git("switch", "-c", "their-feature", cwd=other)
    commit(other, "x.txt", "x", "on their feature")
    git("push", "-u", "origin", "their-feature", cwd=other)

    checkout.fetch(work)
    data = checkout.list_branches(work)
    # Not local here, so it shows under remote as origin/their-feature.
    assert any(r.endswith("their-feature") for r in data["remote"])
    assert "their-feature" not in data["local"]


def test_list_branches_does_not_double_list_a_tracked_branch(bare_and_clone):
    bare, work = bare_and_clone
    # main is both local and origin/main; it should appear once, under local.
    data = checkout.list_branches(work)
    assert "main" in data["local"]
    assert not any(r.endswith("/main") for r in data["remote"])


# -- staging ---------------------------------------------------------------


def test_stage_and_unstage_a_single_file(repo):
    (repo / "board.kicad_pcb").write_text("(kicad_pcb v3)")
    (repo / "notes.md").write_text("new")

    checkout.stage(repo, ["board.kicad_pcb"])
    dirt = checkout.dirty_files(repo)
    assert "board.kicad_pcb" in dirt["staged"]
    assert "notes.md" in dirt["untracked"]  # untouched

    checkout.unstage(repo, ["board.kicad_pcb"])
    dirt = checkout.dirty_files(repo)
    assert "board.kicad_pcb" not in dirt["staged"]
    assert "board.kicad_pcb" in dirt["modified"]  # back to modified, not lost


def test_unstage_returns_a_new_file_to_untracked(repo):
    """Unstaging must handle a newly-added file (back to untracked), not just a
    modified one (back to modified)."""
    (repo / "fresh.txt").write_text("brand new")
    checkout.stage(repo, ["fresh.txt"])
    assert "fresh.txt" in checkout.dirty_files(repo)["staged"]

    checkout.unstage(repo, ["fresh.txt"])
    dirt = checkout.dirty_files(repo)
    assert "fresh.txt" in dirt["untracked"]
    assert "fresh.txt" not in dirt["staged"]


def test_stage_all_stages_design_but_not_churn(repo):
    (repo / "board.kicad_pcb").write_text("(kicad_pcb v3)")   # design
    (repo / "fp-info-cache").write_text("cache")              # noise
    (repo / "board.kicad_pcb-bak").write_text("backup")       # noise

    checkout.stage_all(repo)
    dirt = checkout.dirty_files(repo)
    assert "board.kicad_pcb" in dirt["staged"]
    # The churn stayed out of the index.
    assert "fp-info-cache" not in dirt["staged"]
    assert "board.kicad_pcb-bak" not in dirt["staged"]
    assert "fp-info-cache" in dirt["untracked"]


def test_stage_all_refuses_when_only_churn_changed(repo):
    (repo / "fp-info-cache").write_text("cache")
    with pytest.raises(CheckoutError, match="no design changes"):
        checkout.stage_all(repo)


def test_a_noise_file_can_still_be_staged_by_name(repo):
    """The churn is excluded by default, but the user can commit it deliberately."""
    (repo / "fp-info-cache").write_text("cache")
    checkout.stage(repo, ["fp-info-cache"])
    assert "fp-info-cache" in checkout.dirty_files(repo)["staged"]


def test_unstage_all_clears_the_index_without_touching_files(repo):
    (repo / "board.kicad_pcb").write_text("(kicad_pcb v3)")
    (repo / "notes.md").write_text("new")
    checkout.stage_all(repo)
    checkout.stage(repo, ["notes.md"])
    assert checkout.dirty_files(repo)["staged"]

    checkout.unstage_all(repo)
    dirt = checkout.dirty_files(repo)
    assert dirt["staged"] == []
    # The edits are still there, just unstaged.
    assert (repo / "board.kicad_pcb").read_text() == "(kicad_pcb v3)"
    assert "board.kicad_pcb" in dirt["modified"]


def test_commit_honours_the_staged_set(repo):
    """The Commit button must commit what is staged, not re-stage the whole tree."""
    (repo / "board.kicad_pcb").write_text("(kicad_pcb v3)")
    (repo / "notes.md").write_text("keep me unstaged")

    checkout.stage(repo, ["board.kicad_pcb"])
    result = checkout.commit(repo, "just the board")  # no paths, no stage_all

    assert result["committed"] == ["board.kicad_pcb"]
    # notes.md was never staged, so it is still uncommitted.
    assert "notes.md" in checkout.dirty_files(repo)["untracked"]


def test_commit_with_stage_all_design_excludes_churn(repo):
    (repo / "board.kicad_pcb").write_text("(kicad_pcb v3)")
    (repo / "fp-info-cache").write_text("cache")

    result = checkout.commit(repo, "all my work", stage_all_design=True)
    assert "board.kicad_pcb" in result["committed"]
    assert "fp-info-cache" not in result["committed"]
    # The churn is still sitting in the working tree, uncommitted.
    assert "fp-info-cache" in checkout.dirty_files(repo)["untracked"]


def test_commit_with_dirty_but_unstaged_tree_is_refused(repo):
    """Distinct from the clean-tree case: files ARE changed, but none are staged, so the
    staging-UI commit has nothing to do and says so rather than committing everything."""
    (repo / "board.kicad_pcb").write_text("(kicad_pcb v3)")  # dirty but nothing staged
    with pytest.raises(CheckoutError, match="nothing staged"):
        checkout.commit(repo, "unstaged")


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
