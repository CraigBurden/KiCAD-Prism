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
from prism_deploy.schemes import (
    DNS_01, EXTERNAL_PROXY, HTTP_01, INTERNAL_CA, PLAIN_HTTP, TAILSCALE, SCHEMES,
)

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
    if scheme == TAILSCALE:
        answers["hostname"] = "prism.tail1a2b3c.ts.net"
    if scheme == DNS_01:
        answers.setdefault("dns_provider", "cloudflare")
        answers.setdefault("dns_credential", "token-value")
    if scheme == INTERNAL_CA:
        answers.setdefault("certificate_dir", "./deploy/certs")
    if scheme == TAILSCALE:
        answers.setdefault("hostname", "prism.tail1a2b3c.ts.net")
        answers.setdefault("ts_authkey", "tskey-auth-example")
    answers.update(overrides)
    return render.normalise(answers)


class DerivationTests(unittest.TestCase):
    """Related settings must not be able to drift apart."""

    def test_cors_and_base_url_always_agree(self) -> None:
        answers = answers_for(HTTP_01)
        self.assertEqual(answers["public_base_url"], "https://prism.example.com")
        self.assertEqual(answers["cors_origins"], answers["public_base_url"])

    def test_cookie_secure_is_explicit_and_matches_the_transport(self) -> None:
        # An empty SESSION_COOKIE_SECURE crashes the backend at import time, and
        # a Secure cookie over plain http is never sent back, so login silently
        # fails. The value must be set, and set correctly for the scheme.
        for scheme in SCHEMES:
            with self.subTest(scheme=scheme):
                answers = answers_for(scheme)
                value = render.env_values(answers)["SESSION_COOKIE_SECURE"]
                self.assertIn(value, ("true", "false"))
                expected = "true" if answers["public_base_url"].startswith("https://") else "false"
                self.assertEqual(value, expected)

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


class TailscaleTests(unittest.TestCase):
    def test_origin_is_the_magicdns_name_over_https(self) -> None:
        answers = answers_for(TAILSCALE)
        self.assertEqual(answers["public_base_url"], "https://prism.tail1a2b3c.ts.net")
        # Tailscale Serve listens on 443, so no port belongs in the origin.
        self.assertNotIn(":8080", answers["public_base_url"])

    def test_node_name_is_derived_from_the_magicdns_name(self) -> None:
        # If these disagreed, the certificate domain would not match the origin.
        self.assertEqual(answers_for(TAILSCALE)["ts_hostname"], "prism")

    def test_no_caddy_and_no_proxy_compose(self) -> None:
        answers = answers_for(TAILSCALE)
        self.assertIsNone(render.render_caddyfile(answers))
        self.assertNotIn("docker-compose.proxy.yml", render.compose_files(answers))

    def test_sidecar_declares_its_state_volume(self) -> None:
        # Without persisted state the node re-authenticates and may be renamed,
        # which would change the certificate domain.
        overlay = render.render_compose(answers_for(TAILSCALE))
        self.assertIn("tailscale-state:/var/lib/tailscale", overlay)
        self.assertIn("\nvolumes:\n  tailscale-state:", overlay)

    def test_serve_config_targets_the_frontend_over_the_compose_network(self) -> None:
        config = json.loads(render.render_serve_config(answers_for(TAILSCALE)))
        self.assertTrue(config["TCP"]["443"]["HTTPS"])
        handler = config["Web"]["${TS_CERT_DOMAIN}:443"]["Handlers"]["/"]
        self.assertEqual(handler["Proxy"], "http://frontend:80")

    def test_serve_config_is_generated_only_for_this_scheme(self) -> None:
        self.assertIn("generated/tailscale-serve.json", render.render_all(ENV_EXAMPLE, answers_for(TAILSCALE)))
        for scheme in (DNS_01, HTTP_01, INTERNAL_CA, EXTERNAL_PROXY, PLAIN_HTTP):
            with self.subTest(scheme=scheme):
                self.assertNotIn("generated/tailscale-serve.json", render.render_all(ENV_EXAMPLE, answers_for(scheme)))

    def test_auth_key_reaches_the_env_and_is_redacted_from_the_plan(self) -> None:
        answers = answers_for(TAILSCALE, ts_authkey="tskey-auth-supersecret")
        self.assertIn("TS_AUTHKEY=tskey-auth-supersecret", render.render_env(ENV_EXAMPLE, answers))
        self.assertNotIn("supersecret", render.render_plan(answers))

    def test_next_steps_require_no_dns_or_firewall_work(self) -> None:
        steps = render.render_next_steps(answers_for(TAILSCALE))
        self.assertIn("Nothing to create.", steps)
        self.assertIn("Nothing to open.", steps)
        self.assertIn("MagicDNS", steps)
        self.assertIn("tailnet ACLs", steps)


