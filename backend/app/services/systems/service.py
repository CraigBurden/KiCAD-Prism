"""System Builder application service: the SYS-04 CRUD surface of §8.

Each public method runs in one transaction, authorizes the caller against the
system (§8.2), applies O1 redaction, and turns ``SystemStore`` results into
the camelCase documents the API returns. Git lookups run before the
transaction; extraction jobs are enqueued after it commits.

Detection, reviews, validation, snapshots and imports arrive with their own
tickets (SYS-06 to SYS-10) and extend this service.

The class is assembled from one mixin per concept over three layers; callers keep
importing from this module. Layers, bottom up:

* ``service_base.ServiceCore``: transactions, authorization of one instance or
  project, catalog revisions, each instance's interface, and the Git hooks;
* ``service_reading.ReadingCore``: the loaded view (``_load``) with the resolver
  methods it calls back, and reader visibility (what a caller may not see, the
  reader exits, the 404 lookups of one link, export or harness);
* ``service_rendering.RenderingCore``: the unredacted document (``_build``,
  ``validation.report``) and the row renderers and write bodies.

Concepts: ``service_systems``, ``service_documents`` (document, validation,
waivers), ``service_instances``, ``service_links``, ``service_exports``,
``service_harnesses``, ``service_placement``, ``service_nets``,
``service_snapshots``, ``service_reviews``, ``service_subports``,
``service_renames``, ``service_collisions``, ``service_step_export``,
``service_harness_outputs`` and ``service_git``. A concept mixin calls only its
own privates and the layers'; ``tests/test_system_service_layers.py`` checks it.

"""

from __future__ import annotations

# Re-exported: callers and tests import these from here.
from app.services.systems.interface_extractor import EXTRACTOR_VERSION  # noqa: F401
from app.services.systems.service_base import Caller, Result, ServiceCore  # noqa: F401
from app.services.systems.service_collisions import CollisionsMixin
from app.services.systems.service_documents import DocumentsMixin
from app.services.systems.service_exports import ExportsMixin
from app.services.systems.service_git import GitMixin
from app.services.systems.service_harness_outputs import HarnessOutputsMixin
from app.services.systems.service_harnesses import HarnessesMixin
from app.services.systems.service_instances import InstancesMixin
from app.services.systems.service_links import LinksMixin
from app.services.systems.service_nets import NetsMixin
from app.services.systems.service_placement import PlacementMixin
from app.services.systems.service_reading import ReadingCore
from app.services.systems.service_renames import RenamesMixin
from app.services.systems.service_rendering import RenderingCore
from app.services.systems.service_reviews import ReviewsMixin
from app.services.systems.service_snapshots import SnapshotsMixin
from app.services.systems.service_step_export import StepExportMixin
from app.services.systems.service_subports import SubportsMixin
from app.services.systems.service_systems import SystemsMixin
from app.services.systems.store import SystemStore  # noqa: F401

CONCEPTS = (SystemsMixin, DocumentsMixin, InstancesMixin, LinksMixin, ExportsMixin, HarnessesMixin, PlacementMixin,
            NetsMixin, SnapshotsMixin, ReviewsMixin, SubportsMixin, RenamesMixin, CollisionsMixin, StepExportMixin,
            HarnessOutputsMixin, GitMixin)
LAYERS = (RenderingCore, ReadingCore, ServiceCore)


class SystemService(*CONCEPTS, *LAYERS):
    """The System Builder service: one mixin per concept over the shared layers."""


service = SystemService()
