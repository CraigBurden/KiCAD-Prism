"""The deferred branch switch: wait for KiCad to close, then check out and reopen.

The scheduler never touches the working tree while KiCad is alive, that is the whole
point, so these drive it with a fake pid-alive signal and a fake launch, and assert the
checkout only happens after "KiCad" is gone and the guard still passes.
"""

import json
import subprocess
import sys
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from prism_agent import checkout, discovery, open_project, switch_scheduler  # noqa: E402


def git(*args, cwd):
    return subprocess.run(["git", *args], cwd=str(cwd), capture_output=True, text=True, check=True)


@pytest.fixture
def project(tmp_path):
    """A repo with a .kicad_pro and two branches, so a switch has somewhere to go."""
    repo = tmp_path / "proj"
    repo.mkdir()
    git("init", "-b", "main", cwd=repo)
    git("config", "user.email", "t@t.t", cwd=repo)
    git("config", "user.name", "T", cwd=repo)
    (repo / "board.kicad_pro").write_text("{}")
    (repo / "board.kicad_pcb").write_text("(kicad_pcb v1)")
    git("add", "-A", cwd=repo)
    git("commit", "-m", "first", cwd=repo)
    git("branch", "feature", cwd=repo)
    # Diverge feature so switching to it actually changes the board.
    git("switch", "feature", cwd=repo)
    (repo / "board.kicad_pcb").write_text("(kicad_pcb feature)")
    git("commit", "-am", "on feature", cwd=repo)
    git("switch", "main", cwd=repo)
    return repo


@pytest.fixture
def fast(monkeypatch):
    """Make the scheduler's waits instant so tests do not sleep for real."""
    monkeypatch.setattr(switch_scheduler, "SETTLE_SECONDS", 0)
    monkeypatch.setattr(switch_scheduler, "POLL_SECONDS", 0.01)


def _capture_notify():
    notes = []
    return notes, lambda title, msg: notes.append((title, msg))


def test_schedule_refuses_a_dead_pid(project, fast, monkeypatch):
    monkeypatch.setattr(discovery, "_pid_alive", lambda pid: False)
    sched = switch_scheduler.SwitchScheduler()
    with pytest.raises(checkout.CheckoutError, match="does not appear to be running"):
        sched.schedule(repo=str(project), ref="feature", project_dir=str(project), kicad_pid=99999)


def test_switch_happens_only_after_the_pid_exits(project, fast, monkeypatch):
    launched = []
    monkeypatch.setattr(open_project, "launch_kicad", lambda d: launched.append(str(d)))

    # KiCad is "alive" for the first few polls, then gone.
    alive = {"n": 3}

    def pid_alive(pid):
        alive["n"] -= 1
        return alive["n"] > 0

    monkeypatch.setattr(discovery, "_pid_alive", pid_alive)

    notes, notify = _capture_notify()
    sched = switch_scheduler.SwitchScheduler(notify=notify)
    sched.schedule(repo=str(project), ref="feature", project_dir=str(project), kicad_pid=4242)

    # Wait for the watcher to see the pid gone, switch, AND reopen (launch is the last
    # step, so waiting on it avoids racing the checkout).
    for _ in range(200):
        if launched:
            break
        time.sleep(0.02)

    assert (project / "board.kicad_pcb").read_text() == "(kicad_pcb feature)"
    assert launched == [str(project)]


def test_a_reopened_target_without_a_project_file_is_reported(project, fast, monkeypatch):
    # feature branch removes the .kicad_pro
    git("switch", "feature", cwd=project)
    (project / "board.kicad_pro").unlink()
    git("commit", "-am", "drop pro", cwd=project)
    git("switch", "main", cwd=project)

    monkeypatch.setattr(discovery, "_pid_alive", lambda pid: False)
    launched = []
    monkeypatch.setattr(open_project, "launch_kicad", lambda d: launched.append(d))

    notes, notify = _capture_notify()
    sched = switch_scheduler.SwitchScheduler(notify=notify)
    # Drive _perform directly (pid already gone), so we assert the no-project-file path.
    pending = switch_scheduler.PendingSwitch(
        repo=str(project), ref="feature", project_dir=str(project), kicad_pid=1
    )
    sched._perform(pending)

    assert launched == []  # nothing to reopen
    assert any("no KiCad project file" in m for _, m in notes)
    # But the switch itself still happened.
    assert (project / "board.kicad_pcb").read_text() == "(kicad_pcb feature)"


