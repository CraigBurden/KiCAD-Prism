"""The interactive question flow.

Deliberately short: anything that can be derived from another answer is not
asked. Fewer questions means fewer chances for two related settings to
disagree, which is the most common way a Prism deployment ends up broken in a
way that only shows up at login.
"""

from __future__ import annotations

from pathlib import Path

from . import tui
from .apply import load_existing_env
from .render import generate_secret
from .schemes import (
    DNS_01,
    DNS_PROVIDERS,
    EXTERNAL_PROXY,
    HTTP_01,
    INTERNAL_CA,
    PROVIDER_ORDER,
    SCHEME_ORDER,
    SCHEMES,
    SIZING_ORDER,
    SIZINGS,
    validate_emails,
    validate_hostname,
    validate_issuer,
    validate_port,
)


def run(root: Path) -> dict:
    tui.banner("KiCAD Prism deployment", "Generates .env, proxy config, and a Compose overlay")

    existing = load_existing_env(root / "generated" / ".env")
    if existing:
        tui.note("Found a previous configuration in generated/.env")
        tui.hint("Secrets are reused unless you choose to regenerate them.")

    answers: dict = {}

    tui.section("1", "Deployment scheme")
    answers["scheme"] = tui.select(
        "How will Prism serve HTTPS?",
        [(key, SCHEMES[key].label, SCHEMES[key].description) for key in SCHEME_ORDER],
    )
    scheme = answers["scheme"]

    tui.section("2", "Identity")
    answers["hostname"] = tui.ask(
        "Public hostname",
        default=_previous_hostname(existing),
        description="The name users will type. No scheme, no port.",
        validate=validate_hostname,
    )
    answers["workspace_name"] = tui.ask(
        "Workspace name",
        default=existing.get("WORKSPACE_NAME", "KiCAD Prism"),
        description="Shown on the login page.",
    )

    if scheme == DNS_01:
        tui.section("3", "DNS provider")
        answers["dns_provider"] = tui.select(
            "Which DNS provider hosts this zone?",
            [(key, DNS_PROVIDERS[key].label, DNS_PROVIDERS[key].module.rsplit("/", 1)[-1]) for key in PROVIDER_ORDER],
        )
        provider = DNS_PROVIDERS[answers["dns_provider"]]
        answers["dns_credential"] = tui.ask_secret(
            provider.credential_label,
            description=provider.credential_hint + " Paste it; do not retype.",
        )
        answers["extra_provider_env"] = {}
        tui.hint("Input is hidden, so the credential stays out of shell history.")

        if tui.confirm("Pin container DNS to a specific resolver?", default=False):
            tui.hint("Only needed when the default resolver returns filtered answers.")
            answers["dns_pin"] = tui.ask(
                "Resolver IP",
                description="Usually your internal DNS server.",
            )

    if scheme == INTERNAL_CA:
        tui.section("3", "Certificates")
        answers["certificate_dir"] = tui.ask(
            "Directory containing prism.crt and prism.key",
            default="./deploy/certs",
            description="Mounted read-only into the proxy at /certs.",
            validate=lambda value: _validate_certs(root, value),
        )

    step = "4" if scheme in (DNS_01, INTERNAL_CA) else "3"
    tui.section(step, "Single sign-on")
    tui.hint("Prism refuses to start without a working OIDC client. This is deliberate.")
    answers["oidc_issuer"] = tui.ask(
        "OIDC issuer URL",
        default=existing.get("OIDC_ISSUER_URL", ""),
        description="For example https://sso.example.com/realms/engineering",
        validate=validate_issuer,
    )
    answers["oidc_client_id"] = tui.ask(
        "OIDC client ID",
        default=existing.get("OIDC_CLIENT_ID", "kicad-prism"),
    )
    reuse_secret = bool(existing.get("OIDC_CLIENT_SECRET"))
    if reuse_secret and not tui.confirm("Replace the stored OIDC client secret?", default=False):
        answers["oidc_client_secret"] = existing["OIDC_CLIENT_SECRET"]
    else:
        answers["oidc_client_secret"] = tui.ask_secret("OIDC client secret")
    answers["oidc_provider_name"] = tui.ask(
        "Provider display name",
        default=existing.get("OIDC_PROVIDER_NAME", "Company SSO"),
        description="Labels the sign-in button.",
    )
    answers["bootstrap_admins"] = tui.ask(
        "Bootstrap administrators",
        default=existing.get("BOOTSTRAP_ADMIN_USERS_STR", ""),
        description="Comma-separated emails. Keep at least two once you are live.",
        validate=validate_emails,
    )

    tui.section(str(int(step) + 1), "Capacity")
    answers["sizing"] = tui.select(
        "How large is this installation?",
        [(key, SIZINGS[key].label, SIZINGS[key].description) for key in SIZING_ORDER],
        default=1,
    )
    answers["http_port"] = tui.ask(
        "Loopback port for the frontend",
        default=existing.get("PRISM_HTTP_PORT", "8080"),
        description="Bound to 127.0.0.1 only. Change if 8080 is taken.",
        validate=validate_port,
    )

    if scheme in (HTTP_01, DNS_01):
        tui.section(str(int(step) + 2), "Certificate authority")
        tui.hint("Production allows only 5 failed validations per hostname per hour.")
        answers["acme_staging"] = tui.confirm(
            "Use the Let's Encrypt staging CA for this run?", default=True
        )

    answers["session_secret"] = existing.get("SESSION_SECRET") or generate_secret(48)
    answers["postgres_password"] = existing.get("POSTGRES_PASSWORD") or generate_secret(32)
    return answers


def _previous_hostname(existing: dict[str, str]) -> str:
    base = existing.get("PUBLIC_BASE_URL", "")
    return base.removeprefix("https://").removeprefix("http://").rstrip("/")


def _validate_certs(root: Path, value: str) -> str | None:
    directory = (root / value).resolve() if not Path(value).is_absolute() else Path(value)
    if not directory.is_dir():
        return f"{directory} is not a directory."
    missing = [name for name in ("prism.crt", "prism.key") if not (directory / name).is_file()]
    if missing:
        return f"Missing {', '.join(missing)} in {directory}."
    return None


def summarise(answers: dict) -> None:
    scheme = SCHEMES[answers["scheme"]]
    rows = [
        ("Scheme", scheme.label),
        ("URL", f"{tui.BOLD}{answers['public_base_url']}{tui.RESET}"),
        ("Workspace", answers["workspace_name"]),
        ("Identity provider", answers["oidc_issuer"]),
        ("Administrators", answers["bootstrap_admins"]),
        ("Capacity", SIZINGS[answers["sizing"]].label),
        ("Frontend port", f"127.0.0.1:{answers['http_port']}"),
    ]
    if answers["scheme"] == DNS_01:
        rows.insert(2, ("DNS provider", DNS_PROVIDERS[answers["dns_provider"]].label))
        if answers.get("dns_pin"):
            rows.insert(3, ("Container resolver", answers["dns_pin"]))
    if answers.get("acme_staging"):
        rows.append(("Certificate authority", f"{tui.YELLOW}Let's Encrypt staging{tui.RESET}"))
    elif answers["scheme"] in (HTTP_01, DNS_01):
        rows.append(("Certificate authority", "Let's Encrypt production"))

    tui.write()
    tui.panel("Configuration", rows)

    if answers["scheme"] != EXTERNAL_PROXY:
        tui.write()
        tui.note("Register these redirect URIs with your identity provider:")
        for uri in answers["redirect_uris"]:
            tui.info(f"  {uri}")
