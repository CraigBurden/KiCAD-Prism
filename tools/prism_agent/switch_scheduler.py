"""Switch a branch after KiCad closes, then reopen the project.

The plugin runs inside KiCad and cannot close it, and a checkout under an open board
is a data-loss hazard: KiCad holds the board in memory and would overwrite the
checked-out file on its next save. So the switch is deferred to the agent, which is a
separate process that outlives KiCad.

The flow:

  1. The plugin, knowing KiCad's pid (its own process), schedules a switch here.
  2. The agent watches that pid. Nothing touches the working tree while it is alive.
  3. When it exits (plus a short settle for the OS to release file locks), the agent
     re-checks the guard, checks out the ref, and reopens the project in KiCad.
  4. Any failure is surfaced to the user, so they are never left wondering why KiCad
     did not reopen.

Only one switch is pending at a time (the user drives it); scheduling a new one
replaces any pending one. A cap stops a forgotten switch waiting forever, and the
schedule can be cancelled.
"""

from __future__ import annotations

import json
import logging
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path

from . import checkout, discovery, open_project

log = logging.getLogger(__name__)

# How long to wait for KiCad to close before giving up. A switch the user set up and
# then walked away from should not reopen KiCad hours later.
MAX_WAIT_SECONDS = 30 * 60

# After the pid is gone, wait this long before touching files: on Windows the process
# handle can be released while the OS still holds a lock on the files for a moment.
SETTLE_SECONDS = 1.5

# How often to poll the pid.
POLL_SECONDS = 1.0

# How long after the user's decision a write still counts as KiCad shutting down.
# It covers the user answering, KiCad being closed, and KiCad flushing its project
# files on the way out, which is a person-paced sequence rather than a fast one. Work
# done in a KiCad reopened afterwards falls outside it and is never assumed about.
SHUTDOWN_WINDOW_SECONDS = 15 * 60


@dataclass
class PendingSwitch:
    repo: str
    ref: str
    project_dir: str
    kicad_pid: int
    created: float = field(default_factory=time.time)
    # How the user already settled the tree before scheduling: "discard", "stash", or
    # "" when it was clean and nothing was asked. KiCad rewrites files of its own on
    # exit (project settings, autosaves), which re-dirties a tree that was clean when
    # the user answered. Re-applying THEIR answer to THOSE writes is honouring the
    # decision they made; asking again after KiCad has closed is asking about files
    # they never touched.
    resolution: str = ""
    # When the user answered. Files written after this are KiCad's exit writes (or
    # work done in a KiCad reopened afterwards); files that were already dirty then
    # are the ones they answered about. See _unsettled_dirt.
    decided_at: float = field(default_factory=time.time)