def test_a_dirty_tree_at_switch_time_is_reported_not_clobbered(project, fast, monkeypatch):
    """The user reopened KiCad and edited, or KiCad autosaved on close. The scheduler
    re-checks the guard and refuses rather than swapping under the changes."""
    monkeypatch.setattr(discovery, "_pid_alive", lambda pid: False)
    launched = []
    monkeypatch.setattr(open_project, "launch_kicad", lambda d: launched.append(d))

    # Make the tree dirty, as if KiCad wrote to it.
    (project / "board.kicad_pcb").write_text("(kicad_pcb UNSAVED EDIT)")

    notes, notify = _capture_notify()
    sched = switch_scheduler.SwitchScheduler(notify=notify)
    pending = switch_scheduler.PendingSwitch(
        repo=str(project), ref="feature", project_dir=str(project), kicad_pid=1
    )
    sched._perform(pending)

    assert launched == []
    assert any("unchanged" in m.lower() for _, m in notes)
    # The user's edit is intact, not overwritten by the switch.
    assert (project / "board.kicad_pcb").read_text() == "(kicad_pcb UNSAVED EDIT)"


def test_cancel_drops_a_pending_switch(project, fast, monkeypatch):
    monkeypatch.setattr(discovery, "_pid_alive", lambda pid: True)  # never exits
    monkeypatch.setattr(open_project, "launch_kicad", lambda d: pytest.fail("must not switch"))

    sched = switch_scheduler.SwitchScheduler()
    sched.schedule(repo=str(project), ref="feature", project_dir=str(project), kicad_pid=7)
    assert sched.pending() is not None

    result = sched.cancel()
    assert result["cancelled"] is True
    assert sched.pending() is None
    time.sleep(0.1)  # give the watcher a chance to (not) act
    assert (project / "board.kicad_pcb").read_text() == "(kicad_pcb v1)"


def test_a_process_that_has_exited_is_not_reported_as_running():
    """THE one that stalled every switch on Windows.

    Windows keeps a process object alive while any handle to it remains, so OpenProcess
    succeeds for a process that has already exited. Treating "the handle opened" as
    "still running" meant the watcher waited on a KiCad that had closed long ago: no
    checkout, no reopen, no error, just the old branch still there.
    """
    child = subprocess.Popen([sys.executable, "-c", "pass"])
    child.wait()
    # The Popen object still holds a handle, which is exactly the case that used to lie.
    for _ in range(40):
        if not discovery._pid_alive(child.pid):
            break
        time.sleep(0.05)
    assert not discovery._pid_alive(child.pid)


def test_a_running_process_is_reported_as_running():
    import os

    assert discovery._pid_alive(os.getpid())


def test_a_pending_switch_survives_the_agent_restarting(project, fast, monkeypatch, tmp_path):
    """The switch is owed even if the agent stops between scheduling and KiCad closing.

    Restarts happen routinely (an update, a tray Restart, a dev iteration). The pending
    switch used to live only in memory, so a restart dropped it: KiCad closed, nothing
    was watching, no checkout happened and nothing was ever reported. The user saw the
    old branch and no explanation.
    """
    state = tmp_path / "cfg"
    monkeypatch.setattr(discovery, "config_dir", lambda: state)

    # Agent one: schedule while "KiCad" is running, then go away without acting.
    monkeypatch.setattr(discovery, "_pid_alive", lambda pid: True)
    first = switch_scheduler.SwitchScheduler()
    first.schedule(repo=str(project), ref="feature", project_dir=str(project), kicad_pid=7)
    first._cancel.set()  # the process died; its watcher stops with it
    assert (state / "pending-switch.json").is_file()

    # Agent two starts with KiCad already closed, and owes the switch.
    launched = []
    monkeypatch.setattr(discovery, "_pid_alive", lambda pid: False)
    monkeypatch.setattr(open_project, "launch_kicad", lambda d: launched.append(d))

    second = switch_scheduler.SwitchScheduler()
    second.resume()
    for _ in range(80):
        if checkout.status(project).get("current_branch") == "feature":
            break
        time.sleep(0.05)

    assert checkout.status(project)["current_branch"] == "feature"
    assert launched, "the project should have been reopened"
    for _ in range(40):
        if not (state / "pending-switch.json").is_file():
            break
        time.sleep(0.05)
    assert not (state / "pending-switch.json").is_file()


