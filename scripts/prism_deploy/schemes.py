"""Deployment schemes, provider tables, sizing presets, and input validators."""

from __future__ import annotations

import re
from dataclasses import dataclass

HTTP_01 = "http-01"
DNS_01 = "dns-01"
INTERNAL_CA = "internal-ca"
EXTERNAL_PROXY = "external-proxy"
PLAIN_HTTP = "plain-http"


@dataclass(frozen=True)
class Scheme:
    key: str
    label: str
    description: str
    runs_caddy: bool
    needs_dns_provider: bool
    needs_certificates: bool


SCHEMES: dict[str, Scheme] = {
    HTTP_01: Scheme(
        HTTP_01,
        "Public ACME over HTTP-01",
        "internet-reachable host, ports 80 and 443 open",
        runs_caddy=True,
        needs_dns_provider=False,
        needs_certificates=False,
    ),
    DNS_01: Scheme(
        DNS_01,
        "Public ACME over DNS-01",
        "internal-only host, publicly trusted certificate",
        runs_caddy=True,
        needs_dns_provider=True,
        needs_certificates=False,
    ),
    INTERNAL_CA: Scheme(
        INTERNAL_CA,
        "Internal CA or supplied certificate",
        "you provide prism.crt and prism.key",
        runs_caddy=True,
        needs_dns_provider=False,
        needs_certificates=True,
    ),
    EXTERNAL_PROXY: Scheme(
        EXTERNAL_PROXY,
        "Existing reverse proxy",
        "nginx, Traefik, or a load balancer terminates TLS",
        runs_caddy=False,
        needs_dns_provider=False,
        needs_certificates=False,
    ),
    PLAIN_HTTP: Scheme(
        PLAIN_HTTP,
        "Plain HTTP, no TLS",
        "evaluation only; the KiCad remote panel is unsupported",
        runs_caddy=False,
        needs_dns_provider=False,
        needs_certificates=False,
    ),
}

# Plain HTTP sits last: it is the only option that is not a way to run Prism
# properly, and it should not be the one a hurried operator lands on first.
SCHEME_ORDER = [DNS_01, HTTP_01, INTERNAL_CA, EXTERNAL_PROXY, PLAIN_HTTP]


@dataclass(frozen=True)
class DnsProvider:
    key: str
    label: str
    module: str
    directive: str
    env_var: str
    credential_label: str
    credential_hint: str
    credential_example: str
    credential_docs: str


# The directive body is what goes inside the `tls { dns ... }` block. Providers
# read their own environment variables; see https://github.com/caddy-dns.
DNS_PROVIDERS: dict[str, DnsProvider] = {
    "cloudflare": DnsProvider(
        "cloudflare",
        "Cloudflare",
        "github.com/caddy-dns/cloudflare",
        "dns cloudflare {env.CLOUDFLARE_API_TOKEN}",
        "CLOUDFLARE_API_TOKEN",
        "Cloudflare API token",
        "Scoped token with Zone / DNS / Edit on this zone. Not the Global API Key.",
        "cfut_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "https://dash.cloudflare.com/profile/api-tokens",
    ),
    "route53": DnsProvider(
        "route53",
        "AWS Route 53",
        "github.com/caddy-dns/route53",
        "dns route53",
        "AWS_SECRET_ACCESS_KEY",
        "AWS secret access key",
        "Also set AWS_ACCESS_KEY_ID and AWS_REGION in the generated .env.",
        "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html",
    ),
    "digitalocean": DnsProvider(
        "digitalocean",
        "DigitalOcean",
        "github.com/caddy-dns/digitalocean",
        "dns digitalocean {env.DO_AUTH_TOKEN}",
        "DO_AUTH_TOKEN",
        "DigitalOcean API token",
        "Personal access token with write scope.",
        "dop_v1_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "https://cloud.digitalocean.com/account/api/tokens",
    ),
    "googleclouddns": DnsProvider(
        "googleclouddns",
        "Google Cloud DNS",
        "github.com/caddy-dns/googleclouddns",
        "dns googleclouddns {env.GCE_PROJECT}",
        "GCE_PROJECT",
        "Google Cloud project ID",
        "Service account credentials are read from GOOGLE_APPLICATION_CREDENTIALS.",
        "my-gcp-project-123456",
        "https://console.cloud.google.com/net-services/dns",
    ),
    "azure": DnsProvider(
        "azure",
        "Azure DNS",
        "github.com/caddy-dns/azure",
        "dns azure {env.AZURE_CLIENT_SECRET}",
        "AZURE_CLIENT_SECRET",
        "Azure client secret",
        "Also set AZURE_TENANT_ID, AZURE_CLIENT_ID, and the resource group in .env.",
        "Abc8Q~xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "https://portal.azure.com",
    ),
    "desec": DnsProvider(
        "desec",
        "deSEC",
        "github.com/caddy-dns/desec",
        "dns desec {env.DESEC_TOKEN}",
        "DESEC_TOKEN",
        "deSEC API token",
        "Token scoped to the delegation zone.",
        "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "https://desec.io/tokens",
    ),
}

PROVIDER_ORDER = ["cloudflare", "route53", "azure", "googleclouddns", "digitalocean", "desec"]