class SwitchScheduler:
    """Holds the one pending switch and the thread watching for KiCad to close."""

    def __init__(self, notify=None) -> None:
        # notify(title, message) shows the user an outcome. Injected so the agent can
        # route it through a short-lived helper process rather than calling a GUI
        # toolkit from this background thread, which is not safe while the tray owns
        # its own loop.
        self._notify = notify or (lambda *_: None)
        self._lock = threading.Lock()
        self._pending: PendingSwitch | None = None
        self._thread: threading.Thread | None = None
        self._cancel = threading.Event()

    # -- persistence -------------------------------------------------------
    #
    # A pending switch used to live only in this object. The agent is restarted
    # routinely (an update, a tray Restart, a dev iteration), and every restart
    # silently dropped the switch: KiCad closed, nothing was watching, no checkout
    # happened and no error was ever shown. The user saw the old branch and no
    # explanation. So the pending switch is written down and picked up again.

    def _state_path(self) -> Path:
        return Path(discovery.config_dir()) / "pending-switch.json"

    def _persist(self, pending: PendingSwitch | None) -> None:
        """Write or clear the pending switch. Never raises: this is bookkeeping."""
        path = self._state_path()
        try:
            if pending is None:
                path.unlink(missing_ok=True)
                return
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(
                json.dumps(
                    {
                        "repo": pending.repo,
                        "ref": pending.ref,
                        "project_dir": pending.project_dir,
                        "kicad_pid": pending.kicad_pid,
                        "created": pending.created,
                        # Carried across a restart too: the user's answer outlives the
                        # process that took it.
                        "resolution": pending.resolution,
                        "decided_at": pending.decided_at,
                    }
                ),
                encoding="utf-8",
            )
        except OSError:
            log.warning("couldn't record the pending switch", exc_info=True)

    def resume(self) -> None:
        """Pick up a switch scheduled before the agent restarted.

        Called once at startup. Three outcomes, and each is deliberate:

          KiCad still running   watch it again, exactly as before the restart.
          KiCad already gone    perform the switch now. It closed while nothing was
                                watching, which is the case that used to be lost.
          Too old               drop it. A switch the user set up long ago and walked
                                away from should not reopen KiCad out of nowhere.
        """
        path = self._state_path()
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return

        try:
            pending = PendingSwitch(
                repo=str(raw["repo"]),
                ref=str(raw["ref"]),
                project_dir=str(raw["project_dir"]),
                kicad_pid=int(raw["kicad_pid"]),
                created=float(raw.get("created") or time.time()),
                resolution=str(raw.get("resolution") or ""),
                decided_at=float(raw.get("decided_at") or time.time()),
            )
        except (KeyError, TypeError, ValueError):
            self._persist(None)
            return

        if time.time() - pending.created > MAX_WAIT_SECONDS:
            log.info("Dropping a stale pending switch to %s", pending.ref)
            self._persist(None)
            return

        # If the pid has been recycled onto an unrelated process we simply wait for
        # that one to exit instead. The switch is still guarded at the moment it acts
        # (_perform re-checks the tree and refuses a dirty one), and the alternative,
        # checking out under a KiCad that is actually still open, is the dangerous one.
        log.info(
            "Resuming a pending switch to %s (KiCad pid %s)", pending.ref, pending.kicad_pid
        )
        with self._lock:
            self._cancel = threading.Event()
            self._pending = pending
            cancel = self._cancel
            self._thread = threading.Thread(
                target=self._watch, args=(pending, cancel), daemon=True,
                name="prism-switch-watch",
            )
            self._thread.start()

    def schedule(
        self,
        *,
        repo: str,
        ref: str,
        project_dir: str,
        kicad_pid: int,
        resolution: str = "",
    ) -> dict:
        """Record a switch and start watching. Replaces any pending one.

        Refuses if KiCad is not actually running under that pid: scheduling against a
        dead pid would fire immediately, possibly onto a tree KiCad had not finished
        writing on exit.
        """
        if not discovery._pid_alive(kicad_pid):
            raise checkout.CheckoutError(
                "KiCad does not appear to be running, so there is nothing to wait for. "
                "Switch from the panel while KiCad is open."
            )

        with self._lock:
            self._cancel.set()  # stop any existing watcher
            self._cancel = threading.Event()
            self._pending = PendingSwitch(
                repo=repo,
                ref=ref,
                project_dir=project_dir,
                kicad_pid=kicad_pid,
                resolution=resolution,
            )
            cancel = self._cancel
            pending = self._pending
            self._persist(pending)  # survive an agent restart before KiCad closes
            self._thread = threading.Thread(
                target=self._watch, args=(pending, cancel), daemon=True,
                name="prism-switch-watch",
            )
            self._thread.start()
        return {"ok": True, "scheduled": True, "ref": ref}

    def cancel(self) -> dict:
        """Drop the pending switch, if any. The user changed their mind."""
        with self._lock:
            had = self._pending is not None
            self._cancel.set()
            self._pending = None
            self._persist(None)
        return {"ok": True, "cancelled": had}

    def pending(self) -> dict | None:
        with self._lock:
            if self._pending is None:
                return None
            return {"ref": self._pending.ref, "project_dir": self._pending.project_dir}

    # -- the watcher -------------------------------------------------------

    def _watch(self, pending: PendingSwitch, cancel: threading.Event) -> None:
        """Wait for KiCad to close, then do the switch. Runs on its own thread."""
        log.info(
            "Switch scheduled: %s -> %s, watching KiCad pid %s",
            pending.repo, pending.ref, pending.kicad_pid,
        )
        deadline = pending.created + MAX_WAIT_SECONDS
        while not cancel.is_set():
            if not discovery._pid_alive(pending.kicad_pid):
                break
            if time.time() > deadline:
                self._clear_if_current(pending)
                self._notify(
                    "Prism",
                    "Gave up waiting for KiCad to close, so the branch switch to "
                    "%s was cancelled." % pending.ref,
                )
                return
            if cancel.wait(POLL_SECONDS):
                return  # cancelled

        if cancel.is_set():
            return

        # KiCad is gone. Let the OS settle before touching the tree.
        log.info("KiCad pid %s exited; performing switch to %s", pending.kicad_pid, pending.ref)
        time.sleep(SETTLE_SECONDS)
        # Drop the in-memory slot now (a new schedule may legitimately replace this
        # one), but keep the persisted record until the switch has actually been
        # attempted. Clearing it first meant an agent that stopped in this window lost
        # the switch entirely, which is the very thing persistence exists to prevent.
        self._clear_if_current(pending, persist=False)
        try:
            self._perform(pending)
        finally:
            self._persist(None)

    def _clear_if_current(self, pending: PendingSwitch, persist: bool = True) -> None:
        """Release the pending slot if it is still this switch.

        `persist=False` leaves the on-disk record alone, for the caller that is about
        to act on it and wants it to survive until it has.
        """
        with self._lock:
            if self._pending is pending:
                self._pending = None
                if persist:
                    self._persist(None)

    def _unsettled_dirt(self, repo: Path, pending: PendingSwitch) -> set:
        """Dirty files that are NOT explained by KiCad writing on its way out.

        The user answered for the tree as it stood at `decided_at`, and the agent then
        cleaned it. Anything dirty now was written after that moment, by KiCad shutting
        down (it rewrites .kicad_pro with the defaults for its version, drops
        autosaves, touches the .prl) or by a person who reopened KiCad and did real
        work.

        Modification time is what separates them, because the FILENAME does not: the
        reported bug was a .kicad_pro the user had never touched, so a set of paths
        they answered about would not have contained it. A file written within the
        shutdown window is KiCad's; one written later is somebody's work, and its
        presence cancels the re-apply entirely rather than being discarded with the
        rest.
        """
        try:
            dirt = checkout.dirty_files(repo)
        except checkout.CheckoutError:
            # Cannot tell, so assume the worst and leave the tree alone.
            return {"<unknown>"}

        cutoff = pending.decided_at + SHUTDOWN_WINDOW_SECONDS
        unexplained = set()
        for rel in dirt.get("blocking") or ():
            try:
                written = (repo / rel).stat().st_mtime
            except OSError:
                # Deleted rather than modified. Not something KiCad does on exit, so
                # it is not ours to assume about.
                unexplained.add(rel)
                continue
            if written > cutoff:
                unexplained.add(rel)
        return unexplained

    def _perform(self, pending: PendingSwitch) -> None:
        """Re-check the guard, check out, reopen. Any failure is reported to the user."""
        repo = Path(pending.repo)

        # The user may have reopened KiCad in the gap, or KiCad may have written files on
        # close (autosave, project settings). Re-check right before acting rather than
        # trusting the state from when the switch was scheduled.
        try:
            state = checkout.status(repo, pending.ref)
        except checkout.CheckoutError as exc:
            log.warning("Switch to %s aborted: status failed: %s", pending.ref, exc)
            self._notify("Prism", "Couldn't switch to %s: %s" % (pending.ref, exc))
            return

        if not state["can"] and state.get("reason") == "dirty" and pending.resolution:
            # KiCad rewrites files of its own as it exits: it expands .kicad_pro with
            # the defaults for its version, writes autosaves, touches the .prl. A tree
            # the user cleaned a moment ago is dirty again through nothing they did,
            # and refusing here made "discard, then switch" fail every single time on
            # a project KiCad had upgraded the format of.
            #
            # So their answer is re-applied, to KiCad's own writes only. What makes
            # that safe is `settled`: those are the exact paths that were dirty when
            # they answered. Anything else dirty now is work from after the decision,
            # and the refusal below still stands for it.
            extra = self._unsettled_dirt(repo, pending)
            if extra:
                log.info(
                    "Not re-applying '%s': %d file(s) dirty that the user never saw: %s",
                    pending.resolution, len(extra), ", ".join(sorted(extra)[:5]),
                )
            else:
                log.info(
                    "Re-applying '%s' to what KiCad wrote on exit, before switching to %s",
                    pending.resolution, pending.ref,
                )
                try:
                    if pending.resolution == "discard":
                        checkout.discard(repo)
                    elif pending.resolution == "stash":
                        checkout.stash(repo, "changes KiCad wrote on exit")
                    state = checkout.status(repo, pending.ref)
                except checkout.CheckoutError as exc:
                    log.warning("Couldn't re-apply '%s': %s", pending.resolution, exc)

        if not state["can"]:
            log.warning(
                "Switch to %s refused after close: reason=%s message=%s",
                pending.ref, state.get("reason"), state.get("message"),
            )
            # Dirty again, or the ref vanished. Do not stash or discard without asking;
            # tell the user and leave the tree as it is.
            self._notify(
                "Prism",
                "Couldn't switch to %s after closing KiCad:\n\n%s\n\n"
                "Your files are unchanged. Sort it out in the panel and try again."
                % (pending.ref, state["message"]),
            )
            return

        try:
            checkout.checkout(repo, pending.ref)
        except checkout.CheckoutError as exc:
            self._notify(
                "Prism",
                "Couldn't switch to %s: %s\n\nYour files are unchanged."
                % (pending.ref, exc),
            )
            return

        # Reopen. The project file may not exist on the target branch (renamed/removed),
        # in which case there is nothing to open, say so rather than failing silently.
        pro = open_project.find_project_file(pending.project_dir)
        if not pro:
            self._notify(
                "Prism",
                "Switched to %s, but it has no KiCad project file to reopen in %s."
                % (pending.ref, pending.project_dir),
            )
            return

        try:
            open_project.launch_kicad(pending.project_dir)
        except open_project.OpenError as exc:
            self._notify(
                "Prism",
                "Switched to %s, but couldn't reopen KiCad: %s" % (pending.ref, exc),
            )
            return

        log.info("Switched %s to %s and reopened", pending.repo, pending.ref)

        # If work was set aside from the branch we just landed on, tell the user it is
        # there. Not auto-applied: a restore can conflict, and it is theirs to trigger
        # from the panel. Only a returnable stash whose origin matches this branch.
        try:
            current = checkout.status(repo).get("current_branch") or ""
            match = checkout.find_returnable_stash(repo, current) if current else None
        except checkout.CheckoutError:
            match = None
        if match:
            self._notify(
                "Prism",
                "Reopened on %s. This branch has a stash (\"%s\"); apply it from the "
                "Prism panel when you're ready."
                % (current, match.get("message") or "your changes"),
            )
