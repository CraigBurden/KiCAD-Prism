"""Tests for the deployment installer.

These cover `render`, which is pure, so the whole suite runs without Docker.
The assertions are mostly about failure modes that have actually bitten a real
deployment: CRLF, byte order marks, empty values for typed settings, port
bindings that stay exposed, and related settings drifting apart.
"""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from prism_deploy import render
from prism_deploy.apply import load_existing_env, write_text
from prism_deploy.schemes import DNS_01, EXTERNAL_PROXY, HTTP_01, INTERNAL_CA, SCHEMES

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
ENV_EXAMPLE = (REPOSITORY_ROOT / ".env.example").read_text(encoding="utf-8")

BASE_ANSWERS = {
    "hostname": "prism.example.com",
    "workspace_name": "Engineering ECAD",
    "oidc_issuer": "https://sso.example.com/realms/eng",
    "oidc_client_id": "kicad-prism",
    "oidc_client_secret": "client-secret",
    "oidc_provider_name": "Company SSO",
    "bootstrap_admins": "admin@example.com",
    "sizing": "small-team",
}


def answers_for(scheme: str, **overrides) -> dict:
    answers = dict(BASE_ANSWERS, scheme=scheme)
    if scheme == DNS_01:
        answers.setdefault("dns_provider", "cloudflare")
        answers.setdefault("dns_credential", "token-value")
    if scheme == INTERNAL_CA:
        answers.setdefault("certificate_dir", "./deploy/certs")
    answers.update(overrides)
    return render.normalise(answers)


class DerivationTests(unittest.TestCase):
    """Related settings must not be able to drift apart."""

    def test_cors_and_base_url_always_agree(self) -> None:
        answers = answers_for(HTTP_01)
        self.assertEqual(answers["public_base_url"], "https://prism.example.com")
        self.assertEqual(answers["cors_origins"], answers["public_base_url"])

    def test_cookie_secure_is_always_set_explicitly(self) -> None:
        # An empty SESSION_COOKIE_SECURE crashes the backend at import time.
        for scheme in SCHEMES:
            with self.subTest(scheme=scheme):
                values = render.env_values(answers_for(scheme))
                self.assertEqual(values["SESSION_COOKIE_SECURE"], "true")

    def test_redirect_uris_match_the_backend_routes(self) -> None:
        answers = answers_for(DNS_01)
        self.assertEqual(
            answers["redirect_uris"],
            [
                "https://prism.example.com/auth/callback",
                "https://prism.example.com/oauth/oidc/callback",
            ],
        )

    def test_generated_secrets_satisfy_the_backend_validators(self) -> None:
        answers = answers_for(HTTP_01)
        secret = answers["session_secret"]
        self.assertGreaterEqual(len(secret), 32)
        self.assertGreaterEqual(len(set(secret)), 8)

    def test_supplied_secrets_are_preserved(self) -> None:
        answers = answers_for(HTTP_01, session_secret="k" * 20 + "abcdefghij0123456789")
        self.assertTrue(answers["session_secret"].startswith("kkkk"))


class EnvRenderingTests(unittest.TestCase):
    def test_template_comments_survive(self) -> None:
        rendered = render.render_env(ENV_EXAMPLE, answers_for(HTTP_01))
        self.assertIn("# --- KiCAD Prism Root Environment Variables ---", rendered)
        self.assertIn("# Friendly workspace display name", rendered)

    def test_no_duplicate_keys(self) -> None:
        for scheme in SCHEMES:
            with self.subTest(scheme=scheme):
                rendered = render.render_env(ENV_EXAMPLE, answers_for(scheme))
                keys = [
                    line.split("=", 1)[0]
                    for line in rendered.split("\n")
                    if line and not line.startswith("#") and "=" in line
                ]
                self.assertEqual(sorted(keys), sorted(set(keys)))

    def test_no_carriage_returns_or_bom(self) -> None:
        for scheme in SCHEMES:
            with self.subTest(scheme=scheme):
                for path, content in render.render_all(ENV_EXAMPLE, answers_for(scheme)).items():
                    self.assertNotIn("\r", content, path)
                    self.assertFalse(content.startswith("﻿"), path)

    def test_typed_settings_are_never_blank(self) -> None:
        # docker-compose.yml forwards these as-is; a blank bool or int is fatal.
        typed = ("SESSION_COOKIE_SECURE", "AUTH_ENABLED", "UVICORN_WORKERS", "PRISM_HTTP_PORT")
        rendered = render.render_env(ENV_EXAMPLE, answers_for(DNS_01))
        for line in rendered.split("\n"):
            key, _, value = line.partition("=")
            if key.strip() in typed:
                self.assertTrue(value.strip(), f"{key} must not be blank")

    def test_dns_credential_reaches_the_env(self) -> None:
        rendered = render.render_env(ENV_EXAMPLE, answers_for(DNS_01, dns_credential="secret-token"))
        self.assertIn("CLOUDFLARE_API_TOKEN=secret-token", rendered)
        self.assertIn("PRISM_CADDY_IMAGE=kicad-prism-caddy-dns:2", rendered)

    def test_non_dns_schemes_carry_no_provider_credential(self) -> None:
        for scheme in (HTTP_01, INTERNAL_CA, EXTERNAL_PROXY):
            with self.subTest(scheme=scheme):
                rendered = render.render_env(ENV_EXAMPLE, answers_for(scheme))
                self.assertNotIn("CLOUDFLARE_API_TOKEN", rendered)


