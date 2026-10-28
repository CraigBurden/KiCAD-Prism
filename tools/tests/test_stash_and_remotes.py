"""Restoring a stash without consuming it, and knowing where a branch can publish to.

Two gaps the plugin's git controls left open:

* `restore()` pops, which is the right default (a list of near-identical stashes is
  useless) but not always what is wanted. `apply()` is the deliberate other choice.

* `push(set_upstream=True)` hardcoded `origin`. On a fork layout (`origin` plus
  `upstream`) that is a silent guess about where someone's work goes.
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


@pytest.fixture
def repo(tmp_path):
    r = tmp_path / "board"
    r.mkdir()
    git("init", "-b", "main", cwd=r)
    git("config", "user.email", "t@t.t", cwd=r)
    git("config", "user.name", "T", cwd=r)
    (r / "board.kicad_pcb").write_text("(kicad_pcb v1)")
    git("add", "-A", cwd=r)
    git("commit", "-m", "first", cwd=r)
    return r


def _stash_something(repo, message="half-done routing"):
    (repo / "board.kicad_pcb").write_text("(kicad_pcb EDITED)")
    return checkout.stash(repo, message)


# -- apply vs pop ---------------------------------------------------------


def test_apply_restores_the_work(repo):
    _stash_something(repo)
    assert (repo / "board.kicad_pcb").read_text() == "(kicad_pcb v1)"

    checkout.apply(repo)
    assert (repo / "board.kicad_pcb").read_text() == "(kicad_pcb EDITED)"


def test_apply_keeps_the_stash_and_restore_consumes_it(repo):
    """THE distinction the two buttons exist for.

    Indistinguishable from the board alone: both put the same bytes back. The
    difference only shows up later, in whether the stash is still there to use again.
    """
    _stash_something(repo)
    assert len(checkout.stashes(repo)) == 1

    checkout.apply(repo)
    assert len(checkout.stashes(repo)) == 1, "apply must leave the stash behind"

    # Put the tree back so the pop has a clean tree to land on, then pop the same one.
    checkout.discard(repo)
    checkout.restore(repo)
    assert checkout.stashes(repo) == [], "restore (pop) must consume the stash"


def test_apply_refuses_onto_a_dirty_tree(repo):
    """Same guard as restore: a conflict between a stash and a board is not one we
    can merge our way out of."""
    _stash_something(repo)
    (repo / "board.kicad_pcb").write_text("(kicad_pcb SOMETHING ELSE)")

    with pytest.raises(CheckoutError, match="uncommitted changes"):
        checkout.apply(repo)

    # And the stash is untouched, so nothing was lost by refusing.
    assert len(checkout.stashes(repo)) == 1


def test_a_failed_apply_leaves_the_stash_in_place(repo):
    with pytest.raises(CheckoutError):
        checkout.apply(repo, "stash@{9}")  # no such stash
    assert checkout.stashes(repo) == []


# -- remotes --------------------------------------------------------------


def test_a_repo_with_no_remote_lists_none(repo):
    assert checkout.remotes(repo) == []


def test_remotes_are_listed_with_origin_first(repo):
    # Added out of order on purpose: origin should still lead, because that is what a
    # picker preselects.
    git("remote", "add", "upstream", "https://example.com/upstream.git", cwd=repo)
    git("remote", "add", "origin", "https://example.com/origin.git", cwd=repo)

    names = [r["name"] for r in checkout.remotes(repo)]
    assert names == ["origin", "upstream"]


def test_a_remote_is_listed_once_despite_fetch_and_push_urls(repo):
    """`git remote -v` prints each remote twice. A picker showing origin twice would
    look broken."""
    git("remote", "add", "origin", "https://example.com/origin.git", cwd=repo)
    assert [r["name"] for r in checkout.remotes(repo)] == ["origin"]
    assert checkout.remotes(repo)[0]["url"] == "https://example.com/origin.git"


# -- publishing to a chosen remote ----------------------------------------


def test_publishing_without_any_remote_says_so(repo):
    with pytest.raises(CheckoutError, match="no remote"):
        checkout.push(repo, set_upstream=True)


def test_publishing_to_an_unknown_remote_is_refused_by_name(repo):
    """Better than git's own error, and better than silently using origin."""
    git("remote", "add", "origin", "https://example.com/origin.git", cwd=repo)

    with pytest.raises(CheckoutError, match="not a remote"):
        checkout.push(repo, set_upstream=True, remote="nope")


def test_publishing_uses_the_named_remote(repo, tmp_path):
    """THE bug: with origin and upstream both present, push -u hardcoded origin."""
    origin = tmp_path / "origin.git"
    upstream = tmp_path / "upstream.git"
    for bare in (origin, upstream):
        bare.mkdir()
        git("init", "--bare", "-b", "main", cwd=bare)

    git("remote", "add", "origin", str(origin), cwd=repo)
    git("remote", "add", "upstream", str(upstream), cwd=repo)

    checkout.push(repo, set_upstream=True, remote="upstream")

    # It landed on upstream, and origin was left alone.
    assert git("log", "--oneline", "-1", cwd=upstream).stdout.strip()
    assert not git("log", "--oneline", "-1", cwd=origin, check=False).stdout.strip()


def test_publishing_defaults_to_origin_when_no_remote_is_named(repo, tmp_path):
    """The historical behaviour, kept for every caller that does not care."""
    origin = tmp_path / "origin.git"
    origin.mkdir()
    git("init", "--bare", "-b", "main", cwd=origin)
    git("remote", "add", "origin", str(origin), cwd=repo)

    checkout.push(repo, set_upstream=True)
    assert git("log", "--oneline", "-1", cwd=origin).stdout.strip()


def test_a_branch_with_no_upstream_refuses_with_a_code(repo):
    """The plugin offers to publish when it sees this, so it must not have to read
    the message to recognise it.

    Matching on the wording worked until someone reworded it, and then the offer
    silently stopped appearing with nothing failing anywhere.
    """
    git("remote", "add", "origin", "https://example.com/origin.git", cwd=repo)

    with pytest.raises(CheckoutError) as caught:
        checkout.push(repo)
    assert caught.value.code == "no_upstream"


def test_an_ordinary_refusal_carries_no_code(repo):
    """Only the refusals a caller acts on get one; everything else just shows."""
    with pytest.raises(CheckoutError) as caught:
        checkout.push(repo, set_upstream=True, remote="nope")
    assert caught.value.code == ""


# -- the wire verbs -------------------------------------------------------
#
# The route maps an action name onto one of these functions. That mapping is the thing
# an older plugin depends on, and getting it wrong is silent: the user presses a button
# and a different verb runs.


def test_the_wire_verbs_map_to_the_functions_they_name():
    """`apply` on the wire has always meant POP, and must keep meaning it.

    A plugin in the field sends action="apply" expecting the stash to be consumed.
    Repointing that string at the new keep-it behaviour would change what an existing
    install does without updating it, so the new behaviour got a new verb instead.

    Asserted against the source because the mapping lives in a chain of `elif`s with no
    seam to call: getting it wrong is silent, so it is worth pinning even awkwardly.
    """
    import inspect
    import re

    from prism_agent import server

    src = inspect.getsource(server._Handler.do_POST)
    # Each branch, paired with the first checkout.* call under it.
    pairs = dict(
        re.findall(
            r'action == "([a-z-]+)":.*?checkout\.([a-z_]+)\(',
            src,
            flags=re.DOTALL,
        )
    )

    assert pairs["apply"] == "restore", "the apply verb must keep popping"
    assert pairs["apply-keep"] == "apply", "apply-keep must be the one that keeps"
    assert pairs["drop"] == "drop"


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
