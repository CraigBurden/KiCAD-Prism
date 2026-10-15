"""Shared pieces of the System Builder service: caller, result, defaults and plumbing.

The service is one class (``service.SystemService``) assembled from mixins by area;
this module holds what every area uses.
"""

from __future__ import annotations

import logging
import re
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Callable, ContextManager, Iterable, Iterator, Mapping, Optional, Sequence

from app.core.roles import Role
from app.services.systems import exports as exports_module, git_tracking, modules, visibility
from app.services.systems.bundles import BundleSource, latest_job
from app.services.systems.interface_extractor import EXTRACTOR_VERSION
from app.services.systems.jobs import (
    enqueue_extraction,
    workspace_connection,
)
from app.services.systems.store import Conflict, NotFound, SystemStore

# One logger name for the whole service, whichever area module logs.
logger = logging.getLogger("app.services.systems.service")

MAX_LAYOUT_ENTRIES = 1000
_FULL_SHA = re.compile(r"^[0-9a-f]{40}$")
_ACTIVE_JOB_STATES = frozenset({"queued", "running", "retry_wait", "cancel_requested"})
_BUNDLE_BUILDERS = frozenset({"admin", "designer"})  # who may queue a board's 3D bundle (as on its 3D tab)


@dataclass(frozen=True)
class Caller:
    role: Role
    email: str
    name: str = ""

    @property
    def actor(self) -> str:
        return f"user:{self.email or 'anonymous'}"


@dataclass(frozen=True)
class Result:
    """A payload plus the system version after the call (for the ETag)."""

    body: Any
    system_id: str
    version: int

    @property
    def etag(self) -> str:
        return visibility.etag(self.system_id, self.version)


def _mating_summary(record: Optional[Mapping[str, Any]]) -> Optional[dict]:
    return None if record is None else {k: record[k] for k in ("mode", "axis", "quarterTurns")}


def _iso(value: Any) -> Any:
    return value.isoformat() if isinstance(value, datetime) else value


def _default_project_loader(project_id: str) -> Any:
    # Role-blind by design: every caller authorizes the project first, through
    # ``visibility.project_access`` (``_require_project``/``_open_instance``).
    from app.services.project_service import _workspace_row_to_project
    from app.services.workspace_service import workspace

    row = workspace.get_project_by_id(project_id)
    return _workspace_row_to_project(row) if row else None


def _default_catalog() -> Any:
    """The catalog's modules, assemblies and "mates with" (``catalog/system_items_facade.py``)."""
    from app.services.component_catalog_service import catalog_service

    return catalog_service.system_items


def _default_enqueue_check(instance_id: str, project_id: str, *, requested_by: str) -> Mapping[str, Any]:
    from app.services.systems.detection import enqueue_instance_check

    return enqueue_instance_check(instance_id, project_id, requested_by=requested_by)


