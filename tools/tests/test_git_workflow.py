"""The plugin's git workflows, driven through a scripted fake agent. No wx.

git_workflow decides; the dialog only asks and shows. So the rules that used to live
in button handlers (where a branch is published, what a push without an upstream turns
into, when a commit needs a branch, whether a switch can go ahead) are tested here.
"""

import importlib.util
import sys
import types
from pathlib import Path

import pytest

PLUGIN = Path(__file__).resolve().parent.parent / "kicad_plugin"


def _load_git_workflow():
    """kicad_plugin/__init__.py imports pcbnew/wx; load the modules under a package
    name private to this file (see test_agent_client_errors)."""
    pkg_name = "kicad_plugin_git_workflow_test"
    pkg = types.ModuleType(pkg_name)
    pkg.__path__ = [str(PLUGIN)]
    sys.modules[pkg_name] = pkg
    for name in ("profiles", "loopback", "agent_client", "git_workflow"):
        spec = importlib.util.spec_from_file_location(
            f"{pkg_name}.{name}", PLUGIN / f"{name}.py"
        )
        module = importlib.util.module_from_spec(spec)
        module.__package__ = pkg_name
        sys.modules[f"{pkg_name}.{name}"] = module
        spec.loader.exec_module(module)
    return sys.modules[f"{pkg_name}.git_workflow"]


gw = _load_git_workflow()
AgentUnavailable = sys.modules["kicad_plugin_git_workflow_test.agent_client"].AgentUnavailable


class FakeAgent:
    """Answers from a script: {method: value or exception}. Records every call."""

    def __init__(self, **script):
        self.script = script
        self.calls = []

    def __getattr__(self, method):
        def call(*args, **kwargs):
            self.calls.append((method, args, kwargs))
            answer = self.script.get(method)
            if isinstance(answer, list):
                answer = answer.pop(0)
            if isinstance(answer, Exception):
                raise answer
            return answer

        return call


def workflow(agent):
    return gw.GitWorkflow(agent=lambda: agent)


REMOTES = {
    "remotes": [
        {"name": "origin", "url": "git@x:me/board.git"},
        {"name": "upstream", "url": "git@x:them/board.git"},
    ]
}


# -- where a branch is published -----------------------------------------------


def test_any_remote_is_a_choice_never_a_guess():
    out = workflow(FakeAgent(remotes=REMOTES)).publish_targets("/r")
    assert out.kind == gw.NEEDS_REMOTE
    assert [r.name for r in out.remotes] == ["origin", "upstream"]


def test_a_single_remote_is_still_asked():
    """The reconciled rule: one remote is not an implied yes, for either caller."""
    agent = FakeAgent(remotes={"remotes": [{"name": "origin", "url": "u"}]})
    out = workflow(agent).publish_targets("/r")
    assert out.kind == gw.NEEDS_REMOTE
    assert out.remotes == (gw.Remote("origin", "u"),)


def test_no_remote_means_nowhere_to_publish():
    assert workflow(FakeAgent(remotes={"remotes": []})).publish_targets("/r").kind == (
        gw.NO_REMOTE
    )
    assert workflow(FakeAgent(remotes=None)).publish_targets("/r").kind == gw.NO_REMOTE


def test_an_unreachable_agent_cannot_offer_targets():
    out = workflow(FakeAgent(remotes=AgentUnavailable("gone"))).publish_targets("/r")
    assert out.kind == gw.FAILED
    assert out.error == "gone"


def test_a_new_branch_whose_remotes_cannot_be_listed_is_local_only():
    # D7: the branch exists; say it stayed local and why, as the push path does.
    out = workflow(FakeAgent(remotes=AgentUnavailable("gone"))).new_branch_targets("/r")
    assert out.kind == gw.LOCAL_ONLY
    assert out.error == "gone"
    assert not out.ok


def test_a_new_branch_is_offered_the_same_targets_as_a_push():
    assert workflow(FakeAgent(remotes=REMOTES)).new_branch_targets("/r").kind == gw.NEEDS_REMOTE
    assert workflow(FakeAgent(remotes=None)).new_branch_targets("/r").kind == gw.NO_REMOTE


def test_publish_sets_the_upstream_on_the_chosen_remote():
    agent = FakeAgent(push={"ok": True})
    assert workflow(agent).publish("/r", "upstream").ok
    assert agent.calls == [("push", ("/r",), {"set_upstream": True, "remote": "upstream"})]


