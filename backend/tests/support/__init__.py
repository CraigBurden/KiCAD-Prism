"""Shared test support for the backend suite.

- :mod:`support.postgres`: the test database URLs, a skip guard, scratch
  schemas migrated by the production ledgers (dropped on exit), and seed rows
  for tables whose production columns have no defaults.
- :mod:`support.repo`: Git repositories with a fixed author identity, and a
  KiCad project committed in one (optionally inside a monorepo).

Tests import these instead of writing their own ``DROP SCHEMA``, table copies
or ``git`` helpers; ``test_test_support`` fails when a copy comes back.
"""
