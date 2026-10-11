"""PostgreSQL persistence for System Builder (``docs/system-builder/CONTRACTS.md`` §5).

``SystemStore`` wraps a connection the caller owns; it never commits. Every
change to a system's engineering state happens inside ``store.mutation(...)``,
which:

* locks the ``system_projects`` row, so concurrent mutations of one system
  serialize;
* checks the caller's expected version (the ETag, §8), raising
  ``StaleVersion`` with the current version when it differs;
* records audit events in the same transaction as the change (§10.2);
* bumps the version exactly once when the block exits cleanly.

Detection passes ``expected_version=None``: it has no ETag, but its changes
still move the version so an editor holding the old ETag gets 412.

The class is assembled from one mixin per concept over ``store_base.StoreCore``:
``store_instances`` (instances, overrides), ``store_placement`` (mating, poses,
driving mates), ``store_links`` (links, rows, and harness ends seen as links),
``store_exports``, ``store_harnesses``, ``store_subports``, ``store_snapshots``,
``store_reviews`` (reviews, waivers, imports, history, layout, interface cache)
and ``store_renames``. Callers keep importing the limits and errors from here.

Reviews are opened and superseded here for detection (SYS-06), decided for
reconcile (SYS-07), and snapshots are frozen here for SYS-09.
"""

from __future__ import annotations

# Re-exported: callers import the limits, errors and helpers from here.
from app.services.systems.store_base import (  # noqa: F401
    MAX_INSTANCES, MAX_LINKS, MAX_ROWS, MAX_HARNESSES, MAX_HARNESS_ENDS, MAX_WIRES, HARNESS_END_PREFIX, MAX_EXPORTS,
    ROW_SOURCES, OVERRIDE_STATES, PORT_BASELINE_KEYS, SystemStoreError, NotFound, StaleVersion, Conflict, Invalid,
    Forbidden, new_id, Mutation, StoreCore,
)
from app.services.systems.links import TYPES as LINK_TYPES  # noqa: F401
from app.services.systems.store_exports import ExportsStore
from app.services.systems.store_harnesses import HarnessesStore
from app.services.systems.store_instances import InstancesStore
from app.services.systems.store_links import LinksStore
from app.services.systems.store_placement import PlacementStore
from app.services.systems.store_renames import RenamesStore
from app.services.systems.store_reviews import ReviewsStore
from app.services.systems.store_snapshots import SnapshotsStore
from app.services.systems.store_subports import SubportsStore


class SystemStore(InstancesStore, PlacementStore, LinksStore, ExportsStore, HarnessesStore, SubportsStore,
                  SnapshotsStore, ReviewsStore, RenamesStore, StoreCore):
    """Persistence for one connection. Each concept lives in its own module (``store_*.py``); a module calls
    another's public methods only."""
