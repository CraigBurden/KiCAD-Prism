"""Provider kits: everything that differs between code hosts.

Every host Prism talks to has a ``HostKit``: which instance kinds it accepts and
how to validate one, its default host name, the shape of its repository paths,
and how people link accounts on it (OAuth app + identity adapter). A host that
can also publish issues carries a ``ProviderKit`` in ``HostKit.issues``:
credential fields, issue and comment adapters (which list their own recovery
pages), the connection test, the repository picker and web URLs. Gitea/Forgejo
is a linking-only kit (``issues`` is ``None``), not a set of ``if`` branches.

The tracker runtime (executors, recovery, connector runtime, connector
administration, identity linking and inbound webhooks) asks this module for a
provider's pieces instead of branching on the provider name.

Imports of adapter modules stay inside the builder functions so that loading
this module does not pull every forge's HTTP stack into processes that only
need a display name.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Mapping, Optional

from app.services.trackers.errors import ProviderError

# Display names are safe to use anywhere, including for hosts that only link
# accounts and therefore have no kit.
DISPLAY_NAMES: dict[str, str] = {
    "github": "GitHub",
    "gitlab": "GitLab",
    "gitea": "Gitea / Forgejo",
    "forgejo": "Forgejo",
}


def display_name(provider: str | None) -> str:
    """Human name for a provider id, e.g. ``gitlab`` -> ``GitLab``."""

    key = (provider or "").strip().casefold()
    if key == "github.com":
        key = "github"
    return DISPLAY_NAMES.get(key, key.title() or "the tracker")


@dataclass(frozen=True)
class WebhookCodec:
    """How one forge authenticates and describes a webhook delivery.

    ``verify`` gets the raw body so signatures are checked on the exact bytes
    the forge sent. ``parse`` returns durable hint dicts for ``InboxStore``.
    """

    delivery_id: Callable[[Mapping[str, str], bytes], str]
    event_type: Callable[[Mapping[str, str]], str]
    verify: Callable[[Mapping[str, str], bytes, str], bool]
    parse: Callable[..., list[dict]]


@dataclass(frozen=True)
class ProviderKit:
    """Everything the runtime needs from one issue-capable provider.

    ``credential_fields`` are the keys of the encrypted installation envelope;
    all are required once any is given. Webhook secrets and OAuth clients are
    stored separately and are not part of the envelope.
    """

    provider: str
    credential_fields: tuple[str, ...]
    credential_aliases: Mapping[str, str]
    credential_error: str
    issue_adapter: Callable[[Mapping[str, Any], Mapping[str, Any], Any], Any]
    comment_adapter: Callable[[Any, Mapping[str, Any]], Any]
    test_connection: Callable[[Mapping[str, Any], Mapping[str, Any]], dict[str, Any]]
    list_repositories: Callable[[Mapping[str, Any], Mapping[str, Any]], list[dict[str, Any]]]
    # (connector, container path, issue number) -> the issue's web page.
    issue_web_url: Callable[[Mapping[str, Any], str, Any], str]
    # (connector, container path, issue number, external comment id) -> the comment's web page.
    comment_web_url: Callable[[Mapping[str, Any], str, Any, str], str]

    def credential_payload(self, credentials: Mapping[str, Any]) -> dict[str, str]:
        """Envelope fields from an admin request, accepting snake_case aliases."""

        payload: dict[str, str] = {}
        for field in self.credential_fields:
            alias = self.credential_aliases.get(field, "")
            payload[field] = str(credentials.get(field) or (credentials.get(alias) if alias else "") or "")
        return payload

    def has_credentials(self, credentials: Mapping[str, Any]) -> bool:
        return any(self.credential_payload(credentials).values())

    def require_complete(self, payload: Mapping[str, str]) -> None:
        if not all(str(payload.get(field) or "") for field in self.credential_fields):
            raise ProviderError("invalid_request", self.credential_error)


# --- GitHub -----------------------------------------------------------------


def _github_auth(connector: Mapping[str, Any], material: Mapping[str, Any], http: Any = None) -> Any:
    from app.services.trackers.github_auth import GitHubAppAuth, GitHubAppCredentials

    creds = GitHubAppCredentials(
        app_id=str(material.get("appId") or material.get("app_id") or ""),
        installation_id=str(material.get("installationId") or material.get("installation_id") or ""),
        private_key_pem=str(material.get("privateKey") or material.get("private_key") or ""),
        instance_kind=str(connector.get("instance_kind") or "github.com"),
        base_url=str(connector.get("base_url") or ""),
    )
    return GitHubAppAuth(creds, http=http) if http is not None else GitHubAppAuth(creds)


def _github_issue_adapter(connector: Mapping[str, Any], material: Mapping[str, Any], http: Any = None) -> Any:
    from app.services.trackers.github_issues import GitHubIssueAdapter

    auth = _github_auth(connector, material, http)
    return GitHubIssueAdapter(
        auth,
        http=auth.http,
        bot_user_id=str(connector.get("bot_forge_user_id") or ""),
        bot_login=str(connector.get("bot_login") or ""),
    )


def _github_comment_adapter(issue_adapter: Any, connector: Mapping[str, Any]) -> Any:
    from app.services.trackers.github_comments import GitHubCommentAdapter

    return GitHubCommentAdapter(
        issue_adapter.auth,
        http=issue_adapter.http,
        bot_user_id=str(connector.get("bot_forge_user_id") or ""),
        bot_login=str(connector.get("bot_login") or ""),
    )




def _github_web_root(connector: Mapping[str, Any]) -> str:
    from app.services.trackers.github_identity import web_root_for

    return web_root_for(
        instance_kind=str(connector.get("instance_kind") or "github.com"),
        base_url=str(connector.get("base_url") or ""),
    )


def _github_issue_url(connector: Mapping[str, Any], container_path: str, number: Any) -> str:
    return f"{_github_web_root(connector)}/{_repo_path(container_path)}/issues/{number}"


def _github_comment_url(connector: Mapping[str, Any], container_path: str, number: Any, comment_id: str) -> str:
    return f"{_github_issue_url(connector, container_path, number)}#issuecomment-{comment_id}"


def _github_test(connector: Mapping[str, Any], material: Mapping[str, Any]) -> dict[str, Any]:
    return _github_auth(connector, material).test_connection()


def _github_repositories(connector: Mapping[str, Any], material: Mapping[str, Any]) -> list[dict[str, Any]]:
    return _github_auth(connector, material).list_repositories()


def _github_webhook() -> WebhookCodec:
    from app.services.trackers import github_webhooks as hooks

    return WebhookCodec(
        delivery_id=lambda headers, _body: headers.get(hooks.DELIVERY_HEADER, "").strip(),
        event_type=lambda headers: headers.get(hooks.EVENT_HEADER, "").strip(),
        verify=hooks.verify_signature,
        parse=hooks.parse_github_event,
    )


GITHUB = ProviderKit(
    provider="github",
    credential_fields=("appId", "installationId", "privateKey"),
    credential_aliases={"appId": "app_id", "installationId": "installation_id", "privateKey": "private_key"},
    credential_error="GitHub App id, installation id and private key are required.",
    issue_adapter=_github_issue_adapter,
    comment_adapter=_github_comment_adapter,
    test_connection=_github_test,
    list_repositories=_github_repositories,
    issue_web_url=_github_issue_url,
    comment_web_url=_github_comment_url,
)


# --- GitLab (gitlab.com and self-managed) ------------------------------------

GITLAB_REPOSITORY_LIMIT = 1000


def _gitlab_auth(connector: Mapping[str, Any], material: Mapping[str, Any], http: Any = None) -> Any:
    from app.services.trackers.gitlab_auth import AUTH_BOT, GitLabBotAuth, GitLabBotCredentials

    creds = GitLabBotCredentials(
        access_token=str(material.get("accessToken") or material.get("access_token") or ""),
        instance_kind=str(connector.get("instance_kind") or "gitlab.com"),
        base_url=str(connector.get("base_url") or ""),
        token_kind=str(material.get("tokenKind") or AUTH_BOT),
    )
    return GitLabBotAuth(creds, http=http) if http is not None else GitLabBotAuth(creds)


def _gitlab_issue_adapter(connector: Mapping[str, Any], material: Mapping[str, Any], http: Any = None) -> Any:
    from app.services.trackers.gitlab_issues import GitLabIssueAdapter

    auth = _gitlab_auth(connector, material, http)
    return GitLabIssueAdapter(
        auth,
        http=auth.http,
        bot_user_id=str(connector.get("bot_forge_user_id") or ""),
        bot_login=str(connector.get("bot_login") or ""),
    )


def _gitlab_comment_adapter(issue_adapter: Any, connector: Mapping[str, Any]) -> Any:
    from app.services.trackers.gitlab_comments import GitLabCommentAdapter

    return GitLabCommentAdapter(
        issue_adapter.auth,
        http=issue_adapter.http,
        bot_user_id=str(connector.get("bot_forge_user_id") or ""),
        bot_login=str(connector.get("bot_login") or ""),
    )




def _gitlab_web_root(connector: Mapping[str, Any]) -> str:
    from app.services.trackers.gitlab_auth import web_root_for

    return web_root_for(
        instance_kind=str(connector.get("instance_kind") or "gitlab.com"),
        base_url=str(connector.get("base_url") or ""),
    )


def _gitlab_issue_url(connector: Mapping[str, Any], container_path: str, number: Any) -> str:
    return f"{_gitlab_web_root(connector)}/{_repo_path(container_path)}/-/issues/{number}"


def _gitlab_comment_url(connector: Mapping[str, Any], container_path: str, number: Any, comment_id: str) -> str:
    # GitLab reply ids are ``<issue iid>:<note id>``; the page anchors the note.
    note = str(comment_id).rpartition(":")[2]
    return f"{_gitlab_issue_url(connector, container_path, number)}#note_{note}"


def _gitlab_test(connector: Mapping[str, Any], material: Mapping[str, Any]) -> dict[str, Any]:
    return _gitlab_auth(connector, material).test_connection()


def _gitlab_repositories(connector: Mapping[str, Any], material: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Projects the bot can write issues in (Reporter or above), for the picker."""

    auth = _gitlab_auth(connector, material)
    url: Optional[str] = auth.url("/projects")
    params: Optional[dict[str, Any]] = {
        "membership": "true",
        # Developer, the level the connection test requires to publish.
        "min_access_level": 30,
        "archived": "false",
        "simple": "true",
        "order_by": "path",
        "sort": "asc",
        "per_page": 100,
    }
    repositories: list[dict[str, Any]] = []
    while url and len(repositories) < GITLAB_REPOSITORY_LIMIT:
        response = auth.http.outcome(auth.http.request("GET", url, headers=auth.bot_headers(), params=params))
        params = None
        payload = response.json() if response.content else []
        for item in payload if isinstance(payload, list) else []:
            if not isinstance(item, dict) or item.get("id") is None:
                continue
            repositories.append(
                {
                    "id": str(item["id"]),
                    "fullName": str(item.get("path_with_namespace") or ""),
                    # ``simple`` omits visibility; the destination probe reports it on save.
                    "private": str(item.get("visibility") or "private") != "public",
                    "archived": bool(item.get("archived")),
                    "htmlUrl": str(item.get("web_url") or ""),
                }
            )
        url = response.next_page()
    return repositories


