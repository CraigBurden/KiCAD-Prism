"""The plugin's git workflows, as decisions the dialog renders.

The dialog used to call the agent directly from its button handlers and decide what
the answers meant there too: which remote a branch goes to, what a push refused with
``no_upstream`` should turn into, whether a branch switch can go ahead. That put the
rules where no test could reach them (wx is not importable outside KiCad), and the
"where does this branch go" rule was written twice with different edges.

This module sits above the agent client and returns an ``Outcome`` saying what
happened or what has to be asked next. It never prompts: the dialog owns the words and
the widgets, this owns the decision. The agent client is the port: anything with
AgentClient's methods works, which is how tests drive it with a scripted fake.

Stdlib-only, no wx: it runs inside KiCad's Python and in the headless test suite.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .agent_client import AgentClient, AgentUnavailable

# What an Outcome can say.
DONE = "done"  # it happened
FAILED = "failed"  # the agent refused or could not be reached; `error` says why
NEEDS_REMOTE = "needs_remote"  # a branch can be published: pick one of `remotes`
NO_REMOTE = "no_remote"  # nothing to publish to: the repo has no remote
NEEDS_SETTLE = "needs_settle"  # uncommitted work must be settled first; `error` says what
BLOCKED = "blocked"  # the switch cannot happen at all; `error` says why
NOTHING = "nothing"  # nothing to choose from
NEEDS_BRANCH = "needs_branch"  # HEAD is detached: the work needs a branch to land on
LOCAL_ONLY = "local_only"  # a new branch stays local: its remotes could not be listed; `error` says why


@dataclass(frozen=True)
class Remote:
    name: str
    url: str


@dataclass(frozen=True)
class Outcome:
    kind: str
    error: str = ""
    remotes: tuple = ()
    choices: tuple = field(default=())  # (label, ref) pairs for a branch picker

    @property
    def ok(self) -> bool:
        return self.kind == DONE


def _failed(exc: Exception) -> Outcome:
    return Outcome(FAILED, error=str(exc))


class GitWorkflow:
    """Git workflows over the agent port.

    `agent` is a factory returning a client, called once per workflow, because the
    agent's endpoint can change between clicks (a restart binds a new port).
    """

    def __init__(self, agent=AgentClient):
        self._agent = agent

    # -- publishing a branch ------------------------------------------------

    def publish_targets(self, repo) -> Outcome:
        """Where can a branch be published? The one rule for both callers.

        Never guesses: with any remote at all the user picks (NEEDS_REMOTE, in the
        agent's order, origin first); with none there is nowhere to publish
        (NO_REMOTE). The question is the same whether the branch was just created or a
        push found it unpublished; only the dialog's wording differs.
        """
        try:
            data = self._agent().remotes(repo) or {}
        except AgentUnavailable as exc:
            return _failed(exc)
        remotes = tuple(
            Remote(str(r.get("name") or ""), str(r.get("url") or ""))
            for r in (data.get("remotes") or [])
            if isinstance(r, dict) and r.get("name")
        )
        if not remotes:
            return Outcome(NO_REMOTE)
        return Outcome(NEEDS_REMOTE, remotes=remotes)

    def new_branch_targets(self, repo) -> Outcome:
        """Where can a branch that was just created go? publish_targets, except
        that remotes the agent could not list mean the branch stays on this
        computer (LOCAL_ONLY, with why): the branch exists, so this is not a
        failure, but the user is told, as a push in the same state tells them.
        """
        targets = self.publish_targets(repo)
        if targets.kind == FAILED:
            return Outcome(LOCAL_ONLY, error=targets.error)
        return targets

    def publish(self, repo, remote) -> Outcome:
        """Push the current branch to `remote` and track it there."""
        try:
            self._agent().push(repo, set_upstream=True, remote=remote)
        except AgentUnavailable as exc:
            return _failed(exc)
        return Outcome(DONE)

    def push(self, repo) -> Outcome:
        """Push the current branch; an unpublished one turns into a remote choice.

        A branch that already tracks a remote goes straight out: git knows where. Only
        the agent's ``no_upstream`` refusal asks where, through publish_targets.
        """
        try:
            self._agent().push(repo)
        except AgentUnavailable as exc:
            if getattr(exc, "code", "") == "no_upstream":
                return self.publish_targets(repo)
            return _failed(exc)
        return Outcome(DONE)

    def create_branch(self, repo, branch) -> Outcome:
        """Create `branch` here and switch to it, keeping any work on the tree."""
        try:
            self._agent().create_branch(repo, branch)
        except AgentUnavailable as exc:
            return _failed(exc)
        return Outcome(DONE)

    def fetch(self, repo) -> Outcome:
        try:
            self._agent().fetch(repo)
        except AgentUnavailable as exc:
            return _failed(exc)
        return Outcome(DONE)

    # -- committing --------------------------------------------------------

    def commit(self, repo, message, staged_only=False) -> Outcome:
        """Commit: exactly what is staged, or all design work.

        The agent refuses a commit on a detached HEAD. That is NEEDS_BRANCH rather than
        a failure, because git's own remedy (name a branch here, commit onto it) is one
        question away; commit_on_new_branch does it.
        """
        try:
            self._agent().commit(repo, message, stage_all_design=not staged_only)
        except AgentUnavailable as exc:
            if "detached" in str(exc).lower():
                return Outcome(NEEDS_BRANCH, error=str(exc))
            return _failed(exc)
        return Outcome(DONE)

    def commit_on_new_branch(self, repo, branch, message, staged_only=False) -> Outcome:
        """Create `branch` at the detached commit, then commit onto it."""
        try:
            agent = self._agent()
            agent.create_branch(repo, branch)
            agent.commit(repo, message, stage_all_design=not staged_only)
        except AgentUnavailable as exc:
            return _failed(exc)
        return Outcome(DONE)

    # -- switching branch ---------------------------------------------------

    def switch_choices(self, repo) -> Outcome:
        """The branches the user can switch to, as (label, ref) pairs.

        A remote branch (origin/feature) is checked out by its SHORT name (feature) so
        git creates a local tracking branch instead of detaching HEAD. The default
        branch is marked so the user does not have to recall which of main/master it
        is. NOTHING when there is no other branch.
        """
        try:
            data = self._agent().branches(repo) or {}
        except AgentUnavailable as exc:
            return _failed(exc)
        choices = branch_choices(data)
        if not choices:
            return Outcome(NOTHING)
        return Outcome(DONE, choices=tuple(choices))

    def switch_preflight(self, repo, ref) -> Outcome:
        """Can we switch to `ref` now? A read-only dry run.

        DONE: go ahead. NEEDS_SETTLE: the tree has uncommitted work in the way, which
        the user commits, stashes, or discards first. BLOCKED: anything else git
        refuses, with its message.
        """
        try:
            state = self._agent().checkout_status(repo, ref) or {}
        except AgentUnavailable as exc:
            return _failed(exc)
        if state.get("can"):
            return Outcome(DONE)
        if state.get("reason") in ("dirty", "untracked_collision"):
            return Outcome(NEEDS_SETTLE, error=state.get("message", ""))
        return Outcome(BLOCKED, error=state.get("message", "Can't switch."))

    def switch(self, repo, ref) -> Outcome:
        try:
            self._agent().switch(repo, ref)
        except AgentUnavailable as exc:
            return _failed(exc)
        return Outcome(DONE)


def branch_choices(data: dict) -> list:
    """(label, ref) for every branch but the current one: local first, then remote."""
    current = data.get("current") or ""
    default = data.get("default") or ""
    local = [b for b in (data.get("local") or []) if b != current]
    remote = data.get("remote") or []

    choices = []
    for b in local:
        choices.append(("%s  (default)" % b if b == default else b, b))
    for r in remote:
        short = r.split("/", 1)[1] if "/" in r else r
        if short == default:
            label = "%s  (remote, default)" % short
        else:
            label = "%s  (remote)" % short
        choices.append((label, short))
    return choices