class ServiceCore:
    def __init__(
        self,
        *,
        connect: Callable[[], ContextManager[Any]] = workspace_connection,
        project_loader: Callable[[str], Any] = _default_project_loader,
        enqueue: Callable[..., Mapping[str, Any]] = enqueue_extraction,
        enqueue_check: Callable[..., Mapping[str, Any]] | None = None,
        catalog: Callable[[], Any] = _default_catalog,
        bundles: Any = None,
    ) -> None:
        self._catalog = catalog
        self._bundles = bundles or BundleSource()
        self._connect = connect
        self._load_project = project_loader
        self._enqueue = enqueue
        self._enqueue_check = enqueue_check or _default_enqueue_check

    # ------------------------------------------------------------------
    # Plumbing

    @contextmanager
    def _tx(self, *, consistent: bool = False) -> Iterator[SystemStore]:
        """A transaction. ``consistent`` reads every statement from one snapshot (REPEATABLE READ),
        so a long read sees a single version of the system without holding its lock (SB2-94).

        Once a transaction that created or changed systems has committed, their finding counts are
        refreshed outside the lock (D12, ``refresh_finding_counts``)."""
        with self._connect() as conn:
            try:
                if consistent:
                    conn.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
                store = SystemStore(conn)
                yield store
                conn.commit()
            except BaseException:
                conn.rollback()
                raise
        if store.recount:
            self.refresh_finding_counts(sorted(store.recount))

    def _system(self, store: SystemStore, system_id: str, caller: Caller) -> dict:
        found = visibility.visible_systems(store.conn, caller.role, system_id=system_id)
        if not found:
            raise NotFound("System not found")
        return found[0]

    def _access(self, store: SystemStore, instances: Sequence[dict], caller: Caller) -> dict[str, dict]:
        # Assembly and module instances have no project: they are the parent's own (P2 §5.4).
        return visibility.project_access(store.conn, [i["project_id"] for i in instances if i.get("project_id")],
                                         caller.role)

    def _open_instance(
        self, store: SystemStore, system_id: str, instance_id: str, caller: Caller,
        *, allow_deleted: bool = False,
    ) -> dict:
        """An instance the caller may change; restricted ones are 404 (§8.2).

        ``allow_deleted`` admits an instance restricted only because its project
        was deleted: removing it reveals nothing.
        """

        try:
            instance = store.get_instance(system_id, instance_id)
        except NotFound:
            raise NotFound("Instance not found") from None
        if instance.get("kind", "board") != "board":
            return instance  # the parent's own instance; what it pins is redacted on read, not here
        access = self._access(store, [instance], caller)[instance["project_id"]]
        if not access["visible"] and not (allow_deleted and access["deleted"]):
            raise NotFound("Instance not found")
        return instance

    def _instance_interface(self, store: SystemStore, instance: Mapping[str, Any]) -> Optional[dict]:
        """A board's interface at its baseline, an assembly's exports as one (P2 §6.1), or a module's
        connectors as one (P2 §5.6)."""
        if instance.get("kind", "board") == "board":
            return store.get_interface(instance["project_id"], instance["baseline_commit"], EXTRACTOR_VERSION)
        if instance.get("kind") == "module":
            return self._module_interface(instance["catalog_revision_id"])
        if instance.get("kind") == "part":
            return self._part_interface(instance["catalog_revision_id"])
        revision = self._catalog_revision(instance["catalog_revision_id"])
        return exports_module.as_interface((revision or {}).get("interface")) if revision else None

    def _interface(self, store: SystemStore, instance: dict) -> dict:
        found = self._instance_interface(store, instance)
        if found is None:
            if instance.get("kind", "board") != "board":
                raise Conflict(f"the {'module' if instance.get('kind') == 'module' else 'subsystem'}'s catalog revision "
                               "cannot be read; try again")
            raise Conflict("The board interface at this baseline is still being extracted", code="interface_not_ready")
        return found

    def _require_project(self, store: SystemStore, project_id: str, caller: Caller) -> Any:
        access = visibility.project_access(store.conn, [project_id], caller.role).get(project_id)
        project = self._load_project(project_id) if access and access["visible"] else None
        if project is None:
            raise NotFound("Project not found")
        return project

    def _enqueue_quietly(self, project_id: str, commit: str, caller: Caller) -> Optional[dict]:
        try:
            return dict(self._enqueue(project_id, commit, requested_by=caller.email))
        except Exception:  # extraction is re-requested by the next read
            logger.exception("Could not enqueue interface extraction for %s@%s", project_id, commit)
            return None

    # ------------------------------------------------------------------
    # Catalog revisions behind assembly, module and part instances (P2 §5.1, §5.6)

    def _catalog_revision(self, revision_id: str) -> Optional[dict]:
        try:
            return self._catalog().system_revision(revision_id)
        except Exception:  # the catalog is a separate service; documents must still render
            logger.exception("Could not read catalog revision %s", revision_id)
            return None

    def _module_interface(self, revision_id: str) -> Optional[dict]:
        """A module revision's connectors as an interface artifact (§5.6): its units, the connector
        parts placed on it today (§3.6) and its model. Placements or a model the catalog can't give
        leave the ports without geometry (they link but can't mate)."""
        revision = self._catalog_revision(revision_id)
        if revision is None:
            return None
        catalog = self._catalog()
        try:
            connectors = catalog.module_connectors(revision["componentId"])
        except Exception:  # the catalog is a separate service; the ports still link
            logger.exception("Could not read the connectors of module %s", revision["componentId"])
            connectors = None
        return modules.as_interface(revision.get("interface"), connectors,
                                    self._catalog_model(revision["componentId"], revision_id))

    def _part_interface(self, revision_id: str) -> Optional[dict]:
        """A mechanical part (P2 §24.1) as an interface with no ports: its model and aligned bounds."""
        revision = self._catalog_revision(revision_id)
        if revision is None:
            return None
        return modules.as_interface({"units": []}, None, self._catalog_model(revision["componentId"], revision_id))

    def _child_interface(self, revision_id: str) -> Optional[dict]:
        """reconcile.ChildLoader: a catalog revision's exports as an interface artifact."""
        revision = self._catalog_revision(revision_id)
        return exports_module.as_interface(revision.get("interface")) if revision else None

    def _catalog_model(self, component_id: str, revision_id: str) -> Optional[dict]:
        """A catalog revision's first converted model with its alignment (§18.2), or None."""
        try:
            found = next((m for m in self._catalog().list_models(component_id, revision_id) if m["glb"]), None)
        except Exception:
            logger.debug("No model for component %s", component_id, exc_info=True)
            found = None
        return None if found is None else {
            "glbKey": found["glb"]["key"], "boundsMm": found["glb"]["bounds"],
            "alignment": {k: found["alignment"][k] for k in ("offsetMm", "rotationDeg", "scale")}}

    def _queue_pinned_conversions(self, pins: Iterable[tuple[str, str]], caller: Caller) -> None:
        """Queue the catalog's GLB conversion for each pinned ``(component, revision)`` whose STEP models
        have none yet. Never once a job for that key has ended: a read neither retries a failed or cancelled
        attempt nor repeats a completed one that left no GLB; Convert on the part (with ``revisionId``) does.
        The caller must already hold ``catalog_write``."""
        from app.services.catalog import models as catalog_models
        from app.services.catalog_job_service import catalog_jobs

        for component_id, revision_id in sorted(set(pins)):
            try:
                listed = self._catalog().list_models(component_id, revision_id)
            except (LookupError, ValueError) as refused:  # deactivated, or not a part or module: nothing to convert
                logger.debug("No models to convert for %s@%s: %s", component_id, revision_id, refused)
                continue
            try:
                if not listed or any(m["glb"] for m in listed):
                    continue
                key = catalog_models.conversion_job_key(component_id, revision_id)
                last = latest_job("catalog_model_glb", key)
                if last and last["status"] in ("completed", "failed", "cancelled"):
                    continue
                catalog_jobs.enqueue("catalog_model_glb", {"componentId": component_id, "revisionId": revision_id},
                                     created_by=caller.email, idempotency_key=key)
            except Exception:
                logger.exception("Could not queue the models of %s@%s for conversion", component_id, revision_id)

    # ------------------------------------------------------------------
    # Git tracking hooks shared by the Git and Snapshot areas (P2 §21)

    _git_enqueue_commit = staticmethod(git_tracking.enqueue_commit)

    def _git_link_row(self, store: SystemStore, system_id: str) -> Optional[dict]:
        row = store.conn.execute("SELECT * FROM system_git_links WHERE system_id = %s", (system_id,)).fetchone()
        return dict(row) if row else None

    @staticmethod
    def _queued_git(previous: Optional[Mapping[str, Any]] = None, caller: Optional[Caller] = None) -> dict:
        author = (previous or {}).get("author") or {"name": caller.name if caller else "",
                                                    "email": caller.email if caller else ""}
        return {"state": "queued", "author": author}

    def _snapshot_git(self, store: SystemStore, system_id: str, caller: Caller) -> Optional[dict]:
        """The new snapshot's ``git`` status, or a 409 while an outside change waits (§21.3)."""
        link = self._git_link_row(store, system_id)
        if link is None:
            return None
        if link["outside_commit"]:
            raise Conflict(f"git_outside_change: {link['outside_commit']} changed {git_tracking.MANIFEST_FILE} "
                           "outside Prism; import it through review before taking a snapshot")
        return self._queued_git(caller=caller)

    def _publication_git(self, store: SystemStore, system_id: str,
                         git: Optional[Mapping[str, Any]]) -> Optional[dict]:
        """The commit a snapshot's revision records, or None. A commit still in flight is a 409, so a
        linked system's revision never misses a commit that is about to exist."""
        state = (git or {}).get("state")
        if state == "queued":
            raise Conflict("git_commit_pending: the snapshot is still being committed; publish it once it is")
        if state != "pushed":
            return None
        link = self._git_link_row(store, system_id)
        return {"url": link["url"] if link else None, "branch": git["branch"], "commit": git["commit"]}

    def _git_quietly(self, enqueue: Any, *args: Any, requested_by: str) -> None:
        try:
            enqueue(*args, requested_by=requested_by)
        except Exception:  # the link or snapshot is stored; a fetch or retry queues it again
            logger.exception("Could not queue Git work for %s", args)