def _gitlab_webhook() -> WebhookCodec:
    from app.services.trackers import gitlab_webhooks as hooks

    return WebhookCodec(
        delivery_id=hooks.delivery_id,
        event_type=lambda headers: hooks.event_type(headers),
        verify=hooks.verify_token,
        parse=hooks.parse_gitlab_event,
    )


GITLAB = ProviderKit(
    provider="gitlab",
    credential_fields=("accessToken",),
    credential_aliases={"accessToken": "access_token"},
    credential_error="A GitLab bot access token is required.",
    issue_adapter=_gitlab_issue_adapter,
    comment_adapter=_gitlab_comment_adapter,
    test_connection=_gitlab_test,
    list_repositories=_gitlab_repositories,
    issue_web_url=_gitlab_issue_url,
    comment_web_url=_gitlab_comment_url,
)


# --- Hosts: instance validation and account linking --------------------------


@dataclass(frozen=True)
class HostKit:
    """One code host: instances, repository paths, account linking, and (optionally) issues."""

    provider: str
    instance_kinds: tuple[str, ...]
    # Host people recognise when the connector has no base URL; "" when every
    # instance is self-hosted.
    default_host: str
    # GitLab nests projects in groups (``group/sub/project``); GitHub is ``owner/repo``.
    nested_paths: bool
    validate_instance: Callable[[str, str], None]
    # (instance kind, base URL, client id, client secret, redirect URI) -> OAuth app.
    oauth_app: Callable[[str, str, str, str, str], Any]
    # (OAuth app, PRISM_FORGE_HOSTS) -> identity adapter.
    identity_adapter: Callable[[Any, str], Any]
    # Whether a connection without publishing credentials is still useful (for
    # account linking). A GitHub connection *is* its App, so without the App's
    # credentials it counts as revoked.
    links_without_credentials: bool = True
    issues: Optional[ProviderKit] = None

    @property
    def linking_only(self) -> bool:
        return self.issues is None


