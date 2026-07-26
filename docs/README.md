# KiCAD Prism documentation

This documentation describes the current `dev` branch as it approaches the
V3.0.0 alpha. Start with the path that matches what you are trying to do.

## Evaluate Prism

- [Platform overview](OVERVIEW.md) explains what Prism does, where it fits, and
  its current boundaries.
- [Architecture](ARCHITECTURE.md) describes the runtime services, persistent
  data, and trust boundaries.
- [Team adoption](TEAM_ADOPTION.md) proposes a staged rollout for project
  review and component governance.

## Install and operate Prism

- [Getting started](GETTING_STARTED.md) covers a local evaluation.
- [Deployment](DEPLOYMENT.md) covers a shared HTTPS deployment.
- [Configuration](CONFIGURATION.md) is the environment and `.prism.json`
  reference.
- [Authentication and access](AUTHENTICATION_AND_ACCESS.md) covers OIDC,
  sessions, roles, and service clients.
- [Operations](OPERATIONS.md) covers backups, restores, upgrades, logs, and
  troubleshooting.

## Use Prism

- [Project workflows](PROJECT_WORKFLOWS.md) covers import, sync, browser review,
  comments, comparisons, jobsets, and assets.
- [Library Manager](LIBRARY_MANAGER.md) covers component import, revision, QA,
  release, KLC checks, and DBL export.
- [Remote Symbol Provider](REMOTE_SYMBOL_PROVIDER.md) covers connecting desktop
  KiCad and placing released components.

## Participate

- [Contributing](../CONTRIBUTING.md) explains the development and pull-request
  workflow.
- [Reporting issues](REPORTING_ISSUES.md) explains where and how to report bugs,
  feature requests, documentation gaps, and security concerns.
- [Security policy](../SECURITY.md) explains private vulnerability reporting.

## Documentation policy

The documents above are user and operator documentation. Temporary implementation
plans, benchmark transcripts, conference notes, and completed migration records
do not belong in this directory. Keep that material in a tracking issue,
discussion, pull request, or release artifact where its date and status remain
clear.

When behavior changes, update the relevant document in the same pull request.
Examples must use placeholders instead of real credentials, internal hostnames,
or production data.
