"""Entry point for the Prism deployment installer.

    python3 -m scripts.prism_deploy              # interactive
    python3 -m scripts.prism_deploy --dry-run    # render and print, write nothing
    python3 -m scripts.prism_deploy --answers answers.json --non-interactive
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

from . import interview, preflight, render, tui
from .apply import apply
from .render import CADDY_IMAGE_TAG
from .schemes import DNS_01, DNS_PROVIDERS, SCHEMES

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]

REQUIRED_ANSWERS = ("scheme", "hostname")
# Only meaningful when authentication is on, which every scheme but plain-http
# enforces.
AUTH_ANSWERS = ("oidc_issuer", "oidc_client_id", "oidc_client_secret", "bootstrap_admins")


def load_answers(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    missing = [key for key in REQUIRED_ANSWERS if not data.get(key)]
    if data.get("auth_enabled", True):
        missing += [key for key in AUTH_ANSWERS if not data.get(key)]
    if missing:
        raise SystemExit(f"answers file is missing: {', '.join(missing)}")
    if data["scheme"] not in SCHEMES:
        raise SystemExit(f"unknown scheme '{data['scheme']}'; expected one of {', '.join(SCHEMES)}")
    if data["scheme"] == DNS_01:
        for key in ("dns_provider", "dns_credential"):
            if not data.get(key):
                raise SystemExit(f"scheme dns-01 requires '{key}' in the answers file")
        if data["dns_provider"] not in DNS_PROVIDERS:
            raise SystemExit(f"unknown dns_provider '{data['dns_provider']}'")
    return data


def build_caddy_image(answers: dict, root: Path) -> bool:
    module = answers["dns_provider_module"]
    tui.write()
    tui.note(f"Building {CADDY_IMAGE_TAG} with {module}")
    tui.hint("The stock caddy:2 image cannot solve DNS-01; providers are compiled in.")

    command = [
        "docker", "build",
        "-f", "deploy/Dockerfile.caddy-dns",
        "--build-arg", f"DNS_PROVIDER_MODULE={module}",
        "-t", CADDY_IMAGE_TAG,
        ".",
    ]
    tui.info("$ " + " ".join(command))
    if subprocess.run(command, cwd=root).returncode != 0:
        tui.fail("Image build failed.")
        return False

    probe = subprocess.run(
        ["docker", "run", "--rm", CADDY_IMAGE_TAG, "caddy", "list-modules"],
        capture_output=True, text=True,
    )
    provider = answers["dns_provider"]
    if f"dns.providers.{provider}" not in probe.stdout:
        tui.fail(f"dns.providers.{provider} is not in the built image.",
                 "The module did not link. Issuance would fail with an opaque error.")
        return False
    tui.ok(f"dns.providers.{provider} present")
    return True


def report_preflight(report: preflight.Report) -> bool:
    tui.section("", "Preflight")
    for result in report.results:
        if result.ok:
            tui.ok(result.name, result.detail)
        elif result.severity == preflight.WARNING:
            tui.warn(f"{result.name}: {result.detail}", result.fix)
        else:
            tui.fail(f"{result.name}: {result.detail}", result.fix)
    return not report.failures


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="prism-deploy", description=__doc__)
    parser.add_argument("--answers", type=Path, help="JSON answers file for unattended runs")
    parser.add_argument("--non-interactive", action="store_true", help="fail rather than prompt")
    parser.add_argument("--dry-run", action="store_true", help="render to stdout without writing")
    parser.add_argument("--root", type=Path, default=REPOSITORY_ROOT, help="repository root")
    parser.add_argument("--fresh", action="store_true", help="ignore any existing generated/ configuration")
    parser.add_argument("--skip-preflight", action="store_true", help="skip environment checks")
    parser.add_argument("--skip-network-checks", action="store_true", help="skip egress and DNS probes")
    parser.add_argument("--start", action="store_true", help="build and start the stack when checks pass")
    args = parser.parse_args(argv)

    root: Path = args.root.resolve()
    example = root / ".env.example"
    if not example.is_file():
        raise SystemExit(f"{example} not found; run from a Prism checkout or pass --root")

    try:
        if args.answers:
            raw = load_answers(args.answers)
        elif args.non_interactive:
            raise SystemExit("--non-interactive requires --answers")
        else:
            raw = interview.run(root, fresh=args.fresh)
    except tui.Abort:
        tui.write()
        tui.warn("Cancelled. Nothing was written.")
        return 130

    answers = render.normalise(raw)
    files = render.render_all(example.read_text(encoding="utf-8"), answers)

    if not args.answers:
        interview.summarise(answers)

    if args.dry_run:
        for path, content in sorted(files.items()):
            tui.write()
            tui.write(f"{tui.ACCENT}── {path} {'─' * max(0, tui.width() - len(path) - 4)}{tui.RESET}")
            tui.write(content.rstrip("\n"))
        tui.write()
        tui.note("Dry run: nothing was written.")
        return 0

    if not args.answers and not args.non_interactive:
        if not tui.confirm("Write this configuration?", default=True):
            tui.warn("Cancelled. Nothing was written.")
            return 130

    backup, warnings = apply(root, files)
    tui.section("", "Generated")
    for path in sorted(files):
        tui.ok(path)
    if backup:
        tui.info(f"Previous files copied to {backup.relative_to(root)}")
    for warning in warnings:
        tui.warn(warning)

    if answers["scheme"] == DNS_01 and not build_caddy_image(answers, root):
        return 1

    compose = render.compose_command(answers)
    if not args.skip_preflight:
        report = preflight.run(answers, root, compose=compose, skip_network=args.skip_network_checks)
        if not report_preflight(report):
            tui.write()
            tui.fail("Preflight failed. Configuration was written but nothing was started.")
            return 1

    tui.section("", "Next")
    tui.info("Read generated/NEXT_STEPS.md: DNS records, firewall, and OIDC registration")
    tui.info("are yours to complete; the installer does not touch anything outside this")
    tui.info("directory.")
    tui.write()
    tui.write(f"  {tui.DIM}Start the stack with:{tui.RESET}")
    tui.write(f"  {tui.BOLD}{' '.join(compose + ['up', '-d', '--wait'])}{tui.RESET}")

    if args.start:
        tui.write()
        tui.note("Starting")
        result = subprocess.run(compose + ["up", "-d", "--wait"], cwd=root)
        if result.returncode != 0:
            tui.fail("Startup failed.", f"Inspect with: {' '.join(compose + ['logs', '--tail=100'])}")
            return result.returncode
        tui.ok("Stack is up")

    return 0


if __name__ == "__main__":
    sys.exit(main())
