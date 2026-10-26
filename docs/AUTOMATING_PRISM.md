# Automating Prism

Prism can be driven three ways:

| Need | Use |
| --- | --- |
| Call Prism from any language, or from CI | the HTTP API at `/api/v1` |
| Python scripts and a terminal command | the `kicad-prism` package and its `prism` CLI |
| An AI assistant reading designs | the MCP server at `/mcp` |

All three go through the same API, the same role checks and the same folder visibility as the web UI. None of them can do something the caller couldn't do in the browser. Sign-offs (release approval, resolving comments, catalog QA and admin changes) stay with people signed in to Prism. Tokens can't perform them.

The design is in [ADR: scripting and MCP](architecture/adr-scripting-and-mcp.md).

## Tokens

Scripts and the CLI use a **personal access token** (PAT). To create one, open **Settings → Personal access tokens**, choose the scopes and an expiry, and copy the token. It is shown once and starts with `prism_pat_`.

| Scope | Allows |
| --- | --- |
| `api:read` | every read the token's owner can make (always included) |
| `comments:write` | create, edit and reply to comments (not resolve) |
| `design:write` | project and design changes that aren't sign-offs |
| `catalog:write` | catalog edits |
| `api:write` | all of the write scopes above |

A token acts with its owner's **current** role. If the owner is demoted or removed, the token loses that access at once. Revoke tokens in the same Settings page.

MCP clients don't use PATs. They sign in with OAuth (see [AI assistants (MCP)](#ai-assistants-mcp)) and appear under **Settings → Connected MCP clients**.

## HTTP API

- Base path `/api/v1`. The unversioned `/api` paths still work until v6.
- The OpenAPI document is at `/api/v1/openapi.json`. Every operation has a stable `operationId` and a typed response.
- Authenticate with `Authorization: Bearer <token>`.
- Errors are JSON `{detail, code}`.
- **Retrying writes safely:** send `Idempotency-Key: <uuid>` on a `POST`, `PUT`, `PATCH` or `DELETE`. Repeating the request with the same key within 24 hours returns the first response, marked with the `Idempotent-Replayed: true` header, instead of doing the work twice.
- **Pinning a revision:** design search, component and net reads take `revision` (a branch or commit), and the BOM takes `commit`. The response names the commit it read, so later calls can pin it.
- **Long work** (comparisons, bundle builds, imports) returns a job id. Poll `GET /api/v1/jobs/{job_id}` until the job finishes.
- **Events:** `GET /api/v1/events?after=<cursor>` lists what happened, oldest first: syncs, bundles, jobs, comparisons, comment changes and releases. The live socket `/api/v1/events/live` pushes the same events. Events retention is `PRISM_EVENT_RETENTION_DAYS` ([Configuration](CONFIGURATION.md)).

## Python SDK and CLI

```bash
pip install ./sdk/python
```

```bash
export PRISM_URL=https://prism.example.com
```

```bash
export PRISM_TOKEN=prism_pat_...
```

```python
from prism import Client

prism = Client()  # PRISM_URL and PRISM_TOKEN from the environment
bom = prism.get_project_bom("my-project")  # pin with commit="<sha>"
for line in bom["lines"]:
    print(line["quantity"], line["references"], line["fields"].get("Value"))
```

```bash
prism bom my-project --csv > bom.csv
```

Every API operation is a method named after its `operationId`. The package has no dependencies beyond the standard library. It isn't on PyPI yet. The [SDK README](../sdk/python/README.md) covers every command, the helpers (`iter_events`, `wait_for_job`) and how the client is regenerated.

## AI assistants (MCP)

### Turn it on

The MCP server is off by default. An admin sets these and restarts the backend:

```
PRISM_MCP_ENABLED=true
PUBLIC_BASE_URL=https://prism.example.com
```

`PUBLIC_BASE_URL` must be the address clients use: OAuth tokens are bound to `<PUBLIC_BASE_URL>/mcp`. While the server is off, `/mcp` and its OAuth metadata answer 404. See [Configuration](CONFIGURATION.md).

### Connect a client

The server is `https://prism.example.com/mcp` (Streamable HTTP). Clients that support MCP OAuth find the sign-in page on their own: the first connection opens Prism in the browser, you approve the client, and it's connected.

Claude Code:

```bash
claude mcp add --transport http prism https://prism.example.com/mcp
```

Claude Desktop and claude.ai: add a custom connector with the same URL.

A client without OAuth support can send a personal access token instead, as `Authorization: Bearer prism_pat_...`.

### What an assistant can do

The v5.1 tools are read-only:

| Tool | Returns |
| --- | --- |
| `search_projects`, `get_project`, `list_revisions` | projects and their commits |
| `find_in_design`, `get_component`, `get_net` | components and nets at a revision, with fields, pins and connections |
| `get_bom` | the engineering BOM at a revision |
| `compare_revisions`, `get_changes`, `get_comparison_review` | a comparison between two revisions, as the review rows the Design Comparison workspace shows |
| `get_job` | a job's status |
| `list_comments` | a project's comments |
| `search_catalog`, `get_catalog_component` | the component catalog |
| `get_release_status` | Release Studio candidates |
| `render_view` | a PNG of a schematic sheet, the PCB, or a 3D view at a revision, with chosen components or nets highlighted (no highlights in 3D) |

Results name the revision they read, and cite a Prism link and a `prism://` resource URI for each component, net or BOM. Comment text, field values and file contents come back as data marked untrusted, and no tool acts on instructions found inside them.

### What admins control

Admins configure MCP under **Settings → MCP**:

- **Project scope:** all projects (each user still sees only what their role and folder visibility allow), or a listed set. Outside a listed set, a project looks to an assistant exactly like one that doesn't exist.
- **Tools:** switch off any tool. A disabled tool disappears from the assistant's tool list.
- **Read audit:** every MCP read is recorded with the user, client, tool, project, revision and outcome, and shown on the same page with filters. Rows are kept for `PRISM_MCP_AUDIT_RETENTION_DAYS` (default 365).

Users see and revoke their own connected clients under **Settings → Connected MCP clients**, and admins see everyone's.

Designs an assistant reads are sent to that assistant's model provider. Before enabling MCP, decide which projects may leave Prism this way, and limit MCP to them.