@dataclass(frozen=True)
class Sizing:
    key: str
    label: str
    description: str
    values: dict[str, str]


SIZINGS: dict[str, Sizing] = {
    "evaluation": Sizing(
        "evaluation",
        "Private evaluation",
        "4 vCPU, 16 GB",
        {
            "UVICORN_WORKERS": "1",
            "PRISM_WORKER_CONCURRENCY": "2",
            "CATALOG_WORKER_CONCURRENCY": "1",
            "PRISM_BACKEND_CPU_LIMIT": "1.0",
            "PRISM_BACKEND_MEMORY_LIMIT": "2g",
            "PRISM_WORKER_CPU_LIMIT": "2.0",
            "PRISM_WORKER_MEMORY_LIMIT": "6g",
            "CATALOG_WORKER_CPU_LIMIT": "2.0",
            "CATALOG_WORKER_MEMORY_LIMIT": "4g",
        },
    ),
    "small-team": Sizing(
        "small-team",
        "Small team",
        "8 vCPU, 32 GB",
        {
            "UVICORN_WORKERS": "2",
            "PRISM_WORKER_CONCURRENCY": "4",
            "CATALOG_WORKER_CONCURRENCY": "2",
            "PRISM_BACKEND_CPU_LIMIT": "2.0",
            "PRISM_BACKEND_MEMORY_LIMIT": "4g",
            "PRISM_WORKER_CPU_LIMIT": "6.0",
            "PRISM_WORKER_MEMORY_LIMIT": "12g",
            "CATALOG_WORKER_CPU_LIMIT": "4.0",
            "CATALOG_WORKER_MEMORY_LIMIT": "8g",
        },
    ),
    "large": Sizing(
        "large",
        "Larger installation",
        "16 vCPU, 64 GB",
        {
            "UVICORN_WORKERS": "4",
            "PRISM_WORKER_CONCURRENCY": "8",
            "CATALOG_WORKER_CONCURRENCY": "3",
            "PRISM_BACKEND_CPU_LIMIT": "4.0",
            "PRISM_BACKEND_MEMORY_LIMIT": "8g",
            "PRISM_WORKER_CPU_LIMIT": "10.0",
            "PRISM_WORKER_MEMORY_LIMIT": "24g",
            "CATALOG_WORKER_CPU_LIMIT": "6.0",
            "CATALOG_WORKER_MEMORY_LIMIT": "16g",
        },
    ),
}

SIZING_ORDER = ["evaluation", "small-team", "large"]

STAGING_ACME = "https://acme-staging-v02.api.letsencrypt.org/directory"

_HOSTNAME = re.compile(r"^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))+$")


def validate_host_or_local(value: str) -> str | None:
    """Like validate_hostname, but also accepts localhost and bare IPs.

    Plain-HTTP evaluation commonly runs on localhost or a short LAN name, and
    neither is a fully qualified domain name.
    """
    import ipaddress

    if value.startswith(("http://", "https://")):
        return "Enter a bare hostname, without a scheme."
    if "/" in value:
        return "Enter a bare hostname, without a path."
    if ":" in value:
        return "Enter the hostname only; the port is asked for separately."
    if value == "localhost":
        return None
    try:
        ipaddress.ip_address(value)
    except ValueError:
        pass
    else:
        return None
    if not _HOSTNAME.match(value) and not value.replace("-", "").isalnum():
        return "Enter a hostname, an IP address, or localhost."
    return None


def validate_hostname(value: str) -> str | None:
    if value.startswith(("http://", "https://")):
        return "Enter a bare hostname, without a scheme."
    if "/" in value or ":" in value:
        return "Enter a bare hostname, without a path or port."
    if not _HOSTNAME.match(value):
        return "Enter a fully qualified domain name, for example prism.example.com."
    return None


def validate_issuer(value: str) -> str | None:
    if not value.startswith("https://"):
        # The backend rejects a non-HTTPS issuer at startup; catch it here instead.
        return "The OIDC issuer must use https://."
    if value.endswith("/"):
        return "Drop the trailing slash; discovery appends its own path."
    return None


def validate_emails(value: str) -> str | None:
    for entry in value.split(","):
        candidate = entry.strip()
        if not candidate:
            return "Remove the empty entry from the comma-separated list."
        if "@" not in candidate or candidate.startswith("@") or candidate.endswith("@"):
            return f"'{candidate}' is not an email address."
    return None


def validate_port(value: str) -> str | None:
    if not value.isdigit() or not 1 <= int(value) <= 65535:
        return "Enter a port between 1 and 65535."
    return None


def validate_session_secret(value: str) -> str | None:
    """Mirror the backend's own rules so a bad value fails here, not at startup."""
    if len(value) < 32:
        return "Must be at least 32 characters."
    if len(set(value)) < 8:
        return "Must contain at least 8 distinct characters."
    return None


def validate_resolver(value: str) -> str | None:
    """Accept an IPv4 or IPv6 literal. A hostname here cannot be resolved yet."""
    import ipaddress

    try:
        ipaddress.ip_address(value)
    except ValueError:
        return "Enter an IP address, not a hostname. Docker needs a literal here."
    return None