def _github_validate(instance_kind: str, base_url: str) -> None:
    if instance_kind == "ghes" and not (base_url or "").strip():
        raise ProviderError("invalid_request", "GHES connectors require a base URL.")


def _github_oauth_app(instance_kind: str, base_url: str, client_id: str, secret: str, redirect_uri: str) -> Any:
    from app.services.trackers.github_identity import GitHubOAuthApp

    return GitHubOAuthApp(
        client_id=client_id,
        client_secret=secret,
        instance_kind=instance_kind,
        base_url=base_url,
        redirect_uri=redirect_uri,
    )


def _github_identity(app: Any, hosts: str) -> Any:
    from app.services.trackers.github_identity import GitHubIdentityAdapter

    return GitHubIdentityAdapter(app, forge_hosts_raw=hosts)


def _gitlab_validate(instance_kind: str, base_url: str) -> None:
    from app.services.trackers.gitlab_auth import api_root_for

    api_root_for(instance_kind=instance_kind, base_url=base_url)


def _gitlab_oauth_app(instance_kind: str, base_url: str, client_id: str, secret: str, redirect_uri: str) -> Any:
    from app.services.trackers.gitlab_identity import GitLabOAuthApp

    return GitLabOAuthApp(
        client_id=client_id,
        client_secret=secret,
        instance_kind=instance_kind,
        base_url=base_url,
        redirect_uri=redirect_uri,
    )