def test_a_switch_too_old_to_honour_is_dropped_on_resume(project, monkeypatch, tmp_path):
    """A switch set up and abandoned should not reopen KiCad out of nowhere later."""
    state = tmp_path / "cfg"
    state.mkdir()
    monkeypatch.setattr(discovery, "config_dir", lambda: state)
    (state / "pending-switch.json").write_text(
        json.dumps(
            {
                "repo": str(project),
                "ref": "feature",
                "project_dir": str(project),
                "kicad_pid": 7,
                "created": time.time() - (switch_scheduler.MAX_WAIT_SECONDS + 60),
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(discovery, "_pid_alive", lambda pid: False)
    monkeypatch.setattr(open_project, "launch_kicad", lambda d: pytest.fail("must not reopen"))

    switch_scheduler.SwitchScheduler().resume()
    time.sleep(0.3)
    assert checkout.status(project)["current_branch"] == "main"
    assert not (state / "pending-switch.json").is_file()


# -- KiCad writing on its way out ----------------------------------------
#
# The bug: choose "discard", close KiCad, and the switch is refused with "1 file(s)
# have uncommitted changes". KiCad rewrites .kicad_pro as it exits (it expands the
# file with defaults for its version, which a project authored in an older KiCad gets
# every single time), so the tree the user just cleaned is dirty again by the time the
# scheduler looks. Their answer is re-applied to those writes.


def test_discard_survives_kicad_rewriting_files_on_exit(project, fast, monkeypatch):
    """THE reported bug. Discard, close KiCad, and the switch must still happen."""
    monkeypatch.setattr(discovery, "_pid_alive", lambda pid: False)
    launched = []
    monkeypatch.setattr(open_project, "launch_kicad", lambda d: launched.append(d))

    # The user's own edit, which they chose to discard...
    (project / "board.kicad_pcb").write_text("(kicad_pcb THEIR EDIT)")
    decided_at = time.time()
    checkout.discard(project)
    assert not checkout.dirty_files(project)["blocking"], "clean when they answered"

    # ...and then KiCad rewrites the project file as it closes.
    (project / "board.kicad_pro").write_text('{"upgraded_by_kicad": true}')

    notes, notify = _capture_notify()
    sched = switch_scheduler.SwitchScheduler(notify=notify)
    sched._perform(
        switch_scheduler.PendingSwitch(
            repo=str(project), ref="feature", project_dir=str(project),
            kicad_pid=1, resolution="discard", decided_at=decided_at,
        )
    )

    assert checkout.status(project)["current_branch"] == "feature"
    assert launched, "and the project is reopened"


def test_work_the_user_never_answered_for_is_not_discarded(project, fast, monkeypatch):
    """The safety property. Re-applying a discard must never reach a file the user was
    not asked about: they reopened KiCad and did real work, and that is not ours to
    throw away no matter what they said earlier about something else."""
    monkeypatch.setattr(discovery, "_pid_alive", lambda pid: False)
    monkeypatch.setattr(open_project, "launch_kicad", lambda d: None)

    # They answered, and the tree was cleaned.
    (project / "board.kicad_pro").write_text('{"settings": 1}')
    checkout.discard(project)
    # Long enough ago that anything written now is plainly not KiCad shutting down:
    # they reopened it and did real work, which nobody asked them about.
    decided_at = time.time() - (switch_scheduler.SHUTDOWN_WINDOW_SECONDS + 60)
    (project / "board.kicad_pcb").write_text("(kicad_pcb REAL WORK)")

    notes, notify = _capture_notify()
    sched = switch_scheduler.SwitchScheduler(notify=notify)
    sched._perform(
        switch_scheduler.PendingSwitch(
            repo=str(project), ref="feature", project_dir=str(project),
            kicad_pid=1, resolution="discard", decided_at=decided_at,
        )
    )

    assert (project / "board.kicad_pcb").read_text() == "(kicad_pcb REAL WORK)"
    assert checkout.status(project)["current_branch"] == "main", "refused, not switched"
    assert any("uncommitted" in m.lower() for _, m in notes)


def test_without_a_recorded_answer_a_dirty_tree_is_still_refused(project, fast, monkeypatch):
    """No resolution means nothing was asked, so nothing may be assumed."""
    monkeypatch.setattr(discovery, "_pid_alive", lambda pid: False)
    monkeypatch.setattr(open_project, "launch_kicad", lambda d: pytest.fail("no switch"))

    (project / "board.kicad_pcb").write_text("(kicad_pcb UNSAVED)")

    notes, notify = _capture_notify()
    sched = switch_scheduler.SwitchScheduler(notify=notify)
    sched._perform(
        switch_scheduler.PendingSwitch(
            repo=str(project), ref="feature", project_dir=str(project), kicad_pid=1
        )
    )

    assert (project / "board.kicad_pcb").read_text() == "(kicad_pcb UNSAVED)"
    assert checkout.status(project)["current_branch"] == "main"


def test_the_answer_survives_an_agent_restart(project, fast, monkeypatch, tmp_path):
    """The resolution is only useful if it outlives the process that took it."""
    state = tmp_path / "cfg"
    monkeypatch.setattr(discovery, "config_dir", lambda: state)
    monkeypatch.setattr(discovery, "_pid_alive", lambda pid: True)

    first = switch_scheduler.SwitchScheduler()
    first.schedule(
        repo=str(project), ref="feature", project_dir=str(project), kicad_pid=7,
        resolution="discard",
    )
    first._cancel.set()

    raw = json.loads((state / "pending-switch.json").read_text(encoding="utf-8"))
    assert raw["resolution"] == "discard"
    assert raw["decided_at"] > 0


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
