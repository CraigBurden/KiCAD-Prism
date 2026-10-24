"""Run a route's blocking file reads off the event loop, with bounded concurrency.

The viewer-source and commit-file routes prepare files: they open a revision's
design bundle, inflate a 50 MB board, inline a whole schematic hierarchy, or
read a file out of a Git commit. That work is synchronous and can hold its
thread for a second or more, so an ``async def`` route must not do it on the
event loop; one large read otherwise stalls every request in the process.

``run_bounded_io`` hands the call to the anyio thread pool and admits at most
:data:`MAX_CONCURRENT_LARGE_READS` of them at once. The bound is on memory, not
just threads: each admitted call can hold one member's bytes and, for an
inlined hierarchy, its decoded text and serialized JSON (roughly three copies
of a 60 MB member). Four admitted calls keep the worst case in the low
hundreds of megabytes however many clients ask for large files, instead of
growing with the client count. Small reads that go through this helper can
wait behind a large one; Git listings and database lookups keep using the
general thread pool so they do not.

The helper runs the whole route body, not just one call: the answer is ready
before anything is rendered, and exceptions (``HTTPException``, the typed
design-data answer) cross the thread boundary unchanged, so error mapping stays
the route's.
"""

from __future__ import annotations

import functools
from typing import Callable, TypeVar

from anyio import CapacityLimiter
from anyio.to_thread import run_sync

T = TypeVar("T")

#: How many whole-file reads may run at once. Each can hold a member's bytes,
#: its decoded text and a serialized copy; see the module docstring for the
#: transient cost this bounds.
MAX_CONCURRENT_LARGE_READS = 4

_LARGE_READS = CapacityLimiter(MAX_CONCURRENT_LARGE_READS)


async def run_bounded_io(func: Callable[..., T], /, *args: object, **kwargs: object) -> T:
    """``func(*args, **kwargs)`` in a worker thread, at most the bound at a time."""

    return await run_sync(functools.partial(func, *args, **kwargs), limiter=_LARGE_READS)