class TailscaleHostModeTests(unittest.TestCase):
    """A host already on the tailnet needs no sidecar and no auth key."""

    def _host_mode(self, **overrides) -> dict:
        return answers_for(TAILSCALE, ts_mode="host", ts_authkey="", **overrides)

    def test_no_sidecar_service(self) -> None:
        overlay = render.render_compose(self._host_mode())
        self.assertNotIn("tailscale:", overlay)
        self.assertNotIn("tailscale-state", overlay)

    def test_no_auth_key_in_the_env(self) -> None:
        self.assertNotIn("TS_AUTHKEY", render.render_env(ENV_EXAMPLE, self._host_mode()))

    def test_no_serve_config_file(self) -> None:
        # Serve is configured on the host with one command, not from a file.
        self.assertNotIn("generated/tailscale-serve.json", render.render_all(ENV_EXAMPLE, self._host_mode()))

    def test_next_steps_give_the_serve_command_with_the_real_port(self) -> None:
        steps = render.render_next_steps(self._host_mode(http_port="9090"))
        self.assertIn("tailscale serve --bg 9090", steps)
        self.assertIn("tailscale serve reset", steps)

    def test_frontend_stays_on_loopback_for_serve_to_reach(self) -> None:
        # Serve proxies to 127.0.0.1, and publishing wider would bypass the tailnet.
        self.assertIn('"127.0.0.1:8080:80"', render.render_compose(self._host_mode()))

    def test_sidecar_remains_the_default(self) -> None:
        self.assertEqual(answers_for(TAILSCALE)["ts_mode"], "sidecar")
        self.assertIn("tailscale:", render.render_compose(answers_for(TAILSCALE)))


class PlainHttpTests(unittest.TestCase):
    """The evaluation scheme must be honest about what it gives up."""

    def test_origin_carries_the_port_and_no_tls(self) -> None:
        answers = answers_for(PLAIN_HTTP, hostname="localhost", http_port="9000")
        self.assertEqual(answers["public_base_url"], "http://localhost:9000")
        self.assertEqual(answers["cors_origins"], answers["public_base_url"])

    def test_no_proxy_is_configured(self) -> None:
        answers = answers_for(PLAIN_HTTP)
        self.assertIsNone(render.render_caddyfile(answers))
        self.assertNotIn("docker-compose.proxy.yml", render.compose_files(answers))

    def test_next_steps_lead_with_the_remote_panel_limitation(self) -> None:
        steps = render.render_next_steps(answers_for(PLAIN_HTTP))
        self.assertIn("what this deployment cannot do", steps)
        self.assertIn("KiCad remote symbol panel is not supported", steps)
        self.assertIn("reject non-HTTPS redirect URIs", steps)
        # The warning has to precede the routine setup instructions.
        self.assertLess(steps.index("not supported"), steps.index("## 1. DNS"))

    def test_other_schemes_carry_no_such_warning(self) -> None:
        for scheme in (DNS_01, HTTP_01, INTERNAL_CA, EXTERNAL_PROXY):
            with self.subTest(scheme=scheme):
                self.assertNotIn("cannot do", render.render_next_steps(answers_for(scheme)))

    def test_disabling_auth_defaults_the_guest_to_read_only(self) -> None:
        values = render.env_values(answers_for(PLAIN_HTTP, auth_enabled=False))
        self.assertEqual(values["AUTH_ENABLED"], "false")
        self.assertEqual(values["DEV_GUEST_ROLE"], "viewer")

    def test_open_instance_warning_names_the_role_and_address(self) -> None:
        steps = render.render_next_steps(answers_for(PLAIN_HTTP, auth_enabled=False, hostname="prism-eval"))
        self.assertIn("Authentication is disabled", steps)
        self.assertIn("viewer", steps)
        self.assertIn("http://prism-eval:8080", steps)

    def test_auth_stays_on_for_every_other_scheme(self) -> None:
        for scheme in (DNS_01, HTTP_01, INTERNAL_CA, EXTERNAL_PROXY):
            with self.subTest(scheme=scheme):
                values = render.env_values(answers_for(scheme, auth_enabled=False))
                self.assertEqual(values["AUTH_ENABLED"], "true")
                self.assertNotIn("DEV_GUEST_ROLE", values)

    def test_renders_without_any_oidc_answers(self) -> None:
        # An answers file for an open evaluation instance has no OIDC keys at all.
        answers = render.normalise({
            "scheme": PLAIN_HTTP,
            "hostname": "localhost",
            "auth_enabled": False,
        })
        files = render.render_all(ENV_EXAMPLE, answers)
        self.assertIn("generated/.env", files)
        self.assertIn("AUTH_ENABLED=false", files["generated/.env"])
        self.assertIn("OIDC_ISSUER_URL=", files["generated/.env"])

    def test_bind_address_is_loopback_unless_asked_otherwise(self) -> None:
        self.assertIn('"127.0.0.1:8080:80"', render.render_compose(answers_for(PLAIN_HTTP)))
        exposed = render.render_compose(answers_for(PLAIN_HTTP, bind_address="0.0.0.0"))
        self.assertIn('"0.0.0.0:8080:80"', exposed)
        # The backend stays on loopback regardless.
        self.assertIn('"127.0.0.1:8000:8000"', exposed)

    def test_tls_schemes_cannot_be_exposed_by_a_stray_bind_address(self) -> None:
        overlay = render.render_compose(answers_for(DNS_01, bind_address="0.0.0.0"))
        self.assertIn('"127.0.0.1:8080:80"', overlay)


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


