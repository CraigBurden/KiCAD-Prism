"""Publish a Release Studio dossier as a GitHub or GitLab Release asset.

Prism's workspace SSH key can clone; it cannot create forge Releases. This
module uses the workspace ``GITHUB_TOKEN`` / ``GITLAB_TOKEN`` instead, and
says so when those tokens are missing or lack write scope.
"""

from __future__ import annotations

import io
import json
import re
import tarfile
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote

import requests

from app.core.config import settings
from app.release_studio.canonical import write_deterministic_zip
from app.services.git_remote_url import ParsedRemote, RemoteUrlError, parse_remote_url

_TAG_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$")
_SAFE_FILENAME_RE = re.compile(r"[^A-Za-z0-9._-]+")


class ForgePublishError(RuntimeError):
    """A publish attempt the user can act on (missing token, wrong host, 403)."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


@dataclass(frozen=True)
class ForgeTarget:
    kind: str
    name: str
    host: str
    owner_repo: str
    api_root: str
    token_configured: bool
    token_hint: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "kind": self.kind,
            "name": self.name,
            "host": self.host,
            "owner_repo": self.owner_repo,
            "token_configured": self.token_configured,
            "token_hint": self.token_hint,
        }


def describe_forge(repo_url: str | None) -> ForgeTarget:
    """Resolve the imported remote to a GitHub or GitLab publish target."""

    if not repo_url or not str(repo_url).strip():
        raise ForgePublishError("This project has no imported Git remote to publish to.")
    try:
        parsed = parse_remote_url(str(repo_url))
    except RemoteUrlError as exc:
        raise ForgePublishError(f"The imported remote cannot be published: {exc}") from exc
    return _target_from_parsed(parsed)


def dossier_tar_to_zip(dossier_bytes: bytes) -> bytes:
    """Repack dossier members as a zip. Same files, forge-friendly container."""

    members: dict[str, bytes] = {}
    try:
        with tarfile.open(fileobj=io.BytesIO(dossier_bytes), mode="r:*") as archive:
            for info in archive.getmembers():
                if not info.isfile():
                    continue
                extracted = archive.extractfile(info)
                if extracted is None:
                    continue
                members[info.name] = extracted.read()
    except tarfile.TarError as exc:
        raise ForgePublishError(f"The stored dossier could not be read: {exc}") from exc
    if not members:
        raise ForgePublishError("The stored dossier is empty.")
    return write_deterministic_zip(members)


def publish_release(
    *,
    repo_url: str,
    commit_sha: str,
    tag: str,
    title: str,
    notes: str,
    zip_bytes: bytes,
    filename: str,
) -> dict[str, str]:
    """Create the forge Release on ``commit_sha`` and attach ``filename``."""

    target = describe_forge(repo_url)
    if not target.token_configured:
        raise ForgePublishError(target.token_hint, status_code=409)
    if target.kind == "unsupported":
        raise ForgePublishError(
            "Publishing is only implemented for GitHub and GitLab remotes."
        )
    normalized_tag = _require_tag(tag)
    name = (title or "").strip() or normalized_tag
    body = notes.strip()
    if target.kind == "github":
        return _publish_github(target, commit_sha, normalized_tag, name, body, zip_bytes, filename)
    return _publish_gitlab(target, commit_sha, normalized_tag, name, body, zip_bytes, filename)


def release_zip_filename(project_name: str, tag: str) -> str:
    stem = _SAFE_FILENAME_RE.sub("-", (project_name or "release").strip()) or "release"
    safe_tag = _SAFE_FILENAME_RE.sub("-", tag.strip()) or "release"
    return f"{stem}-{safe_tag}.zip"


def _target_from_parsed(parsed: ParsedRemote) -> ForgeTarget:
    host = parsed.host.casefold()
    owner_repo = parsed.path.strip("/").removesuffix(".git")
    if host == "github.com":
        token = settings.GITHUB_TOKEN.strip()
        return ForgeTarget(
            kind="github",
            name="GitHub",
            host=parsed.host,
            owner_repo=owner_repo,
            api_root="https://api.github.com",
            token_configured=bool(token),
            token_hint=(
                "Set GITHUB_TOKEN with contents:write to create a GitHub Release. "
                "The workspace SSH key can clone but cannot publish."
            ),
        )
    if host == "gitlab.com" or "gitlab" in host:
        token = settings.GITLAB_TOKEN.strip()
        api_root = f"https://{parsed.host}/api/v4"
        return ForgeTarget(
            kind="gitlab",
            name="GitLab",
            host=parsed.host,
            owner_repo=owner_repo,
            api_root=api_root,
            token_configured=bool(token),
            token_hint=(
                "Set GITLAB_TOKEN with api scope to create a GitLab Release. "
                "The workspace SSH key can clone but cannot publish."
            ),
        )
    return ForgeTarget(
        kind="unsupported",
        name=parsed.host,
        host=parsed.host,
        owner_repo=owner_repo,
        api_root="",
        token_configured=False,
        token_hint=(
            f"Publishing is only implemented for GitHub and GitLab remotes, not {parsed.host}."
        ),
    )


def _require_tag(tag: str) -> str:
    candidate = (tag or "").strip()
    if candidate.startswith("refs/"):
        raise ForgePublishError("Enter a tag name such as v1.0.0, not a Git ref path.")
    if not _TAG_RE.match(candidate):
        raise ForgePublishError(
            "Tag must start with a letter or digit and contain only letters, digits, dots, underscores, and hyphens."
        )
    return candidate


def _publish_github(
    target: ForgeTarget,
    commit_sha: str,
    tag: str,
    name: str,
    body: str,
    zip_bytes: bytes,
    filename: str,
) -> dict[str, str]:
    token = settings.GITHUB_TOKEN.strip()
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    created = _request(
        "POST",
        f"{target.api_root}/repos/{target.owner_repo}/releases",
        headers=headers,
        json_body={
            "tag_name": tag,
            "target_commitish": commit_sha,
            "name": name,
            "body": body,
            "draft": False,
            "prerelease": False,
        },
        forge="GitHub",
    )
    upload_url = str(created.get("upload_url") or "").split("{", 1)[0]
    if not upload_url:
        raise ForgePublishError("GitHub created the release but returned no upload URL.")
    _request(
        "POST",
        f"{upload_url}?name={quote(filename)}",
        headers={**headers, "Content-Type": "application/zip"},
        data=zip_bytes,
        forge="GitHub",
    )
    html_url = str(created.get("html_url") or "")
    if not html_url:
        html_url = f"https://github.com/{target.owner_repo}/releases/tag/{quote(tag)}"
    return {"url": html_url, "tag": tag, "forge": "github"}


def _publish_gitlab(
    target: ForgeTarget,
    commit_sha: str,
    tag: str,
    name: str,
    body: str,
    zip_bytes: bytes,
    filename: str,
) -> dict[str, str]:
    token = settings.GITLAB_TOKEN.strip()
    headers = {"PRIVATE-TOKEN": token}
    project = quote(target.owner_repo, safe="")
    package_url = (
        f"{target.api_root}/projects/{project}/packages/generic/"
        f"{quote(tag, safe='')}/{quote(tag, safe='')}/{quote(filename)}"
    )
    _request(
        "PUT",
        package_url,
        headers=headers,
        data=zip_bytes,
        forge="GitLab",
    )
    _request(
        "POST",
        f"{target.api_root}/projects/{project}/releases",
        headers=headers,
        json_body={
            "name": name,
            "tag_name": tag,
            "ref": commit_sha,
            "description": body,
            "assets": {
                "links": [
                    {
                        "name": filename,
                        "url": package_url,
                        "link_type": "package",
                    }
                ]
            },
        },
        forge="GitLab",
    )
    html_url = f"https://{target.host}/{target.owner_repo}/-/releases/{quote(tag)}"
    return {"url": html_url, "tag": tag, "forge": "gitlab"}


def _request(
    method: str,
    url: str,
    *,
    headers: dict[str, str],
    forge: str,
    json_body: dict[str, Any] | None = None,
    data: bytes | None = None,
) -> dict[str, Any]:
    try:
        response = requests.request(
            method,
            url,
            headers=headers,
            json=json_body,
            data=data,
            timeout=60,
        )
    except requests.RequestException as exc:
        raise ForgePublishError(f"{forge} could not be reached: {exc}") from exc
    if response.status_code in {401, 403}:
        raise ForgePublishError(
            f"{forge} refused the token. Publishing needs write access "
            f"({'contents:write' if forge == 'GitHub' else 'api scope'}), not clone-only.",
            status_code=403,
        )
    if response.status_code >= 400:
        detail = _error_detail(response)
        raise ForgePublishError(
            f"{forge} rejected the release ({response.status_code}): {detail}",
            status_code=409 if response.status_code in {409, 422} else 502,
        )
    if not response.content:
        return {}
    try:
        parsed = response.json()
    except ValueError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _error_detail(response: requests.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        text = (response.text or "").strip()
        return text[:300] or response.reason
    if isinstance(payload, dict):
        message = payload.get("message") or payload.get("error") or payload.get("error_description")
        if message:
            return str(message)[:300]
    return response.reason