def _gitlab_identity(app: Any, hosts: str) -> Any:
    from app.services.trackers.gitlab_identity import GitLabIdentityAdapter

    return GitLabIdentityAdapter(app, forge_hosts_raw=hosts)


def _gitea_validate(instance_kind: str, base_url: str) -> None:
    del instance_kind
    from app.services.trackers.gitea_identity import web_root_for

    web_root_for(base_url)


def _gitea_oauth_app(instance_kind: str, base_url: str, client_id: str, secret: str, redirect_uri: str) -> Any:
    del instance_kind
    from app.services.trackers.gitea_identity import GiteaOAuthApp

    return GiteaOAuthApp(client_id=client_id, client_secret=secret, base_url=base_url, redirect_uri=redirect_uri)


def _gitea_identity(app: Any, hosts: str) -> Any:
    from app.services.trackers.gitea_identity import GiteaIdentityAdapter

    return GiteaIdentityAdapter(app, forge_hosts_raw=hosts)


GITHUB_HOST = HostKit(
    provider="github",
    instance_kinds=("github.com", "ghes"),
    default_host="github.com",
    nested_paths=False,
    validate_instance=_github_validate,
    oauth_app=_github_oauth_app,
    identity_adapter=_github_identity,
    links_without_credentials=False,
    issues=GITHUB,
)
GITLAB_HOST = HostKit(
    provider="gitlab",
    instance_kinds=("gitlab.com", "self-hosted"),
    default_host="gitlab.com",
    nested_paths=True,
    validate_instance=_gitlab_validate,
    oauth_app=_gitlab_oauth_app,
    identity_adapter=_gitlab_identity,
    issues=GITLAB,
)
# Account linking only; one kit serves Gitea and Forgejo servers.
GITEA_HOST = HostKit(
    provider="gitea",
    instance_kinds=("self-hosted",),
    default_host="",
    nested_paths=False,
    validate_instance=_gitea_validate,
    oauth_app=_gitea_oauth_app,
    identity_adapter=_gitea_identity,
)