class CaddyfileTests(unittest.TestCase):
    def test_external_proxy_has_no_caddyfile(self) -> None:
        self.assertIsNone(render.render_caddyfile(answers_for(EXTERNAL_PROXY)))
        self.assertNotIn("generated/Caddyfile", render.render_all(ENV_EXAMPLE, answers_for(EXTERNAL_PROXY)))

    def test_dns_01_emits_the_provider_directive(self) -> None:
        config = render.render_caddyfile(answers_for(DNS_01))
        self.assertIn("dns cloudflare {env.CLOUDFLARE_API_TOKEN}", config)
        self.assertIn("resolvers", config)

    def test_staging_is_opt_out_for_acme_schemes(self) -> None:
        for scheme in (HTTP_01, DNS_01):
            with self.subTest(scheme=scheme):
                self.assertIn("acme-staging", render.render_caddyfile(answers_for(scheme)))
                production = render.render_caddyfile(answers_for(scheme, acme_staging=False))
                self.assertNotIn("acme-staging", production)

    def test_staging_uses_the_tls_subdirective_not_the_global_option(self) -> None:
        # `acme_ca` is the global-options spelling. Inside a `tls` block the
        # subdirective is `ca`, and Caddy rejects the whole config otherwise --
        # so the proxy fails to start rather than degrading.
        for scheme in (HTTP_01, DNS_01):
            with self.subTest(scheme=scheme):
                config = render.render_caddyfile(answers_for(scheme))
                self.assertIn("\t\tca https://acme-staging", config)
                self.assertNotIn("acme_ca", config)

    def test_internal_ca_pins_forwarded_proto(self) -> None:
        # Caddy cannot infer https from the request when it terminates a
        # supplied certificate behind another hop.
        config = render.render_caddyfile(answers_for(INTERNAL_CA))
        self.assertIn("tls /certs/prism.crt /certs/prism.key", config)
        self.assertIn("header_up X-Forwarded-Proto https", config)


class ComposeTests(unittest.TestCase):
    def test_ports_are_overridden_not_appended(self) -> None:
        # A plain merge would leave docker-compose.yml's 0.0.0.0 bindings in
        # place, so the app would stay reachable over plain HTTP on the LAN.
        for scheme in SCHEMES:
            with self.subTest(scheme=scheme):
                overlay = render.render_compose(answers_for(scheme))
                self.assertIn("ports: !override", overlay)
                self.assertIn('"127.0.0.1:8000:8000"', overlay)
                self.assertNotIn('"8000:8000"\n', overlay)

    def test_proxy_compose_included_only_when_caddy_runs(self) -> None:
        self.assertIn("docker-compose.proxy.yml", render.compose_files(answers_for(DNS_01)))
        self.assertNotIn("docker-compose.proxy.yml", render.compose_files(answers_for(EXTERNAL_PROXY)))

    def test_dns_pin_is_emitted_when_requested(self) -> None:
        overlay = render.render_compose(answers_for(DNS_01, dns_pin="172.16.8.1"))
        self.assertIn("\n    dns:\n", overlay)
        self.assertIn("- 172.16.8.1", overlay)
        # Match the YAML key, not the substring in the caddy-dns image tag.
        self.assertNotIn("\n    dns:\n", render.render_compose(answers_for(DNS_01)))

    def test_compose_command_uses_the_generated_env(self) -> None:
        command = render.compose_command(answers_for(HTTP_01), "up", "-d")
        self.assertEqual(command[:4], ["docker", "compose", "--env-file", "generated/.env"])
        self.assertEqual(command[-2:], ["up", "-d"])


class PlanAndNextStepsTests(unittest.TestCase):
    def test_plan_redacts_every_secret(self) -> None:
        answers = answers_for(DNS_01, dns_credential="super-secret-token")
        plan = json.loads(render.render_plan(answers))
        for key in ("session_secret", "postgres_password", "oidc_client_secret", "dns_credential"):
            self.assertEqual(plan[key], "<redacted>")
        self.assertNotIn("super-secret-token", json.dumps(plan))

    def test_next_steps_warn_about_certificate_transparency(self) -> None:
        for scheme in (HTTP_01, DNS_01):
            with self.subTest(scheme=scheme):
                self.assertIn("Certificate Transparency", render.render_next_steps(answers_for(scheme)))
        self.assertNotIn("Certificate Transparency", render.render_next_steps(answers_for(INTERNAL_CA)))

    def test_dns_01_next_steps_demand_the_a_record(self) -> None:
        steps = render.render_next_steps(answers_for(DNS_01))
        self.assertIn("does not create the A record for you", steps)

    def test_pinned_resolver_is_called_out_as_fragile(self) -> None:
        steps = render.render_next_steps(answers_for(DNS_01, dns_pin="172.16.8.1"))
        self.assertIn("breaks silently", steps)


class WriteTests(unittest.TestCase):
    def test_written_files_use_lf_and_no_bom(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "sample.env"
            write_text(target, "A=1\r\nB=2\r\n")
            raw = target.read_bytes()
            self.assertNotIn(b"\r", raw)
            self.assertFalse(raw.startswith(b"\xef\xbb\xbf"))

    def test_existing_env_round_trips(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / ".env"
            write_text(target, "# comment\nA=1\nB=two words\n\n")
            self.assertEqual(load_existing_env(target), {"A": "1", "B": "two words"})


if __name__ == "__main__":
    unittest.main()