class PreflightProbeTests(unittest.TestCase):
    """The probes must describe the network path the deployment actually uses."""

    def test_probe_honours_the_pinned_resolver(self) -> None:
        # Without this the checks test a path no container in the deployment
        # travels, and a working pinned configuration is reported as broken.
        from prism_deploy.preflight import probe_command

        self.assertNotIn("--dns", probe_command(["nslookup", "x"], None))
        pinned = probe_command(["nslookup", "x"], "172.16.8.1")
        self.assertEqual(pinned[3:5], ["--dns", "172.16.8.1"])

    def test_curl_reason_reports_the_error_not_a_truncation(self) -> None:
        from prism_deploy.preflight import _curl_reason

        noisy = (
            "* Trying 1.2.3.4:443...\n"
            "curl: (60) SSL certificate problem: self-signed certificate\n"
            "More details here: https://curl.se/docs/sslcerts.html\n"
        )
        self.assertEqual(
            _curl_reason(noisy),
            "curl: (60) SSL certificate problem: self-signed certificate",
        )


class TuiTests(unittest.TestCase):
    def test_menu_rows_never_wrap(self) -> None:
        # select() redraws by moving the cursor up len(options) lines, so a row
        # that wraps to two lines corrupts every subsequent frame.
        from prism_deploy import tui
        from prism_deploy.interview import SCHEME_DETAIL
        from prism_deploy.schemes import SCHEME_ORDER, SCHEMES

        limit = tui.width()
        for key in SCHEME_ORDER:
            label = SCHEMES[key].label
            row = f"  > {label}  {tui._fit(SCHEME_DETAIL[key], limit - len(label) - 6)}"
            with self.subTest(scheme=key):
                self.assertLessEqual(len(row), limit)

    def test_fit_ellipsises_rather_than_wrapping(self) -> None:
        from prism_deploy.tui import _fit

        self.assertEqual(_fit("short", 20), "short")
        self.assertEqual(_fit("a" * 30, 10), "a" * 9 + "…")
        self.assertEqual(_fit("anything", 0), "")

    def test_every_prompt_offers_an_example_or_docs_link(self) -> None:
        # The point of the interview is that a first-time operator does not need
        # the deployment guide open alongside it.
        import inspect

        from prism_deploy import interview

        source = inspect.getsource(interview.run)
        self.assertGreaterEqual(source.count("example="), 8)
        self.assertGreaterEqual(source.count("docs="), 5)