# --- Registry ---------------------------------------------------------------

_HOSTS: dict[str, HostKit] = {kit.provider: kit for kit in (GITHUB_HOST, GITLAB_HOST, GITEA_HOST)}
_WEBHOOK_FACTORIES: dict[str, Callable[[], WebhookCodec]] = {"github": _github_webhook, "gitlab": _gitlab_webhook}


def host_kits() -> tuple[HostKit, ...]:
    """Every host an admin can connect, in the order they are offered."""

    return tuple(_HOSTS.values())


def host_kit(provider: str | None) -> HostKit:
    kit = _HOSTS.get(provider or "")
    if kit is None:
        raise ProviderError("invalid_request", "Unsupported tracker provider.")
    return kit


def is_issue_provider(provider: str | None) -> bool:
    kit = _HOSTS.get(provider or "")
    return kit is not None and kit.issues is not None


def kit_for(provider: str | None) -> ProviderKit:
    """The issue kit for an issue-capable provider; refuses linking-only hosts by name."""

    host = _HOSTS.get(provider or "")
    if host is not None and host.issues is not None:
        return host.issues
    if (provider or "") in DISPLAY_NAMES:
        raise ProviderError(
            "capability_missing",
            f"Issue publishing is not available for {display_name(provider)} yet; this host is for account linking.",
        )
    raise ProviderError("invalid_request", f"Unknown tracker provider {provider!r}.")


def webhook_codec(provider: str | None) -> Optional[WebhookCodec]:
    factory = _WEBHOOK_FACTORIES.get(provider or "")
    return factory() if factory else None


def issue_adapter_for(connector: Mapping[str, Any], material: Mapping[str, Any], *, http: Any = None) -> Any:
    return kit_for(str(connector.get("provider") or "")).issue_adapter(connector, material, http)


def comment_adapter_for(connector: Mapping[str, Any], issue_adapter: Any) -> Any:
    return kit_for(str(connector.get("provider") or "")).comment_adapter(issue_adapter, connector)


def issue_web_url(connector: Mapping[str, Any], container_path: str, number: Any) -> str:
    """Web page of an issue, used when the forge's response did not carry one."""

    return kit_for(str(connector.get("provider") or "")).issue_web_url(connector, container_path, number)


def comment_web_url(connector: Mapping[str, Any], container_path: str, number: Any, comment_id: str) -> str:
    """Web page of a comment, used when the forge's response did not carry one."""

    kit = kit_for(str(connector.get("provider") or ""))
    return kit.comment_web_url(connector, container_path, number, comment_id)


def _repo_path(container_path: str) -> str:
    path = (container_path or "").strip().strip("/")
    if "/" not in path:
        raise ValueError("container_path must name a repository")
    return path


__all__ = [
    "DISPLAY_NAMES",
    "GITEA_HOST",
    "GITHUB",
    "GITHUB_HOST",
    "GITLAB",
    "GITLAB_HOST",
    "HostKit",
    "ProviderKit",
    "WebhookCodec",
    "comment_adapter_for",
    "comment_web_url",
    "display_name",
    "host_kit",
    "host_kits",
    "is_issue_provider",
    "issue_adapter_for",
    "issue_web_url",
    "kit_for",
    "webhook_codec",
]
