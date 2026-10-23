"""The worker's memory budget for admission control.

Heavy jobs hold units of the shared ``memory`` resource slot
(``app.services.job_kinds``); this module owns the unit size and the default
budget.

The default budget is half of the memory the process may use -- the container's
cgroup limit (v2 ``memory.max``, else v1 ``memory.limit_in_bytes``) or, when no
limit is published, the machine's physical memory -- clamped to
[``MIN_BUDGET_MIB``, ``MAX_BUDGET_MIB``] and rounded down to whole units. Half
leaves room for the API, PostgreSQL and the OS, which share the container with
the worker. On the 7.75 GiB deployment this yields 4 GiB. Reading one small
file once at startup is cheap; the fallback is a fixed 4 GiB.

``PRISM_WORKER_MEMORY_BUDGET_MIB`` overrides the derived value. A budget whose
unit count is below one kind's weight would starve that kind, so the worker
refuses to start in that case (``app.prism_worker.PrismWorker.run``).
"""

from __future__ import annotations

import os
from pathlib import Path

#: Granularity of the ``memory`` resource slot. A job holds ceil(peak / unit)
#: slots, so the slot table stays small (4 GiB is 16 rows, not 4096).
MEMORY_UNIT_MIB = 256

#: Used when no memory limit can be read.
FALLBACK_BUDGET_MIB = 4096
#: A lone heavy job must fit; the heaviest declared weight is 3328 MiB
#: (release_studio_build). Smaller deployments should set the budget
#: explicitly and accept that the heaviest job cannot run.
MIN_BUDGET_MIB = 4096
#: Conservative ceiling for the default; operators raise the setting for a
#: larger box instead of silently overriding the worker's other memory users.
MAX_BUDGET_MIB = 8192

_CGROUP_V2_LIMIT = Path("/sys/fs/cgroup/memory.max")
_CGROUP_V1_LIMIT = Path("/sys/fs/cgroup/memory/memory.limit_in_bytes")
_UNLIMITED_THRESHOLD = 1 << 60


def _positive_limit(path: Path) -> int | None:
    try:
        text = path.read_text(encoding="ascii").strip()
    except (OSError, UnicodeDecodeError):
        return None
    if not text or text == "max":
        return None
    try:
        value = int(text)
    except ValueError:
        return None
    if value <= 0 or value >= _UNLIMITED_THRESHOLD:
        return None
    return value


def memory_limit_bytes() -> int | None:
    """The memory the worker may use, if the platform publishes one."""

    for path in (_CGROUP_V2_LIMIT, _CGROUP_V1_LIMIT):
        limit = _positive_limit(path)
        if limit is not None:
            return limit
    try:
        pages = os.sysconf("SC_PHYS_PAGES")
        page_size = os.sysconf("SC_PAGE_SIZE")
    except (AttributeError, OSError, ValueError):
        return None
    if pages <= 0 or page_size <= 0:
        return None
    return int(pages) * int(page_size)


def default_worker_memory_budget_mib() -> int:
    """Half the available memory, clamped and rounded down to the slot unit."""

    limit = memory_limit_bytes()
    if limit is None:
        return FALLBACK_BUDGET_MIB
    half_mib = limit // (1024 * 1024) // 2
    clamped = min(MAX_BUDGET_MIB, max(MIN_BUDGET_MIB, half_mib))
    return (clamped // MEMORY_UNIT_MIB) * MEMORY_UNIT_MIB