# -- pushing -------------------------------------------------------------------


def test_a_tracked_branch_pushes_straight_out():
    agent = FakeAgent(push={"ok": True})
    assert workflow(agent).push("/r").ok
    assert [c[0] for c in agent.calls] == ["push"]


def test_a_push_without_upstream_becomes_a_remote_choice():
    agent = FakeAgent(
        push=AgentUnavailable("no upstream", code="no_upstream"), remotes=REMOTES
    )
    out = workflow(agent).push("/r")
    assert out.kind == gw.NEEDS_REMOTE
    assert [c[0] for c in agent.calls] == ["push", "remotes"]


def test_a_push_without_upstream_and_no_remote_says_so():
    agent = FakeAgent(
        push=AgentUnavailable("no upstream", code="no_upstream"),
        remotes={"remotes": []},
    )
    assert workflow(agent).push("/r").kind == gw.NO_REMOTE


def test_any_other_push_refusal_is_reported():
    agent = FakeAgent(push=AgentUnavailable("rejected: non-fast-forward", code="x"))
    out = workflow(agent).push("/r")
    assert out.kind == gw.FAILED
    assert "non-fast-forward" in out.error


def test_no_endpoint_at_all_is_a_failure_not_a_crash():
    def no_agent():
        raise AgentUnavailable("The Prism agent isn't running.")

    out = gw.GitWorkflow(agent=no_agent).push("/r")
    assert out.kind == gw.FAILED


# -- committing ----------------------------------------------------------------


def test_commit_stages_all_design_work_by_default():
    agent = FakeAgent(commit={"ok": True})
    assert workflow(agent).commit("/r", "msg").ok
    assert agent.calls == [("commit", ("/r", "msg"), {"stage_all_design": True})]


def test_commit_of_staged_only_does_not_stage():
    agent = FakeAgent(commit={"ok": True})
    workflow(agent).commit("/r", "msg", staged_only=True)
    assert agent.calls[0][2] == {"stage_all_design": False}


def test_a_detached_commit_needs_a_branch():
    agent = FakeAgent(commit=AgentUnavailable("HEAD is detached; refusing"))
    assert workflow(agent).commit("/r", "msg").kind == gw.NEEDS_BRANCH


def test_commit_on_a_new_branch_creates_then_commits():
    agent = FakeAgent(create_branch={}, commit={})
    assert workflow(agent).commit_on_new_branch("/r", "feat", "msg").ok
    assert [c[0] for c in agent.calls] == ["create_branch", "commit"]


# -- switching -----------------------------------------------------------------


def test_branch_choices_skip_the_current_and_name_remotes_short():
    data = {
        "current": "main",
        "default": "main",
        "local": ["main", "feature"],
        "remote": ["origin/main", "origin/fix"],
    }
    assert gw.branch_choices(data) == [
        ("feature", "feature"),
        ("main  (remote, default)", "main"),
        ("fix  (remote)", "fix"),
    ]


def test_the_local_default_is_marked():
    data = {"current": "feature", "default": "main", "local": ["main"], "remote": []}
    assert gw.branch_choices(data) == [("main  (default)", "main")]


def test_no_other_branch_is_nothing_to_choose():
    agent = FakeAgent(branches={"current": "main", "local": ["main"], "remote": []})
    assert workflow(agent).switch_choices("/r").kind == gw.NOTHING


@pytest.mark.parametrize(
    "state, kind",
    [
        ({"can": True}, gw.DONE),
        ({"can": False, "reason": "dirty", "message": "2 files"}, gw.NEEDS_SETTLE),
        ({"can": False, "reason": "untracked_collision", "message": "m"}, gw.NEEDS_SETTLE),
        ({"can": False, "reason": "unknown_ref", "message": "no such"}, gw.BLOCKED),
        ({}, gw.BLOCKED),
    ],
)
def test_switch_preflight(state, kind):
    assert workflow(FakeAgent(checkout_status=state)).switch_preflight("/r", "x").kind == kind


def test_a_blocked_switch_without_a_message_still_says_something():
    out = workflow(FakeAgent(checkout_status={"can": False})).switch_preflight("/r", "x")
    assert out.error == "Can't switch."
