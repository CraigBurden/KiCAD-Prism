"""System Builder application service: the SYS-04 CRUD surface of §8.

Each public method runs in one transaction, authorizes the caller against the
system (§8.2), applies O1 redaction, and turns ``SystemStore`` results into
the camelCase documents the API returns. Git lookups run before the
transaction; extraction jobs are enqueued after it commits.

Detection, reviews, validation, snapshots and imports arrive with their own
tickets (SYS-06 to SYS-10) and extend this service.

The class is assembled from mixins by area (``service_documents``,
``service_assemblies``, ``service_harnesses``, ``service_reviews``, ``service_git``) over
``service_base.ServiceCore``; callers keep importing from this module.

Reads go through one ``loaded.LoadedSystem`` per transaction. Documents are built
unredacted (``_build``, with ``validation.report``) and redacted for the reader at one
exit (``_for_reader``), so a snapshot can freeze one document and serve it to any
reader later (§9.1).
"""

from __future__ import annotations

# Re-exported: callers and tests import these from here.
from app.services.systems.interface_extractor import EXTRACTOR_VERSION  # noqa: F401
from app.services.systems.service_assemblies import AssembliesMixin
from app.services.systems.service_base import Caller, Result, ServiceCore  # noqa: F401
from app.services.systems.service_collisions import CollisionsMixin
from app.services.systems.service_documents import DocumentsMixin
from app.services.systems.service_git import GitMixin
from app.services.systems.service_harness_outputs import HarnessOutputsMixin
from app.services.systems.service_harnesses import HarnessesMixin
from app.services.systems.service_renames import RenamesMixin
from app.services.systems.service_reviews import ReviewsMixin
from app.services.systems.service_step_export import StepExportMixin
from app.services.systems.service_subports import SubportsMixin
from app.services.systems.store import SystemStore  # noqa: F401


class SystemService(DocumentsMixin, AssembliesMixin, HarnessesMixin, ReviewsMixin, SubportsMixin, RenamesMixin,
                    CollisionsMixin, StepExportMixin, HarnessOutputsMixin, GitMixin, ServiceCore):
    """The System Builder service. Each area lives in its own module (``service_*.py``)."""


service = SystemService()
