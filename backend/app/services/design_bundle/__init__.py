"""The design bundle: the only Python package that knows the bundle format.

ADR ``docs/architecture/adr-native-design-bundle.md``; contracts in
``native/contracts/prism/`` (``bundle-format.md``, ``cli-spec.md``,
``revision-key.md``). Modules:

- ``revision_key`` and ``effective_config``: the design revision key
  (Prism's Python reference) and the effective configuration Prism resolves;
- ``generator``: the generator id, its digest and the bundle key;
- ``archive``, ``manifest``, ``schemas``: the reader's validation, member
  readiness and the manifest invariants, against the committed JSON Schema;
- ``store``: archives, the unpacked cache, retention's file operations;
- ``rows``: the commit index and the bundle tables (workspace 100-102);
- ``cli``: running ``prism-kicad``; ``materialize``, ``kicad_steps``,
  ``stage_models``: what the job does around it;
- ``jobs``: the ``design_bundle`` job kind; ``backfill`` and ``retention``:
  the worker's upkeep; ``repo_hydration``: submodules and LFS for sync;
- ``reader``: how consumers open a revision's bundle and read members.
"""
